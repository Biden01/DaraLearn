"""Общие выборки по материалам."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.content.models import Course, Lesson, Subject, Task


def subject_by_slug(db: Session, slug: str) -> Subject | None:
    return db.scalar(select(Subject).where(Subject.slug == slug))


def courses_of(db: Session, subject_id: int) -> list[Course]:
    return list(db.scalars(select(Course).where(Course.subject_id == subject_id).order_by(Course.order)))


def lessons_of(db: Session, subject_id: int) -> list[Lesson]:
    """Уроки предмета в порядке курса и урока."""
    stmt = (select(Lesson).join(Course, Lesson.course_id == Course.id)
            .where(Course.subject_id == subject_id).order_by(Course.order, Lesson.order))
    return list(db.scalars(stmt))


def task_public(t: Task) -> dict:
    """Задание без правильного ответа."""
    return {"id": t.id, "question": t.question, "options": t.options, "lesson_id": t.lesson_id}
