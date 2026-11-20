"""«Показать решение»: фото-проверка проверочных заданий (PLAN.md §9 #6).
Все эндпоинты отвечают 503, пока settings.bookwork_check_enabled не включён."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.content.models import Task
from app.modules.school.access import class_students, get_student, visible_classes
from app.modules.school.models import User
from app.modules.school.router import audit
from app.modules.verification import bookwork_service as svc
from app.modules.verification.models import Attempt, BookworkCheck


def _require_enabled() -> None:
    if not settings.bookwork_check_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "bookwork_disabled")


router = APIRouter(prefix="/bookwork", tags=["verification"], dependencies=[Depends(_require_enabled)])


def _check_out(c: BookworkCheck) -> dict:
    return {"id": c.id, "attempt_id": c.attempt_id, "task_id": c.task_id, "status": c.status,
            "ai_verdict": c.ai_verdict, "ai_reason": c.ai_reason, "teacher_note": c.teacher_note,
            "created_at": c.created_at.isoformat(), "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None}


@router.post("/attempts/{attempt_id}/tasks/{task_id}/photo", status_code=status.HTTP_201_CREATED)
async def upload_photo(attempt_id: int, task_id: int, file: UploadFile = File(...),
                       user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    a = db.get(Attempt, attempt_id)
    if not a or a.user_id != user.id or a.kind != "verification" or task_id not in a.task_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    task = db.get(Task, task_id)
    if file.content_type not in svc.ALLOWED_MIME:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "only jpeg/png")
    content = await file.read()
    if len(content) > settings.bookwork_max_photo_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "photo_too_large")
    check = svc.save_photo(db, user.id, attempt_id, task, content, svc.ALLOWED_MIME[file.content_type])
    svc.review(db, check, content, file.content_type)
    db.commit()
    return _check_out(check)


@router.get("/mine")
def my_checks(attempt_id: int | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(BookworkCheck).where(BookworkCheck.user_id == user.id)
    if attempt_id:
        stmt = stmt.where(BookworkCheck.attempt_id == attempt_id)
    return [_check_out(c) for c in db.scalars(stmt.order_by(BookworkCheck.created_at.desc()))]


@router.get("/queue")
def queue(user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> list[dict]:
    students = {s.id for c in visible_classes(db, user) for s in class_students(db, c.id)}
    return [{**_check_out(c), "student": {"id": c.user_id, "name": db.get(User, c.user_id).name}}
            for c in svc.queue_for(db, students)]


class DecisionIn(BaseModel):
    approve: bool
    note: str = ""


@router.post("/{check_id}/decision")
def decision(check_id: int, payload: DecisionIn, user: User = Depends(require_role("teacher")),
            db: Session = Depends(get_db)) -> dict:
    c = db.get(BookworkCheck, check_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    get_student(db, user, c.user_id)  # доступ: ученик должен быть виден учителю
    if c.status != "flagged":
        raise HTTPException(status.HTTP_409_CONFLICT, "not_pending")
    svc.decide(db, c, user.id, payload.approve, payload.note)
    audit(db, user, "bookwork.decision", "bookwork_check", c.id, approve=str(payload.approve))
    db.commit()
    return _check_out(c)


@router.get("/{check_id}/image")
def image(check_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> FileResponse:
    c = db.get(BookworkCheck, check_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if c.user_id != user.id:
        get_student(db, user, c.user_id)  # иначе — 404, если ученик не виден этому пользователю
    return FileResponse(svc.storage_dir() / c.image_path)
