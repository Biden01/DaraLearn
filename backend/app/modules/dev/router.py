"""Scrum-доска команды (как в Trello): колонки, карточки, исполнители, закрытие спринта."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_role
from app.modules.dev.models import DevTask
from app.modules.school.models import User

router = APIRouter(prefix="/dev", tags=["dev"])

COLUMNS = ("backlog", "todo", "doing", "review", "done")
TEAM = ("era", "daul", "ali", "gala")
Column = Literal["backlog", "todo", "doing", "review", "done"]
Assignee = Literal["", "era", "daul", "ali", "gala"]
Label = Literal["", "feature", "bug", "design", "content", "infra"]


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=5000)
    column: Column = "backlog"
    assignee: Assignee = ""
    points: int = Field(default=0, ge=0, le=100)
    label: Label = ""


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    column: Column | None = None
    position: float | None = None
    assignee: Assignee | None = None
    points: int | None = Field(default=None, ge=0, le=100)
    label: Label | None = None


def out(t: DevTask) -> dict:
    return {"id": t.id, "title": t.title, "description": t.description, "column": t.column, "position": t.position,
            "assignee": t.assignee, "points": t.points, "label": t.label, "sprint": t.sprint,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None}


def get_task(db: Session, task_id: int) -> DevTask:
    t = db.get(DevTask, task_id)
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    return t


def current_sprint(db: Session) -> int:
    return (db.scalar(select(func.max(DevTask.sprint))) or 0) + 1


def board_stamp(db: Session) -> str:
    """Версия доски: меняется при любом создании, правке, удалении карточки и закрытии спринта
    (count ловит удаление, max(updated_at) — правки, включая уход карточек в архив спринта)."""
    n, last = db.execute(select(func.count(), func.max(DevTask.updated_at))).one()
    return f"{n}:{last.isoformat() if last else '-'}"


@router.get("/board")
def board(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    tasks = db.scalars(select(DevTask).where(DevTask.sprint.is_(None)).order_by(DevTask.position, DevTask.id))
    return {"sprint": current_sprint(db), "columns": list(COLUMNS), "team": list(TEAM), "tasks": [out(t) for t in tasks],
            "stamp": board_stamp(db)}


@router.get("/board/stamp")
def stamp(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    """Дешёвый опрос для обновления доски в реальном времени: клиент перезагружает доску, только если stamp сменился."""
    return {"stamp": board_stamp(db)}


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    last = db.scalar(select(func.max(DevTask.position)).where(DevTask.column == payload.column, DevTask.sprint.is_(None)))
    t = DevTask(**payload.model_dump(), position=(last or 0) + 1)
    db.add(t)
    db.commit()
    return out(t)


@router.patch("/tasks/{task_id}")
def update_task(task_id: int, payload: TaskPatch, user: User = Depends(require_role("admin")),
                db: Session = Depends(get_db)) -> dict:
    t = get_task(db, task_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(t, k, v)
    db.commit()
    return out(t)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> None:
    db.delete(get_task(db, task_id))
    db.commit()


@router.post("/sprint/close")
def close_sprint(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    """Готовые карточки уходят в архив спринта, остальные остаются на доске."""
    n = current_sprint(db)
    done = list(db.scalars(select(DevTask).where(DevTask.column == "done", DevTask.sprint.is_(None))))
    for t in done:
        t.sprint = n
    db.commit()
    return {"sprint": n, "closed": len(done), "points": sum(t.points for t in done)}


@router.get("/sprints")
def sprints(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(select(DevTask.sprint, func.count(), func.sum(DevTask.points))
                      .where(DevTask.sprint.is_not(None)).group_by(DevTask.sprint).order_by(DevTask.sprint.desc())).all()
    return [{"sprint": s, "tasks": n, "points": p or 0} for s, n, p in rows]
