"""Proof Engine и Student State: уверенность оценки, динамика, последняя проверка; практика и независимая проверка учитываются отдельно."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user
from app.modules.content.service import lessons_of, subject_by_slug
from app.modules.decisions.engine import decide, next_step, tutor_sessions_by_lesson
from app.modules.events.models import LearningEvent
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states
from app.modules.verification.models import Attempt

router = APIRouter(prefix="/state", tags=["state"])

LOCAL_TZ = timezone(timedelta(hours=5))  # Казахстан


def _local_day(dt: datetime) -> date:
    return dt.astimezone(LOCAL_TZ).date()


@router.get("/me")
def dashboard(subject: str = "math", user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    subj = subject_by_slug(db, subject)
    lessons = lessons_of(db, subj.id)
    states = compute_states(db, user.id)
    recs = decide(lessons, states, tutor_sessions_by_lesson(db, user.id))
    st = [states.get(l.id, SkillState()) for l in lessons]

    # активность: число ответов по дням
    today = datetime.now(LOCAL_TZ).date()
    since = datetime.combine(today - timedelta(days=370), datetime.min.time(), LOCAL_TZ)
    events = db.execute(select(LearningEvent.created_at, LearningEvent.correct, LearningEvent.source)
                        .where(LearningEvent.user_id == user.id, LearningEvent.created_at >= since)).all()
    per_day: dict[date, int] = {}
    for at, _, _ in events:
        d = _local_day(at)
        per_day[d] = per_day.get(d, 0) + 1
    week_start = today - timedelta(days=today.weekday())
    week = [per_day.get(week_start + timedelta(days=i), 0) for i in range(7)]
    month = [sum(per_day.get(today - timedelta(days=7 * w + i), 0) for i in range(7)) for w in range(3, -1, -1)]
    year = []
    for m in range(5, -1, -1):
        y, mo = today.year, today.month - m
        while mo <= 0:
            y, mo = y - 1, mo + 12
        year.append({"m": mo, "v": sum(v for d, v in per_day.items() if d.year == y and d.month == mo)})

    streak, d = 0, today
    while per_day.get(d):
        streak, d = streak + 1, d - timedelta(days=1)

    def accuracy(start: date, end: date) -> float | None:
        xs = [c for at, c, src in events if src != "practice" and start <= _local_day(at) < end]
        return round(sum(xs) / len(xs), 2) if xs else None

    tests = db.scalar(select(func.count()).select_from(Attempt).where(Attempt.user_id == user.id,
                                                                       Attempt.finished_at.is_not(None))) or 0
    perfect = db.scalar(select(func.count()).select_from(Attempt).where(
        Attempt.user_id == user.id, Attempt.finished_at.is_not(None), Attempt.score == Attempt.total)) or 0
    mastered = sum(s.status == "mastered" for s in st)
    week_done = sum(week)
    return {
        "lessons": [{"slug": l.slug, "title": l.title, **s.as_dict()} for l, s in zip(lessons, st)],
        "progress": {"total": len(lessons), "mastered": mastered,
                     "percent": round(100 * mastered / (len(lessons) or 1)),
                     "known": sum(s.status != "unknown" for s in st)},
        "next": next_step(lessons, states, recs),
        "recommendations": recs[:5],
        "activity": {"week": week, "month": month, "year": year, "streak": streak},
        "stats": {"tasks": len(events), "tests": tests, "mastered": mastered,
                  "acc_this_week": accuracy(week_start, today + timedelta(days=1)),
                  "acc_last_week": accuracy(week_start - timedelta(days=7), week_start)},
        "goal": {"target": user.weekly_goal, "done": week_done},
        "achievements": {"first_step": len(events) > 0, "perfect_test": perfect > 0, "streak5": streak >= 5,
                         "diagnostic": db.scalar(select(func.count()).select_from(Attempt).where(
                             Attempt.user_id == user.id, Attempt.kind == "diagnostic",
                             Attempt.finished_at.is_not(None))) > 0,
                         "five_mastered": mastered >= 5, "all_mastered": mastered == len(lessons) and mastered > 0},
    }
