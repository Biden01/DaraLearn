"""Метрики пилота: treatment против control, замер времени учителя, опрос удобства."""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_role
from app.modules.analytics import feedback
from app.modules.analytics.models import SurveyResponse, TeacherTimeLog
from app.modules.analytics.service import TARGETS, group_metrics
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


# ---------- Нагрузка учителя: минуты в неделю на проверку работ и разбор ошибок ----------

class TimeLogIn(BaseModel):
    week: date  # любой день недели — сохраняется понедельник
    phase: Literal["before", "after"]
    check_minutes: int = Field(ge=0, le=3000)
    review_minutes: int = Field(ge=0, le=3000)
    note: str = Field(default="", max_length=1000)


@router.get("/time")
def my_time(user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> dict:
    week = feedback.week_start(datetime.now(LOCAL_TZ).date())
    logs = db.scalars(select(TeacherTimeLog).where(TeacherTimeLog.user_id == user.id).order_by(TeacherTimeLog.week.desc()))
    return {"pilot_start": feedback.PILOT_START.isoformat(), "week": week.isoformat(),
            "suggested_phase": feedback.suggested_phase(week), "items": [feedback.time_log_out(x) for x in logs]}


@router.put("/time")
def save_time(payload: TimeLogIn, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> dict:
    """Одна запись на неделю: повторное сохранение той же недели её обновляет."""
    week = feedback.week_start(payload.week)
    if week > datetime.now(LOCAL_TZ).date():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "future_week")
    x = db.scalar(select(TeacherTimeLog).where(TeacherTimeLog.user_id == user.id, TeacherTimeLog.week == week))
    if not x:
        x = TeacherTimeLog(user_id=user.id, week=week)
        db.add(x)
    x.phase, x.check_minutes, x.review_minutes, x.note = (payload.phase, payload.check_minutes, payload.review_minutes,
                                                          payload.note.strip())
    db.commit()
    return feedback.time_log_out(x)


@router.delete("/time/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time(log_id: int, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> None:
    x = db.get(TeacherTimeLog, log_id)
    if not x or x.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(x)
    db.commit()


# ---------- Опрос удобства: ученики и учителя ----------

class SurveyIn(BaseModel):
    answers: dict[str, int]
    comment: str = Field(default="", max_length=2000)

    @field_validator("answers")
    @classmethod
    def _scale(cls, v: dict[str, int]) -> dict[str, int]:
        if any(not 1 <= x <= 5 for x in v.values()):
            raise ValueError("answers must be 1..5")
        return v


def _survey_out(user: User, r: SurveyResponse | None) -> dict:
    return {"survey": feedback.SURVEY, "questions": feedback.QUESTIONS[user.role], "answered": r is not None,
            "answers": r.answers if r else {}, "comment": r.comment if r else ""}


@router.get("/survey")
def my_survey(user: User = Depends(require_role("student", "teacher")), db: Session = Depends(get_db)) -> dict:
    r = db.scalar(select(SurveyResponse).where(SurveyResponse.user_id == user.id, SurveyResponse.survey == feedback.SURVEY))
    return _survey_out(user, r)


@router.put("/survey")
def answer_survey(payload: SurveyIn, user: User = Depends(require_role("student", "teacher")),
                  db: Session = Depends(get_db)) -> dict:
    """Нужны оценки на все вопросы роли; ответ можно изменить, пока идёт эта волна опроса."""
    qs = feedback.QUESTIONS[user.role]
    if set(payload.answers) != set(qs):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "answers_mismatch")
    r = db.scalar(select(SurveyResponse).where(SurveyResponse.user_id == user.id, SurveyResponse.survey == feedback.SURVEY))
    if not r:
        r = SurveyResponse(user_id=user.id, survey=feedback.SURVEY)
        db.add(r)
    r.role, r.answers, r.comment = user.role, {q: payload.answers[q] for q in qs}, payload.comment.strip()
    db.commit()
    return _survey_out(user, r)


@router.get("/feedback")
def feedback_summary(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    """Для страницы «Метрики»: нагрузка учителя до/после и итоги опроса."""
    return {"workload": feedback.workload_summary(db), "survey": feedback.survey_summary(db)}
