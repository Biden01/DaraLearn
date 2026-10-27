"""Кто кого видит: учитель — учеников своих классов, куратор — свою школу, админ — всех."""
import secrets

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.school.models import ClassMember, SchoolClass, User

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # без похожих 0/O, 1/I


def new_code(n: int = 6) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(n))


def visible_classes(db: Session, user: User) -> list[SchoolClass]:
    stmt = select(SchoolClass).order_by(SchoolClass.grade, SchoolClass.name)
    if user.role == "teacher":
        stmt = stmt.where(SchoolClass.teacher_id == user.id)
    elif user.role == "curator":
        stmt = stmt.where(SchoolClass.school_id == user.school_id)
    elif user.role != "admin":
        return []
    return list(db.scalars(stmt))


def get_class(db: Session, user: User, class_id: int) -> SchoolClass:
    c = db.get(SchoolClass, class_id)
    if not c or c not in visible_classes(db, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return c


def class_students(db: Session, class_id: int) -> list[User]:
    stmt = (select(User).join(ClassMember, ClassMember.user_id == User.id)
            .where(ClassMember.class_id == class_id).order_by(User.name))
    return list(db.scalars(stmt))


def visible_student_ids(db: Session, user: User) -> set[int] | None:
    """None — без ограничений (админ)."""
    if user.role == "admin":
        return None
    if user.role == "student":
        return {user.id}
    ids = [c.id for c in visible_classes(db, user)]
    if not ids:
        return set()
    return set(db.scalars(select(ClassMember.user_id).where(ClassMember.class_id.in_(ids))))


def get_student(db: Session, user: User, student_id: int) -> User:
    allowed = visible_student_ids(db, user)
    s = db.get(User, student_id)
    if not s or (allowed is not None and student_id not in allowed):
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return s
