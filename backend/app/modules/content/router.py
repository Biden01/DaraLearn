"""Материалы: Knowledge Graph навыков и связей, база знаний, банк заданий."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user
from app.modules.content.models import Course, Lesson, Subject, Task
from app.modules.content.service import courses_of, lessons_of, task_public
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states

router = APIRouter(prefix="/content", tags=["content"])


def _lesson_brief(l: Lesson, s: SkillState) -> dict:
    return {"id": l.id, "slug": l.slug, "title": l.title, "minutes": l.minutes, "prereqs": l.prereqs, **s.as_dict()}


def _progress(lessons: list[Lesson], states: dict[int, SkillState]) -> dict:
    st = [states.get(l.id, SkillState()).status for l in lessons]
    total = len(lessons) or 1
    return {"total": len(lessons), "mastered": st.count("mastered"),
            "learning": st.count("learning") + st.count("gap") + st.count("likely"), "left": st.count("unknown"),
            "percent": round(100 * st.count("mastered") / total)}


@router.get("/subjects")
def subjects(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    states = compute_states(db, user.id)
    out = []
    for s in db.scalars(select(Subject).order_by(Subject.order)):
        lessons = lessons_of(db, s.id)
        nxt = next((l for l in lessons if states.get(l.id, SkillState()).status != "mastered"), None)
        out.append({"slug": s.slug, "title": s.title, "sym": s.sym, "color": s.color, "active": s.active,
                    "courses": len(courses_of(db, s.id)), "progress": _progress(lessons, states),
                    "next": {"slug": nxt.slug, "title": nxt.title} if nxt else None})
    return out


@router.get("/courses")
def courses(subject: str = "math", user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    subj = db.scalar(select(Subject).where(Subject.slug == subject))
    if not subj:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    states = compute_states(db, user.id)
    out = []
    for c in courses_of(db, subj.id):
        lessons = list(db.scalars(select(Lesson).where(Lesson.course_id == c.id).order_by(Lesson.order)))
        out.append({"slug": c.slug, "title": c.title, "description": c.description, "sym": c.sym,
                    "level": c.level, "grade": c.grade, "subject": subj.slug, "subject_title": subj.title,
                    "minutes": sum(l.minutes for l in lessons), "progress": _progress(lessons, states),
                    "lessons": [_lesson_brief(l, states.get(l.id, SkillState())) for l in lessons]})
    return out


@router.get("/lessons/{slug}")
def lesson(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    l = db.scalar(select(Lesson).where(Lesson.slug == slug))
    if not l:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    course = db.get(Course, l.course_id)
    siblings = list(db.scalars(select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.order)))
    states = compute_states(db, user.id)
    practice = db.scalars(select(Task).where(Task.lesson_id == l.id, Task.purpose == "practice").order_by(Task.id))
    prereqs = list(db.scalars(select(Lesson).where(Lesson.slug.in_(l.prereqs)))) if l.prereqs else []
    i = [x.id for x in siblings].index(l.id)
    return {
        "slug": l.slug, "title": l.title, "minutes": l.minutes, "theory": l.theory, "examples": l.examples,
        "state": states.get(l.id, SkillState()).as_dict(),
        "practice": [task_public(t) for t in practice],
        "prereqs": [_lesson_brief(p, states.get(p.id, SkillState())) for p in prereqs],
        "course": {"slug": course.slug, "title": course.title, "sym": course.sym,
                   "minutes": sum(x.minutes for x in siblings), "progress": _progress(siblings, states),
                   "lessons": [_lesson_brief(x, states.get(x.id, SkillState())) for x in siblings]},
        "prev": siblings[i - 1].slug if i > 0 else None,
        "next": siblings[i + 1].slug if i + 1 < len(siblings) else None,
    }
