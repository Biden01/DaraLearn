"""Verification / Outcome Engine: диагностика и проверочные тесты без AI, результат обновляет Student State."""
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.content.models import Course, Lesson, Subject, Task
from app.modules.content.service import lessons_of, subject_by_slug, task_public
from app.modules.decisions.service import rec_out, sync_student
from app.modules.events.models import LearningEvent
from app.modules.school.access import class_students, get_class, get_student, visible_classes
from app.modules.school.models import ClassMember, SchoolClass, User
from app.modules.school.router import audit
from app.modules.state.engine import SkillState, compute_states
from app.modules.verification.models import AdviserCase, Attempt, Check
from app.modules.verification.service import complete_check, pending_checks, refresh_cases, schedule_check

router = APIRouter(prefix="/verification", tags=["verification"])

SECONDS_PER_TASK = 90


class AttemptIn(BaseModel):
    kind: Literal["diagnostic", "verification"]
    subject: str = "math"
    course: str | None = None
    lesson: str | None = None
    check_id: int | None = None  # проверка, назначенная после помощи


class SubmitIn(BaseModel):
    answers: dict[str, int]


def _tasks_for(db: Session, payload: AttemptIn, subj: Subject) -> tuple[list[Task], Course | None, Lesson | None]:
    course = lesson = None
    if payload.kind == "diagnostic":
        # по одному диагностическому заданию на урок: картина по всему предмету
        lessons = lessons_of(db, subj.id)
        tasks = [db.scalar(select(Task).where(Task.lesson_id == l.id, Task.purpose == "diagnostic").order_by(Task.id))
                 for l in lessons]
        return [t for t in tasks if t], None, None
    if payload.lesson:
        lesson = db.scalar(select(Lesson).where(Lesson.slug == payload.lesson))
        if not lesson:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        tasks = list(db.scalars(select(Task).where(Task.lesson_id == lesson.id,
                                                   Task.purpose.in_(["verification", "diagnostic"])).order_by(Task.id)))
        return tasks, db.get(Course, lesson.course_id), lesson
    course = db.scalar(select(Course).where(Course.slug == (payload.course or "")))
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    lessons = list(db.scalars(select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.order)))
    tasks = []
    for l in lessons:
        tasks += list(db.scalars(select(Task).where(Task.lesson_id == l.id, Task.purpose == "verification").order_by(Task.id)))
    return tasks, course, None


def _attempt_out(db: Session, a: Attempt) -> dict:
    tasks = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_(a.task_ids)))}
    course = db.get(Course, a.course_id) if a.course_id else None
    lesson = db.get(Lesson, a.lesson_id) if a.lesson_id else None
    subj = db.get(Subject, a.subject_id)
    out = {"id": a.id, "kind": a.kind, "total": a.total, "time_limit": a.time_limit,
           "started_at": a.started_at.isoformat(), "finished": a.finished_at is not None,
           "subject": {"slug": subj.slug, "title": subj.title, "sym": subj.sym},
           "course": {"slug": course.slug, "title": course.title} if course else None,
           "lesson": {"slug": lesson.slug, "title": lesson.title} if lesson else None,
           "tasks": [task_public(tasks[i]) for i in a.task_ids if i in tasks]}
    if a.finished_at:
        out["score"] = a.score
        out["answers"] = a.answers
        out["results"] = [{"task_id": i, "answer": tasks[i].answer, "explanation": tasks[i].explanation,
                           "choice": a.answers.get(str(i)), "correct": a.answers.get(str(i)) == tasks[i].answer}
                          for i in a.task_ids if i in tasks]
    return out


@router.post("/attempts", status_code=status.HTTP_201_CREATED)
def start(payload: AttemptIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    check = None
    if payload.check_id:
        check = db.get(Check, payload.check_id)
        if not check or check.user_id != user.id or check.status != "pending":
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        lesson = db.get(Lesson, check.lesson_id)
        payload = AttemptIn(kind="verification", subject=payload.subject, lesson=lesson.slug)
    subj = subject_by_slug(db, payload.subject)
    if not subj or not subj.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "subject_not_ready")
    tasks, course, lesson = _tasks_for(db, payload, subj)
    if not tasks:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    a = Attempt(user_id=user.id, kind=payload.kind, subject_id=subj.id, course_id=course.id if course else None,
                lesson_id=lesson.id if lesson else None, task_ids=[t.id for t in tasks], answers={},
                total=len(tasks), time_limit=len(tasks) * SECONDS_PER_TASK)
    db.add(a)
    db.flush()
    if check:
        check.attempt_id = a.id
    db.commit()
    return _attempt_out(db, a)


@router.get("/attempts")
def recent(limit: int = 10, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Attempt).where(Attempt.user_id == user.id, Attempt.finished_at.is_not(None))
                      .order_by(Attempt.id.desc()).limit(max(1, min(limit, 50))))
    out = []
    for a in rows:
        course = db.get(Course, a.course_id) if a.course_id else None
        lesson = db.get(Lesson, a.lesson_id) if a.lesson_id else None
        subj = db.get(Subject, a.subject_id)
        out.append({"id": a.id, "kind": a.kind, "score": a.score, "total": a.total,
                    "finished_at": a.finished_at.isoformat(),
                    "subject": {"slug": subj.slug, "title": subj.title, "sym": subj.sym, "color": subj.color},
                    "title": (lesson.title if lesson else course.title if course else subj.title)})
    return out


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    a = db.get(Attempt, attempt_id)
    if not a or a.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return _attempt_out(db, a)


