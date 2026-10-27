"""Learning Events: импорт Excel/CSV, проверка ответов, привязка к навыкам, сохранение событий."""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.content.models import Lesson, Task
from app.modules.decisions.service import subject_lessons, sync_student
from app.modules.events import pqs
from app.modules.events.models import LearningEvent
from app.modules.school import people_import
from app.modules.school.access import visible_student_ids
from app.modules.school.models import User
from app.modules.school.router import audit
from app.modules.state.engine import compute_states
from app.modules.verification.service import schedule_check

router = APIRouter(prefix="/events", tags=["events"])

MAX_ROWS = 5000


class PracticeIn(BaseModel):
    task_id: int
    choice: int = Field(ge=0, le=9)


@router.post("/practice")
def practice(payload: PracticeIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Практика внутри урока: ответ сразу проверяется и не влияет на «освоено»."""
    task = db.get(Task, payload.task_id)
    if not task or task.purpose != "practice":
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    correct = payload.choice == task.answer
    db.add(LearningEvent(user_id=user.id, lesson_id=task.lesson_id, task_id=task.id, source="practice",
                         correct=correct, choice=payload.choice))
    db.flush()
    st = compute_states(db, user.id).get(task.lesson_id)
    # верная практика по навыку с пробелом — это помощь; через 2 дня проверяем, удержалось ли
    if correct and st and st.status in ("gap", "learning"):
        schedule_check(db, user.id, task.lesson_id, "lesson")
    db.commit()
    return {"correct": correct, "answer": task.answer, "explanation": task.explanation}


def _parse_date(v: str) -> datetime | None:
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y %H:%M"):
        try:
            return datetime.strptime(v, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _name_key(name: str) -> str:
    """«Иванов Мария» и «Мария Иванова» не склеиваем, но порядок слов и регистр не важны."""
    return " ".join(sorted(re.sub(r"[^\w\s]", " ", name.casefold()).split()))


@router.post("/import")
async def import_results(dry_run: bool = False, threshold: float = pqs.THRESHOLD, file: UploadFile = File(...),
                         user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> dict:
    """Результаты ПҚС / БС из Excel или CSV: длинный (ученик, навык, результат, дата) или широкий (колонка на навык) формат.

    Ученик: логин, email или ФИО. Навык или задание: slug либо название. Результат: 1/0, да/нет, %, доля; не ниже threshold — верно.
    Строка по навыку без задания привязывается к его диагностическому заданию. Ошибочные строки не сохраняются и
    возвращаются для ручного разбора; dry_run=true только проверяет файл. Повторная загрузка того же файла не дублирует события.
    """
    data = await file.read(5 * 1024 * 1024)
    try:
        rows = people_import.read_rows(file.filename or "", data, keep_header=True)[:MAX_ROWS]
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad_file")
    allowed = visible_student_ids(db, user)
    users, names = {}, {}
    for u in db.scalars(select(User).where(User.role == "student")):
        if allowed is None or u.id in allowed:
            for key in (u.login, u.email):
                if key:
                    users[key.lower()] = u
            names.setdefault(_name_key(u.name), []).append(u)
    tasks = {t.slug: t for t in db.scalars(select(Task))}
    lessons = {l.slug: l for l in db.scalars(select(Lesson))}
    titles = {t.casefold(): l.slug for l in lessons.values() for t in (l.title or {}).values() if t}
    diag = {}
    for t in sorted(tasks.values(), key=lambda x: x.id):
        if t.purpose == "diagnostic":
            diag.setdefault(t.lesson_id, t)

    def resolve(text: str) -> str | None:
        key = text.strip()
        return key if key in tasks or key in lessons else titles.get(key.casefold())

    fmt, records, errors = pqs.parse(rows, resolve, threshold,
                                     default_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    prepared = []
    for rec in records:
        who = rec.who.lower()
        student = users.get(who)
        if student is None:
            found = names.get(_name_key(rec.who), [])
            if len(found) > 1:
                errors.append({"row": rec.row, "field": "student_ambiguous", "values": [rec.who]})
                continue
            student = found[0] if found else None
        task = tasks.get(rec.what) or (diag.get(lessons[rec.what].id) if rec.what in lessons else None) \
            or (diag.get(lessons[titles[rec.what.casefold()]].id) if rec.what.casefold() in titles else None)
        at = _parse_date(rec.date)
        err = (None if student else "student") or (None if task else "task") or (None if at else "date")
        if err:
            errors.append({"row": rec.row, "field": err, "values": [rec.who, rec.what, rec.date]})
            continue
        prepared.append((student, task, rec.correct, at))

    # повторная загрузка того же файла: уже сохранённые события пропускаем
    seen = {(e.user_id, e.task_id, e.created_at, e.correct) for e in db.scalars(select(LearningEvent).where(
        LearningEvent.source == "import", LearningEvent.user_id.in_({p[0].id for p in prepared} or {-1})))}
    saved, duplicates, touched = 0, 0, set()
    for student, task, correct, at in prepared:
        if (student.id, task.id, at, correct) in seen:
            duplicates += 1
            continue
        if not dry_run:
            db.add(LearningEvent(user_id=student.id, lesson_id=task.lesson_id, task_id=task.id, source="import",
                                 correct=correct, choice=task.answer if correct else -1, created_at=at))
            seen.add((student.id, task.id, at, correct))
        saved += 1
        touched.add(student.id)
    if not dry_run:
        db.flush()
        lessons_list = subject_lessons(db)
        for sid in touched:
            sync_student(db, sid, lessons_list)
        audit(db, user, "events.import", "events", None, saved=saved, errors=len(errors), format=fmt)
        db.commit()
    errors.sort(key=lambda e: e["row"])
    return {"format": fmt, "dry_run": dry_run, "saved": saved, "duplicates": duplicates, "students": len(touched),
            "errors": errors[:200], "error_count": len(errors)}
