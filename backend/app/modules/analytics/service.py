"""Метрики пилота. North Star — Incremental Verified Learning Gain: рост treatment минус рост control."""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.analytics.models import SurveyResponse, TeacherTimeLog
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


# --- Нагрузка учителя и опрос удобства (docs/PLAN.md, раздел 7) ---

def workload_stats(db: Session, pilot_start: date, teacher_ids: list[int] | None = None) -> dict:
    """Среднее время учителя в день до старта пилота и после; change — относительное изменение суммы минут."""
    q = select(TeacherTimeLog)
    if teacher_ids is not None:
        q = q.where(TeacherTimeLog.teacher_id.in_(teacher_ids or [-1]))
    phases: dict[str, list] = {"before": [], "after": []}
    for r in db.scalars(q):
        phases["before" if r.day < pilot_start else "after"].append(r)

    def agg(rows: list) -> dict:
        return {"days": len(rows), "teachers": len({r.teacher_id for r in rows}),
                "checking": _mean([r.checking_min for r in rows]), "errors": _mean([r.errors_min for r in rows]),
                "total": _mean([r.checking_min + r.errors_min for r in rows])}

    out = {k: agg(v) for k, v in phases.items()}
    b, a = out["before"]["total"], out["after"]["total"]
    out["change"] = round((a - b) / b, 3) if a is not None and b else None
    out["pilot_start"] = pilot_start.isoformat()
    return out


def survey_stats(db: Session) -> dict:
    """Средние оценки опроса (1–5) по ролям и последние комментарии."""
    rows = list(db.scalars(select(SurveyResponse).order_by(SurveyResponse.id.desc())))
    by_role = {}
    for role in ("student", "teacher"):
        rs = [r for r in rows if r.role == role]
        by_role[role] = {"n": len(rs), "users": len({r.user_id for r in rs}),
                         **{k: _mean([getattr(r, k) for r in rs]) for k in ("ease", "useful", "recommend")}}
    comments = [{"role": r.role, "week": r.week.isoformat(), "text": r.comment} for r in rows if r.comment.strip()][:10]
    return {**by_role, "comments": comments}
