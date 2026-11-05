"""Метрики пилота: treatment против control, нагрузка учителя, опрос удобства."""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import require_role
from app.modules.analytics.models import SurveyResponse, TeacherTimeLog
from app.modules.analytics.service import TARGETS, group_metrics, workload_stats
from app.modules.school.access import class_students, get_class, visible_classes
from app.modules.school.models import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

LOCAL_TZ = timezone(timedelta(hours=5))


class ArmIn(BaseModel):
    arm: Literal["treatment", "control", ""]


@router.put("/classes/{class_id}/arm")
def set_arm(class_id: int, payload: ArmIn, user: User = Depends(require_role("admin")),
            db: Session = Depends(get_db)) -> dict:
    from app.modules.school.models import SchoolClass

    c = db.get(SchoolClass, class_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    c.arm = payload.arm
    db.commit()
    return {"class_id": c.id, "arm": c.arm}


@router.get("/pilot")
def pilot(user: User = Depends(require_role("teacher", "curator")), db: Session = Depends(get_db)) -> dict:
    """Метрики по группам treatment / control и North Star по классам, которые пользователь видит."""
    today = datetime.now(LOCAL_TZ).date()
    arms: dict[str, list[int]] = {"treatment": [], "control": []}
    for c in visible_classes(db, user):
        if c.arm in arms:
            arms[c.arm] += [s.id for s in class_students(db, c.id)]
    out = {arm: group_metrics(db, ids, today) for arm, ids in arms.items()}
    t, c = out["treatment"]["verified_gain"], out["control"]["verified_gain"]
    db.commit()
    return {**out, "north_star": round(t - c, 3) if t is not None and c is not None else None, "targets": TARGETS}


def _today() -> date:
    return datetime.now(LOCAL_TZ).date()


# --- Нагрузка учителя: минуты на проверку работ и разбор ошибок за день ---

WORKLOAD_BACKDATE_DAYS = 30  # можно внести прошлые дни — для baseline до старта пилота


class WorkloadIn(BaseModel):
    checking_min: int = Field(ge=0, le=720)
    errors_min: int = Field(ge=0, le=720)
    note: str = Field(default="", max_length=500)


def _log_out(r: TeacherTimeLog) -> dict:
    return {"day": r.day.isoformat(), "checking_min": r.checking_min, "errors_min": r.errors_min, "note": r.note,
            "phase": "before" if r.day < settings.pilot_start else "after"}


@router.get("/workload/me")
def my_workload(user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(TeacherTimeLog).where(TeacherTimeLog.teacher_id == user.id)
                      .order_by(TeacherTimeLog.day.desc()).limit(60))
    return {"entries": [_log_out(r) for r in rows], "stats": workload_stats(db, settings.pilot_start, [user.id]),
            "today": _today().isoformat(), "min_day": (_today() - timedelta(days=WORKLOAD_BACKDATE_DAYS)).isoformat()}


@router.put("/workload/{day}")
def save_workload(day: date, payload: WorkloadIn, user: User = Depends(require_role("teacher")),
                  db: Session = Depends(get_db)) -> dict:
    today = _today()
    if day > today or day < today - timedelta(days=WORKLOAD_BACKDATE_DAYS):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "bad_day")
    r = db.scalar(select(TeacherTimeLog).where(TeacherTimeLog.teacher_id == user.id, TeacherTimeLog.day == day))
    if not r:
        r = TeacherTimeLog(teacher_id=user.id, day=day)
        db.add(r)
    r.checking_min, r.errors_min, r.note = payload.checking_min, payload.errors_min, payload.note.strip()
    db.commit()
    return _log_out(r)


# --- Опрос удобства: раз в неделю, ученики и учителя ---

class SurveyIn(BaseModel):
    ease: int = Field(ge=1, le=5)
    useful: int = Field(ge=1, le=5)
    recommend: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


def _week() -> date:
    t = _today()
    return t - timedelta(days=t.weekday())


@router.get("/survey/me")
def my_survey(user: User = Depends(require_role("student", "teacher")), db: Session = Depends(get_db)) -> dict:
    r = db.scalar(select(SurveyResponse).where(SurveyResponse.user_id == user.id, SurveyResponse.week == _week()))
    return {"week": _week().isoformat(), "due": r is None,
            "answer": {"ease": r.ease, "useful": r.useful, "recommend": r.recommend, "comment": r.comment} if r else None}


@router.put("/survey")
def save_survey(payload: SurveyIn, user: User = Depends(require_role("student", "teacher")),
                db: Session = Depends(get_db)) -> dict:
    week = _week()
    r = db.scalar(select(SurveyResponse).where(SurveyResponse.user_id == user.id, SurveyResponse.week == week))
    if not r:
        r = SurveyResponse(user_id=user.id, week=week, role=user.role)
        db.add(r)
    r.ease, r.useful, r.recommend, r.comment = payload.ease, payload.useful, payload.recommend, payload.comment.strip()
    db.commit()
    return {"week": week.isoformat(), "due": False}
