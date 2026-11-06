"""Посещаемость: день засчитан, если в этот день ученик выполнил хотя бы один шаг плана дня.

Шаг выполнен в день D, если до конца D (по времени Казахстана) ученик ответил на все задания пункта
(закрепление, мини-проверка) или завершил занятие Tutor по теме пункта. Считаем по событиям, а не по
plan_items.done_at: тот проставляется при пересчёте и может оказаться позже настоящего дня.
"""
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.events.models import LearningEvent
from app.modules.plan import rules
from app.modules.plan.models import DailyPlan, PlanItem
from app.modules.school.models import User
from app.modules.tutor.models import TutorSession

LOCAL_TZ = timezone(timedelta(hours=5))  # Казахстан


def _start(d: date) -> datetime:
    return datetime.combine(d, time.min, LOCAL_TZ)


def present_days(db: Session, user_ids: list[int], first: date, last: date) -> dict[int, set[date]]:
    """Дни из [first, last], в которые ученик выполнил хотя бы один шаг плана."""
    return plan_days(db, user_ids, first, last)[0]


def plan_days(db: Session, user_ids: list[int], first: date, last: date) -> tuple[dict[int, set[date]], dict[int, set[date]]]:
    """(дни хотя бы с одним выполненным шагом, дни с полностью выполненным планом) из [first, last]."""
    out: dict[int, set[date]] = {u: set() for u in user_ids}
    full: dict[int, set[date]] = {u: set() for u in user_ids}
    if not user_ids:
        return out, full
    plans = list(db.scalars(select(DailyPlan).where(DailyPlan.user_id.in_(user_ids), DailyPlan.day >= first,
                                                    DailyPlan.day <= last)))
    if not plans:
        return out, full
    items: dict[int, list[PlanItem]] = {}
    for it in db.scalars(select(PlanItem).where(PlanItem.plan_id.in_([p.id for p in plans]))):
        items.setdefault(it.plan_id, []).append(it)
    lo, hi = _start(first), _start(last + timedelta(days=1))
    task_ids = {t for its in items.values() for it in its for t in (it.task_ids or [])}
    answers: dict[tuple[int, int], list[datetime]] = {}
    for uid, tid, at in db.execute(select(LearningEvent.user_id, LearningEvent.task_id, LearningEvent.created_at).where(
            LearningEvent.user_id.in_(user_ids), LearningEvent.task_id.in_(task_ids or [-1]),
            LearningEvent.created_at >= lo, LearningEvent.created_at < hi)):
        answers.setdefault((uid, tid), []).append(at)
    tutor: dict[tuple[int, int], list[tuple[datetime, datetime]]] = {}
    for uid, lid, created, finished in db.execute(select(
            TutorSession.user_id, TutorSession.lesson_id, TutorSession.created_at, TutorSession.finished_at).where(
            TutorSession.user_id.in_(user_ids), TutorSession.finished_at.is_not(None),
            TutorSession.finished_at >= lo, TutorSession.finished_at < hi)):
        tutor.setdefault((uid, lid), []).append((created, finished))

    for p in plans:
        since, until = max(p.created_at, _start(p.day)), _start(p.day + timedelta(days=1))

        def step_done(it: PlanItem) -> bool:
            if it.block == "tutor":
                return any(since <= c and f < until for c, f in tutor.get((p.user_id, it.lesson_id), []))
            return bool(it.task_ids) and all(
                any(since <= a < until for a in answers.get((p.user_id, t), [])) for t in it.task_ids)

        done = [step_done(it) for it in items.get(p.id, [])]
        if any(done):
            out[p.user_id].add(p.day)
        if done and all(done):
            full[p.user_id].add(p.day)
    return out, full


def is_day_off(d: date) -> bool:
    return d.weekday() in rules.ATTENDANCE_DAYS_OFF


def summary(user: User, present: set[date], first: date, today: date) -> dict:
    """Календарь и итоги. Выходной без занятий — не пропуск; сегодня без занятий — ещё не пропуск."""
    joined = user.created_at.astimezone(LOCAL_TZ).date() if user.created_at else first
    days, school_days, attended = [], 0, 0
    d = first
    while d <= today:
        if d < joined:
            st = "none"
        elif d in present:
            st = "present"
        elif is_day_off(d):
            st = "off"
        elif d == today:
            st = "today"
        else:
            st = "absent"
        if st in ("present", "absent") and not (st == "present" and is_day_off(d)):
            school_days += 1
            attended += st == "present"
        days.append({"day": d.isoformat(), "status": st})
        d += timedelta(days=1)
    # серия: подряд учебные дни с занятием; выходные не рвут серию, незаконченное «сегодня» тоже
    streak = 0
    for x in reversed(days):
        if x["status"] == "present":
            streak += 1
        elif x["status"] in ("off", "today"):
            continue
        else:
            break
    last = max(present) if present else None
    return {"days": days, "present": attended, "school_days": school_days,
            "rate": round(attended / school_days, 2) if school_days else None,
            "streak": streak, "today": today in present, "last_present": last.isoformat() if last else None}


STREAK_DAYS = 120  # окно для лучшей серии


def plan_streak(db: Session, user: User, today: date) -> dict:
    """Мотивация без рейтингов: учебные дни подряд с полностью выполненным планом и неделя пн–пт.
    Выходные серию не рвут, незаконченное «сегодня» тоже; день с частичным планом — рвёт."""
    first = today - timedelta(days=STREAK_DAYS - 1)
    present, full = plan_days(db, [user.id], first, today)
    return streak_summary(user, present[user.id], full[user.id], first, today)


def streak_summary(user: User, present: set[date], full: set[date], first: date, today: date) -> dict:
    joined = user.created_at.astimezone(LOCAL_TZ).date() if user.created_at else first

    def status(d: date) -> str:
        if d > today:
            return "future"
        if d in full:
            return "full"
        if d < joined:
            return "none"
        if is_day_off(d):
            return "off"
        if d == today:
            return "today_partial" if d in present else "today"
        return "partial" if d in present else "missed"

    best = run = current = 0
    d = max(first, joined)
    while d <= today:
        st = status(d)
        if st == "full":
            run += 1
            best = max(best, run)
        elif st not in ("off", "today", "today_partial"):
            run = 0
        d += timedelta(days=1)
    current = run
    monday = today - timedelta(days=today.weekday())
    week = [{"day": (monday + timedelta(days=i)).isoformat(), "status": status(monday + timedelta(days=i))} for i in range(5)]
    return {"current": current, "best": best, "week": week,
            "week_full": sum(w["status"] == "full" for w in week), "week_days": len(week)}


def attendance_for(db: Session, users: list[User], today: date, days: int) -> dict[int, dict]:
    first = today - timedelta(days=days - 1)
    present = present_days(db, [u.id for u in users], first, today)
    return {u.id: summary(u, present[u.id], first, today) for u in users}
