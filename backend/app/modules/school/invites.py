"""Применение кода приглашения: в школу (учитель/куратор) или в класс (ученик)."""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.school.models import ClassMember, Invite, SchoolClass, User


def find_invite(db: Session, code: str) -> Invite:
    inv = db.scalar(select(Invite).where(Invite.code == code.strip().upper()))
    if (not inv or inv.uses >= inv.max_uses
            or (inv.expires_at and inv.expires_at < datetime.now(timezone.utc))):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid_code")
    return inv


def apply_invite(db: Session, user: User, inv: Invite) -> None:
    if inv.role == "teacher" and inv.class_id:
        # Код учителя для конкретного класса: класс закрепляется за тем, кто ввёл код.
        if user.role not in ("student", "teacher"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "already_admin" if user.role == "admin" else "not_teacher")
        if user.role == "teacher" and user.school_id and user.school_id != inv.school_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "teacher_other_school")
        c = db.get(SchoolClass, inv.class_id)
        if c.teacher_id and c.teacher_id != user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "class_has_teacher")
        if user.role == "student":
            for m in db.scalars(select(ClassMember).where(ClassMember.user_id == user.id)):
                db.delete(m)  # бывший «ученик» становится учителем — из классов как ученик выходит
        user.role = "teacher"
        user.school_id = inv.school_id
        c.teacher_id = user.id
    elif inv.role in ("teacher", "curator"):
        if user.role == "admin":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "already_admin")
        user.role = inv.role
        user.school_id = inv.school_id
    else:
        if user.role != "student":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "not_student")
        exists = db.scalar(select(ClassMember).where(ClassMember.class_id == inv.class_id, ClassMember.user_id == user.id))
        if not exists:
            db.add(ClassMember(class_id=inv.class_id, user_id=user.id))
        user.school_id = inv.school_id
    inv.uses += 1
