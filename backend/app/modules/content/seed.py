"""Загрузка материалов из data.py в БД (идемпотентно, по slug)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.content.data import COURSES, SUBJECTS
from app.modules.content.models import Course, Lesson, Subject, Task

PURPOSE = {"d": "diagnostic", "p": "practice", "v": "verification"}


def _upsert(db: Session, model, slug: str, **fields):
    obj = db.scalar(select(model).where(model.slug == slug))
    if obj is None:
        obj = model(slug=slug)
        db.add(obj)
    elif getattr(obj, "source", "seed") == "admin":
        return obj  # отредактировано в админке — seed не перетирает
    for k, v in fields.items():
        setattr(obj, k, v)
    db.flush()
    return obj


def seed_content(db: Session) -> None:
    subjects = {}
    for i, s in enumerate(SUBJECTS):
        subjects[s["slug"]] = _upsert(db, Subject, s["slug"], title=s["title"], sym=s["sym"],
                                      color=s.get("color", ""), active=s.get("active", False), order=i)
    for ci, c in enumerate(COURSES):
        course = _upsert(db, Course, c["slug"], subject_id=subjects[c["subject"]].id, title=c["title"],
                         description=c["description"], sym=c["sym"], level=c["level"], grade=c["grade"], order=ci)
        for li, l in enumerate(c["lessons"]):
            lesson = _upsert(db, Lesson, l["slug"], course_id=course.id, title=l["title"], minutes=l["minutes"],
                             theory=l["theory"], examples=l["examples"], prereqs=l["prereqs"], order=li)
            for ti, (p, q, opts, r, ex) in enumerate(l["tasks"]):
                _upsert(db, Task, f"{l['slug']}-{ti + 1}", lesson_id=lesson.id, purpose=PURPOSE[p],
                        question=q, options=opts, answer=r, explanation=ex)
    db.commit()
