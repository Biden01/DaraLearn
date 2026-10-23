"""Verification / Outcome Engine: диагностика и проверочные тесты без AI, результат обновляет Student State."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user
from app.modules.content.models import Course, Lesson, Subject, Task
from app.modules.content.service import lessons_of, subject_by_slug, task_public
from app.modules.decisions.engine import decide, tutor_sessions_by_lesson
from app.modules.events.models import LearningEvent
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states
from app.modules.verification.models import Attempt

router = APIRouter(prefix="/verification", tags=["verification"])

SECONDS_PER_TASK = 90


class AttemptIn(BaseModel):
    kind: Literal["diagnostic", "verification"]
    subject: str = "math"
    course: str | None = None
    lesson: str | None = None


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

    out = _attempt_out(db, a)
    lessons = lessons_of(db, a.subject_id)
    states = compute_states(db, user.id)
    touched = {tasks[t].lesson_id for t in a.task_ids if t in tasks}
    out["skills"] = [{"slug": l.slug, "title": l.title, **states.get(l.id, SkillState()).as_dict()}
                     for l in lessons if l.id in touched]
    out["recommendations"] = decide(lessons, states, tutor_sessions_by_lesson(db, user.id))[:3]
    return out
