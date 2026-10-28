"""Proof Engine и Student State: уверенность оценки, динамика, последняя проверка; практика и независимая проверка учитываются отдельно."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.content.service import lessons_of, subject_by_slug
from app.modules.decisions.engine import next_step
from app.modules.decisions.models import Recommendation
from app.modules.decisions.service import rec_out, sync_student
from app.modules.events.models import LearningEvent
from app.modules.school.access import class_students, get_class, get_student
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states
from app.modules.verification.models import Attempt
from app.modules.verification.service import count_checks_due, outcome_stats, plan_rate

router = APIRouter(prefix="/state", tags=["state"])

LOCAL_TZ = timezone(timedelta(hours=5))  # Казахстан


def _local_day(dt: datetime) -> date:
    return dt.astimezone(LOCAL_TZ).date()


@router.get("/me")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return build_dashboard(db, user)


@router.get("/students/{student_id}")
def student_dashboard(student_id: int, user: User = Depends(require_role("teacher", "curator")),
                      db: Session = Depends(get_db)) -> dict:
    s = get_student(db, user, student_id)
    out = build_dashboard(db, s)
    out["student"] = {"id": s.id, "name": s.name, "grade": s.grade, "login": s.login, "email": s.email}
    rate, total = plan_rate(db, s.id)
    out["plan"] = {"rate": round(rate, 2), "items": total}
    out["outcomes"] = outcome_stats(db, {s.id})
    return out


@router.get("/classes/{class_id}")
def class_map(class_id: int, user: User = Depends(require_role("teacher", "curator")), db: Session = Depends(get_db)) -> dict:
    """Тепловая карта «ученики × навыки» и сводка по классу."""
    c = get_class(db, user, class_id)
    lessons = lessons_of(db, subject_by_slug(db, c.subject).id)
    students = class_students(db, c.id)
    rows, gaps = [], {l.id: 0 for l in lessons}
    for s in students:
        st = compute_states(db, s.id)
        cells = []
        for l in lessons:
            x = st.get(l.id, SkillState())
            gaps[l.id] += x.status == "gap"
            cells.append({"status": x.status, "proof": round(x.indep, 2), "n": x.n_indep})
        mastered = sum(cell["status"] == "mastered" for cell in cells)
        rows.append({"id": s.id, "name": s.name, "cells": cells, "mastered": mastered,
                     "percent": round(100 * mastered / (len(lessons) or 1))})
    open_recs = db.scalar(select(func.count()).select_from(Recommendation).where(
        Recommendation.user_id.in_([s.id for s in students] or [-1]), Recommendation.status == "new")) or 0
    return {"class": {"id": c.id, "name": c.name, "grade": c.grade, "subject": c.subject},
            "lessons": [{"slug": l.slug, "title": l.title, "gaps": gaps[l.id]} for l in lessons],
            "students": rows, "new_recommendations": open_recs,
            "outcomes": outcome_stats(db, {s.id for s in students})}


def build_dashboard(db: Session, user: User, subject: str = "math") -> dict:
    subj = subject_by_slug(db, subject)
    lessons = lessons_of(db, subj.id)
    recs_db = sync_student(db, user.id, lessons)
    db.commit()
    states = compute_states(db, user.id)
    by_id = {l.id: l for l in lessons}
    recs = [rec_out(r, by_id, states) for r in recs_db]
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
        "next": _next(lessons, states, recs),
        "recommendations": recs[:5],
        "checks_due": count_checks_due(db, user.id),
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


def _next(lessons, states, recs: list[dict]) -> dict:
    """Главный шаг: сохранённая рекомендация (с решением учителя) или правило next_step."""
    rule_recs = [{**r, "status": r["skill_status"]} for r in recs]
    step = next_step(lessons, states, rule_recs)
    if step.get("action") not in ("diagnostic", "done") and recs and recs[0]["priority"] >= 2:
        return recs[0]
    return step
