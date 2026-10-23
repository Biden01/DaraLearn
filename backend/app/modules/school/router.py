"""Школа: пользователи, классы, роли. В V0 — календарь ученика и обращения в поддержку."""
from datetime import date
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user
from app.modules.leads.notify import send_telegram
from app.modules.school.models import CalendarEvent, SupportMessage, User

router = APIRouter(prefix="/school", tags=["school"])


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    day: date
    time: str = Field(default="", pattern=r"^$|^([01]\d|2[0-3]):[0-5]\d$")
    kind: Literal["lesson", "homework", "test", "other"] = "lesson"


class SupportIn(BaseModel):
    text: str = Field(min_length=3, max_length=3000)


def _event_out(e: CalendarEvent) -> dict:
    return {"id": e.id, "title": e.title, "day": e.day.isoformat(), "time": e.time, "kind": e.kind}


@router.get("/calendar")
def calendar(start: date, end: date, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(CalendarEvent).where(CalendarEvent.user_id == user.id, CalendarEvent.day >= start,
                                                  CalendarEvent.day <= end).order_by(CalendarEvent.day, CalendarEvent.time))
    return [_event_out(e) for e in rows]


@router.post("/calendar", status_code=status.HTTP_201_CREATED)
def add_event(payload: EventIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    e = CalendarEvent(user_id=user.id, **payload.model_dump())
    db.add(e)
    db.commit()
    return _event_out(e)


@router.delete("/calendar/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    e = db.get(CalendarEvent, event_id)
    if not e or e.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(e)
    db.commit()


@router.post("/support", status_code=status.HTTP_201_CREATED)
def support(payload: SupportIn, background: BackgroundTasks, user: User = Depends(current_user),
            db: Session = Depends(get_db)) -> dict:
    m = SupportMessage(user_id=user.id, text=payload.text.strip())
    db.add(m)
    db.commit()
    background.add_task(send_telegram, f"Обращение в поддержку от {user.name} <{user.email}>:\n{m.text}")
    return {"id": m.id}
