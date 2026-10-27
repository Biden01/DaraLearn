"""Метрики пилота. North Star — Incremental Verified Learning Gain: рост treatment минус рост control."""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.decisions.models import Recommendation
from app.modules.events.models import LearningEvent
from app.modules.plan.models import DailyPlan, PlanItem
from app.modules.plan.service import refresh_progress
from app.modules.state.engine import compute_states
from app.modules.tutor.models import TutorSession
from app.modules.verification.service import outcome_stats

TARGETS = {"plan_completion": 0.6, "recommendation_useful": 0.6}


def _mean(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 3) if xs else None


def _baseline(db: Session, user_id: int) -> dict[int, bool]:
    """Первый независимый ответ ученика по каждому навыку (диагностика или ПҚС): точка отсчёта."""
    rows = db.execute(select(LearningEvent.lesson_id, LearningEvent.correct).where(
        LearningEvent.user_id == user_id, LearningEvent.source != "practice").order_by(LearningEvent.id)).all()
    first: dict[int, bool] = {}
    for lesson_id, correct in rows:
        first.setdefault(lesson_id, correct)
    return first


def verified_gain(db: Session, user_id: int) -> float | None:
    """Рост подтверждённого результата: текущий verified proof минус первый независимый ответ по тому же навыку.

    Считаются только навыки, по которым уже есть подтверждённый результат после baseline."""
    now = compute_states(db, user_id)
    deltas = [now[l].verified - float(b) for l, b in _baseline(db, user_id).items()
              if l in now and now[l].n_verified > 1]
    return _mean(deltas)


def plan_completion(db: Session, user_ids: list[int], today: date) -> float | None:
    plans = list(db.scalars(select(DailyPlan).where(DailyPlan.user_id.in_(user_ids or [-1]), DailyPlan.day <= today)))
    done = total = 0
    for p in plans:
        items = refresh_progress(db, p)
        total += len(items)
        done += sum(i.status == "done" for i in items)
    return round(done / total, 3) if total else None


def group_metrics(db: Session, user_ids: list[int], today: date) -> dict:
    now = datetime.now(timezone.utc)
    gains = [g for g in (verified_gain(db, uid) for uid in user_ids) if g is not None]
    gaps = []
    for uid in user_ids:
        gaps += [s.gap for s in compute_states(db, uid).values() if s.gap is not None]
    recs = dict(db.execute(select(Recommendation.status, func.count()).where(
        Recommendation.user_id.in_(user_ids or [-1])).group_by(Recommendation.status)).all())
    decided = sum(recs.get(k, 0) for k in ("accepted", "changed", "rejected"))
    sessions = db.scalar(select(func.count()).select_from(TutorSession).where(
        TutorSession.user_id.in_(user_ids or [-1]), TutorSession.created_at >= now - timedelta(days=7))) or 0
    return {
        "students": len(user_ids),
        "plan_completion": plan_completion(db, user_ids, today),
        "recommendation_useful": round((recs.get("accepted", 0) + recs.get("changed", 0)) / decided, 3) if decided else None,
        "intervention": outcome_stats(db, set(user_ids)),
        "tutor_sessions_per_student_week": round(sessions / len(user_ids), 2) if user_ids else None,
        "practice_verified_gap": _mean(gaps),
        "verified_gain": _mean(gains),
        "students_with_gain": len(gains),
    }
