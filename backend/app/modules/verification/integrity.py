"""Защита от списывания в независимых проверках (тесты, этапы 7–9 Tutor, отложенные проверки).

1. Задания, которые ученик ещё не видел, идут первыми и в случайном порядке: ответы, показанные после прошлой проверки,
   не помогают в следующей. Если новых не хватает, добавляются давно виденные — с отметкой «repeat».
2. У каждой попытки свой порядок вариантов: «в третьем ответ Б» не передать однокласснику.
   В базе (LearningEvent.choice, Attempt.answers) хранится исходный индекс варианта — на нём держится разбор ошибок.
3. Отметки честности ответа: away — уходил с вкладки во время теста, fast — слишком быстро для решения,
   late — сдал после лимита времени, repeat — задание уже видел. Ничего не запрещают: снижают доверие (state/trust.py).
"""
import random
from datetime import datetime, timezone

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.content.models import Task
from app.modules.content.service import task_public
from app.modules.events.models import LearningEvent

FAST_SECONDS_PER_TASK = 6   # быстрее — не успеть прочитать и решить
LATE_GRACE_SECONDS = 60     # запас на медленную сеть
AWAY_SECONDS = 15           # суммарно дольше на другой вкладке — отметка away (одно короткое переключение прощаем)
RETAKE_HOURS = 24           # самостоятельная проверка одного урока — не чаще


class Signals(BaseModel):
    """Что браузер заметил за время теста."""
    away_count: int = Field(default=0, ge=0, le=10_000)
    away_seconds: int = Field(default=0, ge=0, le=86_400)


def seen_task_ids(db: Session, user_id: int) -> dict[int, datetime]:
    """Задания, на которые ученик уже отвечал на сайте вне практики (и видел после этого правильный ответ), и когда — последний раз.
    Внешние результаты (import) не в счёт: учитель привязывает их к заданию урока, но ученик этого задания не видел."""
    rows = db.execute(select(LearningEvent.task_id, func.max(LearningEvent.created_at))
                      .where(LearningEvent.user_id == user_id, LearningEvent.source.not_in(("practice", "import")))
                      .group_by(LearningEvent.task_id)).all()
    return {tid: at for tid, at in rows}


def pick_tasks(db: Session, user_id: int, pool: list[Task], n: int | None = None) -> tuple[list[Task], set[int]]:
    """Сначала невиденные (случайно), затем давно виденные. Возвращает задания и id повторных."""
    seen = seen_task_ids(db, user_id)
    fresh = [t for t in pool if t.id not in seen]
    old = sorted((t for t in pool if t.id in seen), key=lambda t: seen[t.id])
    random.shuffle(fresh)
    chosen = (fresh + old)[: n if n is not None else len(pool)]
    return chosen, {t.id for t in chosen if t.id in seen}


def make_order(tasks: list[Task]) -> dict[str, list[int]]:
    order = {}
    for t in tasks:
        perm = list(range(len(t.options or [])))
        random.shuffle(perm)
        order[str(t.id)] = perm
    return order


def _perm(order: dict | None, task: Task) -> list[int]:
    perm = (order or {}).get(str(task.id))
    return perm if perm and len(perm) == len(task.options or []) else list(range(len(task.options or [])))


def public(task: Task, order: dict | None) -> dict:
    """Задание без ответа, варианты — в порядке этой попытки."""
    out = task_public(task)
    out["options"] = [task.options[i] for i in _perm(order, task)]
    return out


def to_original(order: dict | None, task: Task, shown: int | None) -> int | None:
    """Индекс, который нажал ученик, → индекс варианта в банке."""
    perm = _perm(order, task)
    return perm[shown] if shown is not None and 0 <= shown < len(perm) else shown


def to_shown(order: dict | None, task: Task, original: int | None) -> int | None:
    perm = _perm(order, task)
    return perm.index(original) if original is not None and original in perm else original


def flags_for(signals: Signals | None, started_at: datetime | None, n_tasks: int, time_limit: int | None) -> list[str]:
    """Отметки на всю попытку (повтор задания добавляется к каждому ответу отдельно)."""
    out = []
    if signals and signals.away_seconds >= AWAY_SECONDS:
        out.append("away")
    if started_at and n_tasks:
        start = started_at if started_at.tzinfo else started_at.replace(tzinfo=timezone.utc)
        spent = (datetime.now(timezone.utc) - start).total_seconds()
        if spent < FAST_SECONDS_PER_TASK * n_tasks:
            out.append("fast")
        if time_limit and spent > time_limit + LATE_GRACE_SECONDS:
            out.append("late")
    return out


def event_flags(base: list[str], task_id: int, repeats: set[int]) -> str | None:
    fl = base + (["repeat"] if task_id in repeats else [])
    return ",".join(fl) or None
