"""Живой экран урока для учителя (как Mission Control в SchoolAI): кто сейчас работает, кто застрял, кто позвал.

Только чтение по уже записанным событиям; ничего не решает за учителя и не меняет правила decision-v1.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.content.models import Lesson
from app.modules.decisions.models import Recommendation
from app.modules.events.models import LearningEvent
from app.modules.plan.attendance import LOCAL_TZ
from app.modules.plan.models import DailyPlan
from app.modules.plan.service import refresh_progress
from app.modules.school.models import SchoolClass, User
from app.modules.tutor.models import TutorMessage, TutorSession

ACTIVE_MIN = 10   # была активность за последние N минут — «работает»
STUCK_MIN = 15    # окно для «застрял»
STUCK_WRONG = 3   # столько неверных ответов подряд в окне
GROUP_MIN = 2     # застрявших на одной теме — предложить объяснить вместе


def _since_today(now: datetime) -> datetime:
    return datetime.combine(now.astimezone(LOCAL_TZ).date(), datetime.min.time(), LOCAL_TZ)


def class_live(db: Session, c: SchoolClass, students: list[User], now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    since = _since_today(now)
    ids = [s.id for s in students] or [-1]

    events: dict[int, list[tuple[datetime, int, bool]]] = {}
    for uid, at, lid, ok in db.execute(select(LearningEvent.user_id, LearningEvent.created_at, LearningEvent.lesson_id,
                                              LearningEvent.correct)
                                       .where(LearningEvent.user_id.in_(ids), LearningEvent.created_at >= since)
                                       .order_by(LearningEvent.created_at)):
        events.setdefault(uid, []).append((at, lid, ok))
    tutor_last: dict[int, tuple[datetime, int | None]] = {}
    for uid, at, lid in db.execute(select(TutorSession.user_id, TutorMessage.created_at, TutorSession.lesson_id)
                                   .join(TutorSession, TutorSession.id == TutorMessage.session_id)
                                   .where(TutorSession.user_id.in_(ids), TutorMessage.created_at >= since)
                                   .order_by(TutorMessage.created_at)):
        tutor_last[uid] = (at, lid)
    calls = {r.user_id: r for r in db.scalars(select(Recommendation).where(
        Recommendation.user_id.in_(ids), Recommendation.status == "new",
        Recommendation.rule.like("escalation:%"), Recommendation.created_at >= since))}
    plans = {p.user_id: p for p in db.scalars(select(DailyPlan).where(
        DailyPlan.user_id.in_(ids), DailyPlan.day == now.astimezone(LOCAL_TZ).date()))}
    lesson_ids = {lid for evs in events.values() for _, lid, _ in evs} | {lid for _, lid in tutor_last.values() if lid}
    lesson_ids |= {r.lesson_id for r in calls.values()}
    titles = {l.id: l.title for l in db.scalars(select(Lesson).where(Lesson.id.in_(lesson_ids or {-1})))}

    rows = []
    for s in students:
        evs = events.get(s.id, [])
        last_ev = evs[-1] if evs else None
        tl = tutor_last.get(s.id)
        last_at = max([x for x in (last_ev[0] if last_ev else None, tl[0] if tl else None) if x], default=None)
        lesson = (last_ev[1] if last_ev and (not tl or last_ev[0] >= tl[0]) else (tl[1] if tl else None))
        wrong = 0
        for at, _, ok in reversed(evs):
            if ok or at < now - timedelta(minutes=STUCK_MIN):
                break
            wrong += 1
        call = calls.get(s.id)
        if call:
            st = "called"
            lesson = call.lesson_id
        elif wrong >= STUCK_WRONG:
            st = "stuck"
        elif last_at and last_at >= now - timedelta(minutes=ACTIVE_MIN):
            st = "active"
        elif last_at:
            st = "idle"
        else:
            st = "absent"
        plan = plans.get(s.id)
        items = refresh_progress(db, plan) if plan else []
        rows.append({
            "id": s.id, "name": s.name, "status": st, "lesson_id": lesson, "lesson": titles.get(lesson),
            "answers": len(evs), "correct": sum(ok for _, _, ok in evs), "wrong_streak": wrong,
            "plan": round(sum(i.status == "done" for i in items) / len(items), 2) if items else None,
            "last_at": last_at.isoformat() if last_at else None,
            "call": {"reason": call.rule.split(":", 1)[1], "text": call.comment, "rec_id": call.id} if call else None,
        })
    db.commit()  # refresh_progress обновил статусы шагов плана

    order = {"called": 0, "stuck": 1, "active": 2, "idle": 3, "absent": 4}
    rows.sort(key=lambda r: (order[r["status"]], r["name"]))
    struggling: dict[int, list[str]] = {}
    for r in rows:
        if r["status"] in ("called", "stuck") and r["lesson_id"]:
            struggling.setdefault(r["lesson_id"], []).append(r["name"])
    answers = sum(r["answers"] for r in rows)
    return {
        "class": {"id": c.id, "name": c.name},
        "at": now.isoformat(),
        "counts": {k: sum(r["status"] == k for r in rows) for k in order},
        "accuracy": round(sum(r["correct"] for r in rows) / answers, 2) if answers else None,
        "groups": [{"lesson": titles.get(lid), "students": names} for lid, names in struggling.items() if len(names) >= GROUP_MIN],
        "students": rows,
    }
