"""Outcome Engine и Adviser Lite: отложенные проверки после помощи, результат «до/после», случаи для куратора."""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.decisions.models import Recommendation
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states
from app.modules.verification.models import AdviserCase, Attempt, Check, Outcome

PLAN_WINDOW_DAYS = 14
PLAN_MIN_ITEMS = 2
PLAN_RATE_LIMIT = 0.5
WATCH_DAYS = 14


def schedule_check(db: Session, user_id: int, lesson_id: int, reason: str, rec_id: int | None = None,
                   due: datetime | None = None) -> Check | None:
    """Назначить проверку навыка (если такой ещё не ждёт). before — независимый proof на момент помощи."""
    pending = db.scalar(select(Check).where(Check.user_id == user_id, Check.lesson_id == lesson_id, Check.status == "pending"))
    if pending:
        return None
    before = compute_states(db, user_id).get(lesson_id, SkillState()).indep
    c = Check(user_id=user_id, lesson_id=lesson_id, reason=reason, recommendation_id=rec_id, before_proof=before,
              due_at=due or datetime.now(timezone.utc) + timedelta(hours=settings.check_delay_hours))
    db.add(c)
    db.flush()
    return c


def complete_check(db: Session, attempt: Attempt) -> Outcome | None:
    """После проверочного теста, начатого из отложенной проверки, — записать Outcome."""
    c = db.scalar(select(Check).where(Check.attempt_id == attempt.id, Check.status == "pending"))
    if not c:
        return None
    after = compute_states(db, attempt.user_id).get(c.lesson_id, SkillState()).indep
    c.status, c.done_at = "done", datetime.now(timezone.utc)
    o = Outcome(user_id=c.user_id, lesson_id=c.lesson_id, check_id=c.id, reason=c.reason, before=c.before_proof,
                after=after, helped=after > c.before_proof or after >= 0.8)
    db.add(o)
    if c.recommendation_id and o.helped:
        r = db.get(Recommendation, c.recommendation_id)
        if r and r.status != "done":
            r.status, r.done_at = "done", c.done_at
    db.flush()
    return o


def plan_rate(db: Session, user_id: int, now: datetime | None = None) -> tuple[float, int]:
    """Выполнение плана за период: назначенные проверки, срок которых прошёл, и рекомендации старше недели."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=PLAN_WINDOW_DAYS)
    checks = list(db.scalars(select(Check).where(Check.user_id == user_id, Check.due_at >= since, Check.due_at <= now)))
    recs = list(db.scalars(select(Recommendation).where(
        Recommendation.user_id == user_id, Recommendation.created_at >= since,
        Recommendation.created_at <= now - timedelta(days=7), Recommendation.status != "obsolete")))
    total = len(checks) + len(recs)
    done = sum(c.status == "done" for c in checks) + sum(r.status == "done" for r in recs)
    return (done / total if total else 1.0), total


def refresh_cases(db: Session, students: list[User]) -> None:
    """Открыть случай, если план выполняется меньше чем на 50%; закрыть «наблюдение», если план выполняется."""
    from app.modules.plan.service import adherence, needs_curator  # ленивый импорт: plan зависит от verification

    today = date.today()
    for s in students:
        rate, total = plan_rate(db, s.id)
        case = db.scalar(select(AdviserCase).where(AdviserCase.user_id == s.id, AdviserCase.status != "closed"))
        if needs_curator(db, s.id, today):
            d_rate, d_days, d_miss = adherence(db, s.id, today)
            if case is None:
                db.add(AdviserCase(user_id=s.id, school_id=s.school_id, plan_rate=round(d_rate, 2),
                                   reason=f"daily plan {round(d_rate * 100)}% / {d_days} d, missed {d_miss}"))
            else:
                case.plan_rate = round(d_rate, 2)
        elif total >= PLAN_MIN_ITEMS and rate < PLAN_RATE_LIMIT:
            if case is None:
                db.add(AdviserCase(user_id=s.id, school_id=s.school_id, plan_rate=round(rate, 2),
                                   reason=f"plan {round(rate * 100)}% / {total}"))
            else:
                case.plan_rate = round(rate, 2)
        elif case and case.status == "watching" and case.watch_until and case.watch_until <= today and rate >= PLAN_RATE_LIMIT:
            case.status = "closed"
    db.flush()


def outcome_stats(db: Session, user_ids: set[int] | None = None) -> dict:
    stmt = select(Outcome)
    if user_ids is not None:
        stmt = stmt.where(Outcome.user_id.in_(user_ids or {-1}))
    rows = list(db.scalars(stmt))
    return {"total": len(rows), "helped": sum(o.helped for o in rows),
            "avg_delta": round(sum(o.after - o.before for o in rows) / len(rows), 2) if rows else None}


def pending_checks(db: Session, user_id: int) -> list[Check]:
    return list(db.scalars(select(Check).where(Check.user_id == user_id, Check.status == "pending").order_by(Check.due_at)))


def count_checks_due(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Check).where(
        Check.user_id == user_id, Check.status == "pending", Check.due_at <= datetime.now(timezone.utc))) or 0
