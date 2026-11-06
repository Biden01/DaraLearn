"""Помощник учителя по пробелу класса: план группового объяснения (ИИ), квиз на 5 минут и exit ticket (из банка).

Квиз и exit ticket берутся только из проверенного банка заданий — ИИ их не сочиняет.
План объяснения пишет модель строго по теории навыка и ошибкам этого класса; учитель решает, использовать ли его.
"""
import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.content.models import Lesson, Task
from app.modules.decisions.service import misconceptions
from app.modules.school.models import SchoolClass, User
from app.modules.state.engine import SkillState, compute_states
from app.modules.tutor import gateway

QUIZ_N = 5
EXIT_N = 2
ERROR_RU = {"base": "не владеют базовой темой", "condition": "неверно понимают условие",
            "strategy": "выбирают неверный способ решения", "calc": "ошибаются в вычислениях и знаках"}

SYSTEM = """Ты опытный учитель математики в казахстанской школе. Составь план группового объяснения на 10 минут
для учеников, у которых пробел по навыку. Опирайся только на теорию навыка ниже — не добавляй правил, которых в ней нет.
Учти типичные ошибки этого класса: начни с того, что разбирает именно их.

Формат — Markdown, коротко и по делу, на языке: {lang}.
## Цель (одна фраза)
## Ход (по минутам: 0–2, 2–6, 6–9, 9–10) — что говорит и делает учитель, вопросы классу
## Разобранный пример (новые числа, по шагам)
## Частая ошибка и как её показать
## Проверка понимания (1–2 устных вопроса)"""

LANG = {"kk": "казахский (грамотный литературный, без русизмов)", "ru": "русский"}


def class_skill(db: Session, c: SchoolClass, students: list[User], lesson: Lesson) -> dict:
    """Сколько учеников с пробелом по навыку и какие ошибки они делают."""
    states = {s.id: compute_states(db, s.id).get(lesson.id, SkillState()) for s in students}
    gap = [s.name for s in students if states[s.id].status in ("gap", "learning")]
    errs: dict[str, int] = {}
    for (uid, lid), d in misconceptions(db, {s.id for s in students}).items():
        if lid == lesson.id:
            for k, n in d.items():
                errs[k] = errs.get(k, 0) + n
    return {"students": len(students), "gap": gap, "errors": dict(sorted(errs.items(), key=lambda x: -x[1]))}


def pick_tasks(db: Session, lesson: Lesson, n: int, purposes: tuple[str, ...], seed: int | None = None) -> list[dict]:
    """Задания из банка для печати: с ответом и разбором (это для учителя)."""
    tasks = list(db.scalars(select(Task).where(Task.lesson_id == lesson.id, Task.purpose.in_(purposes)).order_by(Task.id)))
    random.Random(seed).shuffle(tasks)
    return [{"id": t.id, "question": t.question, "options": t.options, "answer": t.answer, "explanation": t.explanation}
            for t in tasks[:n]]


def explain_plan(lesson: Lesson, stats: dict, lang: str) -> tuple[str, int, int]:
    theory = "\n".join(lesson.theory.get("ru", []) or lesson.theory.get("kk", []))
    examples = "\n".join(f"- {e.get('q', '')}: " + " → ".join(e.get("steps", [])) for e in lesson.examples or []) or "—"
    errs = ", ".join(f"{ERROR_RU.get(k, k)} ({n})" for k, n in stats["errors"].items()) or "нет размеченных ошибок"
    user = (f"Навык: «{lesson.title.get('ru', '')}» / «{lesson.title.get('kk', '')}».\n\nТеория:\n{theory}\n\n"
            f"Примеры из урока:\n{examples}\n\nКласс: {stats['students']} учеников, с пробелом — {len(stats['gap'])}.\n"
            f"Типичные ошибки класса по выбранным неверным ответам: {errs}.")
    return gateway.complete(SYSTEM.format(lang=LANG[lang]), [{"role": "user", "content": user}])
