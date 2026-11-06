"""Кабинет родителя: ученик даёт код, родитель видит ребёнка только на чтение, без сравнения с другими."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.school.access import new_code
from app.modules.school.models import ClassMember, ParentLink, User

router = APIRouter(prefix="/parents", tags=["parents"])

MAX_PARENTS = 4  # на одного ученика


class CodeIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


def find_parent_code(db: Session, code: str) -> ParentLink | None:
    return db.scalar(select(ParentLink).where(ParentLink.code == code.strip().upper(), ParentLink.parent_id.is_(None)))


def link_parent(db: Session, user: User, link: ParentLink) -> None:
    """Привязать пользователя к ребёнку по коду. Аккаунт ученика из класса родителем стать не может."""
    if user.id == link.student_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "own_code")
    if user.role not in ("student", "parent"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "not_parent")
    if user.role == "student" and db.scalar(select(func.count()).select_from(ClassMember).where(ClassMember.user_id == user.id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "student_in_class")
    if db.scalar(select(ParentLink).where(ParentLink.student_id == link.student_id, ParentLink.parent_id == user.id)):
        db.delete(link)  # уже привязан к этому ребёнку — лишний код просто гасим
    else:
        link.parent_id, link.code, link.linked_at = user.id, None, datetime.now(timezone.utc)
    user.role = "parent"


# ---- ученик ----

@router.get("/mine")
def my_parents(user: User = Depends(require_role("student")), db: Session = Depends(get_db)) -> dict:
    links = list(db.scalars(select(ParentLink).where(ParentLink.student_id == user.id).order_by(ParentLink.id)))
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_([l.parent_id for l in links if l.parent_id] or [-1])))}
    return {"code": next((l.code for l in links if l.code), None),
            "parents": [{"id": l.id, "name": names.get(l.parent_id, ""), "linked_at": l.linked_at.isoformat()}
                        for l in links if l.parent_id]}


@router.post("/code")
def parent_code(user: User = Depends(require_role("student")), db: Session = Depends(get_db)) -> dict:
    """Код для родителя: один действующий на ученика, повторный запрос выдаёт новый (старый гаснет)."""
    linked = db.scalar(select(func.count()).select_from(ParentLink).where(
        ParentLink.student_id == user.id, ParentLink.parent_id.is_not(None))) or 0
    if linked >= MAX_PARENTS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "too_many_parents")
    for old in db.scalars(select(ParentLink).where(ParentLink.student_id == user.id, ParentLink.parent_id.is_(None))):
        db.delete(old)
    db.flush()
    code = new_code(8)
    while db.scalar(select(ParentLink.id).where(ParentLink.code == code)):
        code = new_code(8)
    db.add(ParentLink(student_id=user.id, code=code))
    db.commit()
    return {"code": code}


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink(link_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    """Отключить родителя: может сам ученик или сам родитель."""
    link = db.get(ParentLink, link_id)
    if not link or user.id not in (link.student_id, link.parent_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(link)
    db.commit()


# ---- родитель ----

@router.post("/join")
def join(payload: CodeIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    link = find_parent_code(db, payload.code)
    if not link:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid_code")
    link_parent(db, user, link)
    db.commit()
    return {"role": user.role}


def _child(db: Session, link: ParentLink) -> dict:
    """Сводка о ребёнке для родителя: только его собственные данные, без рейтингов и сравнения с классом."""
    from app.modules.plan.models import DailyPlan
    from app.modules.plan.router import plan_out, today_local
    from app.modules.state.router import build_dashboard

    s = db.get(User, link.student_id)
    d = build_dashboard(db, s)
    plan = db.scalar(select(DailyPlan).where(DailyPlan.user_id == s.id, DailyPlan.day == today_local()))
    p = plan_out(db, plan) if plan else None  # план не создаём за ученика — только смотрим
    return {
        "link_id": link.id, "id": s.id, "name": s.name, "grade": s.grade,
        "today": ({"rate": p["rate"], "done_minutes": p["done_minutes"], "total_minutes": p["total_minutes"],
                   "items": [{"block": i["block"], "title": i["title"], "status": i["status"]} for i in p["items"]]}
                  if p else None),
        "streak": d["activity"]["streak"], "week": d["activity"]["week"], "goal": d["goal"],
        "progress": d["progress"], "checks_due": d["checks_due"],
        "skills": [{"title": x["title"], "status": x["status"], "proof": x["proof"]} for x in d["lessons"] if x["status"] != "unknown"],
    }


@router.get("/children")
def children(user: User = Depends(require_role("parent")), db: Session = Depends(get_db)) -> list[dict]:
    links = list(db.scalars(select(ParentLink).where(ParentLink.parent_id == user.id).order_by(ParentLink.id)))
    out = [_child(db, l) for l in links]
    db.commit()  # build_dashboard синхронизирует рекомендации ребёнка
    return out
