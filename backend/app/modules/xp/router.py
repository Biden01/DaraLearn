from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_role
from app.modules.plan.attendance import LOCAL_TZ
from app.modules.school.access import get_student
from app.modules.school.models import User
from app.modules.xp import service

router = APIRouter(prefix="/xp", tags=["xp"])


def _today():
    return datetime.now(LOCAL_TZ).date()


@router.get("/me")
def my_xp(user: User = Depends(require_role("student")), db: Session = Depends(get_db)) -> dict:
    return service.summary(db, user, _today())


@router.get("/students/{student_id}")
def student_xp(student_id: int, user: User = Depends(require_role("teacher", "curator", "parent")),
               db: Session = Depends(get_db)) -> dict:
    s = get_student(db, user, student_id)
    if s.role != "student":
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return service.summary(db, s, _today())
