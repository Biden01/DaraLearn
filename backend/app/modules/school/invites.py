"""Применение кода приглашения: в школу (учитель/куратор) или в класс (ученик)."""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.school.models import ClassMember, Invite, User


def find_invite(db: Session, code: str) -> Invite:
    inv = db.scalar(select(Invite).where(Invite.code == code.strip().upper()))
    if (not inv or inv.uses >= inv.max_uses
            or (inv.expires_at and inv.expires_at < datetime.now(timezone.utc))):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid_code")
    return inv


def apply_invite(db: Session, user: User, inv: Invite) -> None:
    if inv.role in ("teacher", "curator"):
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