@router.post("/attempts/{attempt_id}/submit")
def submit(attempt_id: int, payload: SubmitIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    a = db.get(Attempt, attempt_id)
    if not a or a.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if a.finished_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "already_finished")
    tasks = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_(a.task_ids)))}
    answers, score = {}, 0
    for tid in a.task_ids:
        choice = payload.answers.get(str(tid))
        if choice is None or tid not in tasks:
            continue  # без ответа — не событие, а отсутствие данных
        correct = choice == tasks[tid].answer
        score += correct
        answers[str(tid)] = choice
        db.add(LearningEvent(user_id=user.id, lesson_id=tasks[tid].lesson_id, task_id=tid, attempt_id=a.id,
                             source=a.kind, correct=correct, choice=choice))
    a.answers, a.score, a.finished_at = answers, score, datetime.now(timezone.utc)
    db.commit()

    outcome = complete_check(db, a)
    lessons = lessons_of(db, a.subject_id)
    recs = sync_student(db, user.id, lessons)
    db.commit()
    out = _attempt_out(db, a)
    states = compute_states(db, user.id)
    touched = {tasks[t].lesson_id for t in a.task_ids if t in tasks}
    out["skills"] = [{"slug": l.slug, "title": l.title, **states.get(l.id, SkillState()).as_dict()}
                     for l in lessons if l.id in touched]
    by_id = {l.id: l for l in lessons}
    out["recommendations"] = [rec_out(r, by_id, states) for r in recs[:3]]
    out["outcome"] = ({"before": outcome.before, "after": outcome.after, "helped": outcome.helped} if outcome else None)
    return out


# ---------- Отложенные проверки ----------

class AssignIn(BaseModel):
    lesson: str


class CaseIn(BaseModel):
    status: Literal["open", "watching", "closed"] | None = None
    next_step: str | None = None
    watch_until: date | None = None


def _check_out(c: Check, lesson: Lesson) -> dict:
    now = datetime.now(timezone.utc)
    return {"id": c.id, "lesson": {"slug": lesson.slug, "title": lesson.title}, "reason": c.reason,
            "due_at": c.due_at.isoformat(), "due": c.due_at <= now}


@router.get("/checks")
def my_checks(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    return [_check_out(c, db.get(Lesson, c.lesson_id)) for c in pending_checks(db, user.id)]


@router.post("/classes/{class_id}/assign", status_code=status.HTTP_201_CREATED)
def assign_check(class_id: int, payload: AssignIn, user: User = Depends(require_role("teacher")),
                 db: Session = Depends(get_db)) -> dict:
    """Учитель назначает проверку навыка всему классу — она сразу доступна ученикам."""
    c = get_class(db, user, class_id)
    lesson = db.scalar(select(Lesson).where(Lesson.slug == payload.lesson))
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    now = datetime.now(timezone.utc)
    n = sum(1 for s in class_students(db, c.id) if schedule_check(db, s.id, lesson.id, "teacher", due=now))
    audit(db, user, "check.assign", "class", c.id, lesson=lesson.slug, count=n)
    db.commit()
    return {"assigned": n}


# ---------- Adviser Lite ----------

def _case_out(db: Session, case: AdviserCase) -> dict:
    s = db.get(User, case.user_id)
    cls = db.execute(select(ClassMember.class_id).where(ClassMember.user_id == s.id)).scalars().first()
    c = db.get(SchoolClass, cls) if cls else None
    return {"id": case.id, "status": case.status, "plan_rate": case.plan_rate, "reason": case.reason,
            "next_step": case.next_step, "watch_until": case.watch_until.isoformat() if case.watch_until else None,
            "created_at": case.created_at.isoformat(), "updated_at": case.updated_at.isoformat() if case.updated_at else None,
            "student": {"id": s.id, "name": s.name, "class": c.name if c else None}}


@router.get("/adviser")
def adviser_queue(include_closed: bool = False, user: User = Depends(require_role("curator")),
                  db: Session = Depends(get_db)) -> list[dict]:
    students: dict[int, User] = {}
    for c in visible_classes(db, user):
        for s in class_students(db, c.id):
            students[s.id] = s
    refresh_cases(db, list(students.values()))
    db.commit()
    stmt = select(AdviserCase).where(AdviserCase.user_id.in_(students.keys() or {-1}))
    if not include_closed:
        stmt = stmt.where(AdviserCase.status != "closed")
    rows = sorted(db.scalars(stmt), key=lambda x: (x.status != "open", x.plan_rate))
    return [_case_out(db, x) for x in rows]


@router.patch("/adviser/{case_id}")
def update_case(case_id: int, payload: CaseIn, user: User = Depends(require_role("curator")),
                db: Session = Depends(get_db)) -> dict:
    case = db.get(AdviserCase, case_id)
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    get_student(db, user, case.user_id)  # проверка доступа
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(case, k, v)
    case.curator_id = user.id
    audit(db, user, "adviser.update", "adviser_case", case.id, **{k: str(v) for k, v in payload.model_dump(exclude_none=True).items()})
    db.commit()
    return _case_out(db, case)
