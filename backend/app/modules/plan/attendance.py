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
from app.modules.school.models import StreakFreezeUse, User
from app.modules.tutor.models import TutorSession

LOCAL_TZ = timezone(timedelta(hours=5))  # Казахстан
MAX_STREAK_FREEZES = 2
FREEZE_MILESTONE_DAYS = 7  # каждые 7 дней серии — +1 заморозка, до MAX_STREAK_FREEZES


def _start(d: date) -> datetime:
    return datetime.combine(d, time.min, LOCAL_TZ)


def present_days(db: Session, user_ids: list[int], first: date, last: date) -> dict[int, set[date]]:
    """Дни из [first, last], в которые ученик выполнил хотя бы один шаг плана."""
    out: dict[int, set[date]] = {u: set() for u in user_ids}
    if not user_ids:
        return out
    plans = list(db.scalars(select(DailyPlan).where(DailyPlan.user_id.in_(user_ids), DailyPlan.day >= first,
                                                    DailyPlan.day <= last)))
    if not plans:
        return out
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

        if any(step_done(it) for it in items.get(p.id, [])):
            out[p.user_id].add(p.day)
    return out


def is_day_off(d: date) -> bool:
    return d.weekday() in rules.ATTENDANCE_DAYS_OFF


def summary(user: User, present: set[date], first: date, today: date, frozen: set[date], balance: int) -> dict:
    """Календарь и итоги. Выходной без занятий — не пропуск; сегодня без занятий — ещё не пропуск.
    Один пропущенный учебный день подряд может спасти заморозка серии (streak freeze), если она есть — но только
    самый свежий одиночный пропуск, идущий подряд два дня она не спасает (как в большинстве приложений)."""
    joined = user.created_at.astimezone(LOCAL_TZ).date() if user.created_at else first
    days_list, school_days, attended = [], 0, 0
    d = first
    while d <= today:
        if d < joined:
            st = "none"
        elif d in present:
            st = "present"
        elif d in frozen:
            st = "frozen"
        elif is_day_off(d):
            st = "off"
        elif d == today:
            st = "today"
        else:
            st = "absent"
        if st in ("present", "absent", "frozen") and not is_day_off(d):
            school_days += 1
            attended += st in ("present", "frozen")
        days_list.append({"day": d.isoformat(), "status": st})
        d += timedelta(days=1)
    # серия: подряд учебные дни с занятием (или спасённые заморозкой); выходные и «сегодня» без занятий не рвут её
    streak, used_freeze, newly_frozen = 0, False, None
    for x in reversed(days_list):
        if x["status"] in ("present", "frozen"):
            streak += 1
        elif x["status"] in ("off", "today"):
            continue
        elif x["status"] == "absent" and not used_freeze and balance > 0:
            x["status"] = "frozen"
            newly_frozen = x["day"]
            used_freeze = True
            streak += 1
        else:
            break
    last = max(present) if present else None
    return {"days": days_list, "present": attended, "school_days": school_days,
            "rate": round(attended / school_days, 2) if school_days else None,
            "streak": streak, "today": today in present, "last_present": last.isoformat() if last else None,
            "newly_frozen": date.fromisoformat(newly_frozen) if newly_frozen else None,
            "freezes": balance - (1 if used_freeze else 0)}


def attendance_for(db: Session, users: list[User], today: date, days: int) -> dict[int, dict]:
    first = today - timedelta(days=days - 1)
    present = present_days(db, [u.id for u in users], first, today)
    user_ids = [u.id for u in users]
    frozen_by_user: dict[int, set[date]] = {uid: set() for uid in user_ids}
    if user_ids:
        for uid, d in db.execute(select(StreakFreezeUse.user_id, StreakFreezeUse.day).where(
                StreakFreezeUse.user_id.in_(user_ids), StreakFreezeUse.day >= first, StreakFreezeUse.day <= today)):
            frozen_by_user[uid].add(d)

    out: dict[int, dict] = {}
    dirty = False
    for u in users:
        s = summary(u, present[u.id], first, today, frozen_by_user[u.id], u.streak_freezes)
        if s["newly_frozen"]:
            db.add(StreakFreezeUse(user_id=u.id, day=s["newly_frozen"]))
            dirty = True
        milestone = s["streak"] // FREEZE_MILESTONE_DAYS
        new_freezes = min(MAX_STREAK_FREEZES, s["freezes"] + max(0, milestone - u.freeze_milestone))
        if new_freezes != u.streak_freezes or milestone > u.freeze_milestone:
            u.streak_freezes = new_freezes
            u.freeze_milestone = max(u.freeze_milestone, milestone)
            dirty = True
        s["freezes"] = u.streak_freezes
        del s["newly_frozen"]
        out[u.id] = s
    if dirty:
        db.commit()
    return out
