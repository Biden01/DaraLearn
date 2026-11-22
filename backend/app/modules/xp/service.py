"""Опыт (XP) и ранги ученика — личный прогресс, без сравнения с другими учениками.

Опыт не хранится счётчиком: при каждом запросе мы пересматриваем, что ученик сделал, и дописываем в журнал
xp_awards недостающие начисления. Уникальный ключ начисления не даёт засчитать одно действие дважды,
а уже начисленный опыт не пропадает, даже если данные потом пересчитаются (например, навык снова стал «пробелом»).
"""
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.events.models import LearningEvent
from app.modules.plan.attendance import LOCAL_TZ, is_day_off, present_days
from app.modules.plan.models import DailyPlan, PlanItem
from app.modules.plan.service import refresh_progress
from app.modules.school.models import StreakFreezeUse, User
from app.modules.state.engine import compute_states
from app.modules.xp.models import XpAward

XP_TASK = 5           # верно решённое задание (каждое — не чаще раза в день)
XP_PLAN_STEP = 15     # выполненный шаг плана дня
XP_PLAN_DAY = 25      # бонус: выполнен весь план дня
XP_DAY = 10           # учебный день без пропуска (выполнен хотя бы один шаг плана)
XP_STREAK_STEP = 2    # бонус за серию: +2 за каждый день серии…
XP_STREAK_MAX = 20    # …но не больше +20 в день
XP_MASTERED = 50      # навык впервые подтверждён («освоен»)

# Порог опыта каждого ранга; названия и рамки — на фронтенде (по номеру ранга).
RANKS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500]


def _local_day(at: datetime) -> date:
    return at.astimezone(LOCAL_TZ).date()


def _streak_bonus(streak: int) -> int:
    return min(XP_STREAK_MAX, XP_STREAK_STEP * (streak - 1)) if streak > 1 else 0


def _day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, LOCAL_TZ)


def due_awards(db: Session, user: User, today: date) -> dict[str, tuple[str, int, datetime]]:
    """Все начисления, которые ученик заработал на сегодня: key → (kind, xp, когда)."""
    out: dict[str, tuple[str, int, datetime]] = {}
    now = datetime.now(timezone.utc)

    for task_id, at in db.execute(select(LearningEvent.task_id, LearningEvent.created_at).where(
            LearningEvent.user_id == user.id, LearningEvent.correct.is_(True)).order_by(LearningEvent.id.desc())):
        out[f"task:{task_id}:{_local_day(at).isoformat()}"] = ("task", XP_TASK, at)  # по убыванию: останется первый ответ дня

    plans = list(db.scalars(select(DailyPlan).where(DailyPlan.user_id == user.id)))
    today_plan = next((p for p in plans if p.day == today), None)
    if today_plan:
        refresh_progress(db, today_plan)  # прошлые планы уже пересчитаны, когда ученик их открывал
    items: dict[int, list[PlanItem]] = {}
    for it in db.scalars(select(PlanItem).where(PlanItem.plan_id.in_([p.id for p in plans] or [-1]))):
        items.setdefault(it.plan_id, []).append(it)
    for p in plans:
        its = items.get(p.id, [])
        for it in its:
            if it.status == "done":
                out[f"plan_step:{it.id}"] = ("plan_step", XP_PLAN_STEP, it.done_at or now)
        if its and all(it.status == "done" for it in its):
            out[f"plan_day:{p.id}"] = ("plan_day", XP_PLAN_DAY, max(it.done_at or now for it in its))

    # дни без пропусков и серия — по тем же правилам, что посещаемость (plan/attendance.py)
    joined = _local_day(user.created_at) if user.created_at else today
    present = present_days(db, [user.id], joined, today)[user.id]
    frozen = set(db.scalars(select(StreakFreezeUse.day).where(StreakFreezeUse.user_id == user.id)))
    streak, d = 0, joined
    while d <= today:
        if d in present:
            streak += 1
            out[f"day:{d.isoformat()}"] = ("attendance", XP_DAY + _streak_bonus(streak), _day_start(d))
        elif d in frozen:
            streak += 1
        elif not is_day_off(d) and d != today:
            streak = 0
        d += timedelta(days=1)

    for lesson_id, s in compute_states(db, user.id).items():
        if s.status == "mastered":
            out[f"mastered:{lesson_id}"] = ("mastered", XP_MASTERED, now)
    return out


def sync(db: Session, user: User, today: date) -> None:
    due = due_awards(db, user, today)
    have = set(db.scalars(select(XpAward.key).where(XpAward.user_id == user.id)))
    rows = [{"user_id": user.id, "key": k, "kind": kind, "xp": xp, "created_at": at}
            for k, (kind, xp, at) in due.items() if k not in have]
    if rows:
        # параллельный запрос мог уже записать те же начисления — их просто пропускаем
        db.execute(insert(XpAward).values(rows).on_conflict_do_nothing(index_elements=["user_id", "key"]))
    db.commit()


def rank_of(xp: int) -> int:
    """Номер ранга с 1."""
    return sum(xp >= t for t in RANKS)


def summary(db: Session, user: User, today: date) -> dict:
    sync(db, user, today)
    xp = db.scalar(select(func.coalesce(func.sum(XpAward.xp), 0)).where(XpAward.user_id == user.id)) or 0
    rank = rank_of(xp)
    week_start = today - timedelta(days=today.weekday())
    week = db.scalar(select(func.coalesce(func.sum(XpAward.xp), 0)).where(
        XpAward.user_id == user.id,
        XpAward.created_at >= _day_start(week_start))) or 0
    by_kind = dict(db.execute(select(XpAward.kind, func.sum(XpAward.xp)).where(XpAward.user_id == user.id)
                              .group_by(XpAward.kind)).all())
    return {"xp": xp, "rank": rank, "ranks": RANKS,
            "rank_xp": RANKS[rank - 1], "next_xp": RANKS[rank] if rank < len(RANKS) else None,
            "week": week, "by_kind": by_kind,
            "rules": {"task": XP_TASK, "plan_step": XP_PLAN_STEP, "plan_day": XP_PLAN_DAY, "attendance": XP_DAY,
                      "streak_max": XP_STREAK_MAX, "mastered": XP_MASTERED}}
