"""Администратор: метрики пилота, расход AI, заявки, журнал действий."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_role
from app.modules.decisions.models import AuditLog, Recommendation
from app.modules.events.models import LearningEvent
from app.modules.leads.models import Lead
from app.modules.school.models import School, SchoolClass, User
from app.modules.tutor.models import TutorMessage, TutorSession
from app.modules.verification.models import AdviserCase, Check
from app.modules.verification.service import outcome_stats

router = APIRouter(prefix="/admin", tags=["admin"])

# $ за 1M токенов (вход, выход) — для оценки расхода AI Tutor
PRICES = {"claude-opus-5-5": (4.0, 20.0), "claude-sonnet-5-5": (2.0, 10.0), "claude-haiku-5-5": (0.1, 0.5)}


@router.get("/metrics")
def metrics(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    roles = dict(db.execute(select(User.role, func.count()).group_by(User.role)).all())
    active7 = db.scalar(select(func.count(func.distinct(LearningEvent.user_id))).where(
        LearningEvent.created_at >= now - timedelta(days=7))) or 0
    recs = dict(db.execute(select(Recommendation.status, func.count()).group_by(Recommendation.status)).all())
    decided = sum(recs.get(k, 0) for k in ("accepted", "changed", "rejected"))
    accepted = recs.get("accepted", 0) + recs.get("changed", 0)
    total_actionable = sum(v for k, v in recs.items() if k != "obsolete")
    days = []
    for d in range(13, -1, -1):
        start = (now - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        n = db.scalar(select(func.count()).select_from(LearningEvent).where(
            LearningEvent.created_at >= start, LearningEvent.created_at < start + timedelta(days=1))) or 0
        days.append({"day": start.date().isoformat(), "events": n})
    sources = dict(db.execute(select(LearningEvent.source, func.count()).group_by(LearningEvent.source)).all())
    checks = dict(db.execute(select(Check.status, func.count()).group_by(Check.status)).all())
    return {
        "users": roles, "schools": db.scalar(select(func.count()).select_from(School)) or 0,
        "classes": db.scalar(select(func.count()).select_from(SchoolClass)) or 0,
        "active_students_7d": active7, "events": sources, "activity": days,
        # метрики пилота (docs/PLAN.md, раздел 8)
        "independent_progress": outcome_stats(db),
        "recommendations": {"by_status": recs, "accepted_share": round(accepted / decided, 2) if decided else None,
                            "done_share": round(recs.get("done", 0) / total_actionable, 2) if total_actionable else None},
        "checks": checks,
        "adviser_open": db.scalar(select(func.count()).select_from(AdviserCase).where(AdviserCase.status != "closed")) or 0,
    }


@router.get("/ai")
def ai_usage(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(TutorMessage.model, func.count(), func.sum(TutorMessage.input_tokens),
                             func.sum(TutorMessage.output_tokens))
                      .where(TutorMessage.role == "assistant").group_by(TutorMessage.model)).all()
    models, cost = [], 0.0
    for model, n, tin, tout in rows:
        pin, pout = PRICES.get(model, (0, 0))
        c = ((tin or 0) * pin + (tout or 0) * pout) / 1_000_000
        cost += c
        models.append({"model": model, "replies": n, "input_tokens": tin or 0, "output_tokens": tout or 0, "cost_usd": round(c, 4)})
    sessions = dict(db.execute(select(TutorSession.result, func.count()).group_by(TutorSession.result)).all())
    return {"models": models, "cost_usd": round(cost, 4),
            "sessions": {str(k or "open"): v for k, v in sessions.items()}}


@router.get("/leads")
def leads(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    return [{"id": l.id, "name": l.name, "email": l.email, "phone": l.phone, "school": l.school, "role": l.role,
             "message": l.message, "created_at": l.created_at.isoformat()}
            for l in db.scalars(select(Lead).order_by(Lead.id.desc()).limit(300))]


@router.get("/audit")
def audit_log(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)) -> list[dict]:
    names = {u.id: u.name for u in db.scalars(select(User))}
    return [{"id": a.id, "actor": names.get(a.actor_id), "action": a.action, "entity": a.entity, "entity_id": a.entity_id,
             "data": a.data, "created_at": a.created_at.isoformat()}
            for a in db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(200))]
