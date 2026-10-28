"""Learning Events: импорт Excel/CSV, проверка ответов, привязка к навыкам, сохранение событий."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.content.models import Lesson, Task
from app.modules.decisions.service import subject_lessons, sync_student
from app.modules.events.models import LearningEvent
from app.modules.school import people_import
from app.modules.school.access import visible_student_ids
from app.modules.school.models import User
from app.modules.school.router import audit
from app.modules.state.engine import compute_states
from app.modules.verification.service import schedule_check

router = APIRouter(prefix="/events", tags=["events"])

TRUE = {"1", "+", "да", "иә", "yes", "true", "верно", "дұрыс", "y"}
FALSE = {"0", "-", "нет", "жоқ", "no", "false", "неверно", "қате", "n"}
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


@router.post("/import")
async def import_results(file: UploadFile = File(...), user: User = Depends(require_role("teacher")),
                         db: Session = Depends(get_db)) -> dict:
    """Колонки: логин/email ученика; slug задания или урока; верно (1/0, да/нет); дата (необязательно).

    Строка по уроку без конкретного задания привязывается к его диагностическому заданию.
    Ошибочные строки не сохраняются и возвращаются для ручного разбора.
    """
    data = await file.read(5 * 1024 * 1024)
    try:
        rows = people_import.read_rows(file.filename or "", data)[:MAX_ROWS]
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad_file")
    allowed = visible_student_ids(db, user)
    users = {}
    for u in db.scalars(select(User).where(User.role == "student")):
        if allowed is None or u.id in allowed:
            for key in (u.login, u.email):
                if key:
                    users[key.lower()] = u
    tasks = {t.slug: t for t in db.scalars(select(Task))}
    lessons = {l.slug: l for l in db.scalars(select(Lesson))}
    diag = {}
    for t in sorted(tasks.values(), key=lambda x: x.id):
        if t.purpose == "diagnostic":
            diag.setdefault(t.lesson_id, t)

    saved, errors, touched = 0, [], set()
    for i, r in enumerate(rows, start=1):
        r = (r + ["", "", "", ""])[:4]
        who, what, ok, when = r[0].lower(), r[1].strip(), r[2].strip().lower(), r[3].strip()
        student = users.get(who)
        task = tasks.get(what) or (diag.get(lessons[what].id) if what in lessons else None)
        err = (None if student else "student") or (None if task else "task") or (None if ok in TRUE | FALSE else "result")
        at = _parse_date(when) if when else datetime.now(timezone.utc)
        if not err and at is None:
            err = "date"
        if err:
            errors.append({"row": i, "field": err, "values": r[:4]})
            continue
        correct = ok in TRUE
        db.add(LearningEvent(user_id=student.id, lesson_id=task.lesson_id, task_id=task.id, source="import",
                             correct=correct, choice=task.answer if correct else -1, created_at=at))
        saved += 1
        touched.add(student.id)
    db.flush()
    lessons_list = subject_lessons(db)
    for sid in touched:
        sync_student(db, sid, lessons_list)
    audit(db, user, "events.import", "events", None, saved=saved, errors=len(errors))
    db.commit()
    return {"saved": saved, "students": len(touched), "errors": errors[:200], "error_count": len(errors)}
