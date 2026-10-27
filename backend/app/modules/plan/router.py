"""Ежедневный план ученика и тема класса."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.content.models import Course, Lesson, Task
from app.modules.content.service import subject_by_slug, task_public
from app.modules.decisions.models import AuditLog
from app.modules.plan import rules
from app.modules.plan.models import DailyPlan
from app.modules.plan.service import build_plan, current_topic, refresh_progress, set_topic
from app.modules.school.access import class_students, get_class
from app.modules.school.models import User

router = APIRouter(prefix="/plan", tags=["plan"])

LOCAL_TZ = timezone(timedelta(hours=5))  # Казахстан


def today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


def plan_out(db: Session, plan: DailyPlan) -> dict:
    items = refresh_progress(db, plan)
    lessons = {l.id: l for l in db.scalars(select(Lesson).where(Lesson.id.in_([i.lesson_id for i in items] or [-1])))}
    tasks = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_([t for i in items for t in i.task_ids] or [-1])))}
    done_min = sum(i.minutes for i in items if i.status == "done")
    return {
        "id": plan.id, "day": plan.day.isoformat(), "rules_version": plan.rules_version, "total_minutes": plan.total_minutes,
        "done_minutes": done_min, "rate": round(sum(i.status == "done" for i in items) / len(items), 2) if items else 0,
        "items": [{"id": i.id, "block": i.block, "reason": i.reason, "minutes": i.minutes, "status": i.status,
                   "lesson": lessons[i.lesson_id].slug, "title": lessons[i.lesson_id].title,
                   "tasks": [task_public(tasks[t]) for t in i.task_ids if t in tasks]} for i in items],
    }


@router.get("/today")
def today(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    out = plan_out(db, build_plan(db, user, today_local()))
    db.commit()
    return out


class TopicIn(BaseModel):
    course: str
    starts_on: date | None = None


@router.get("/classes/{class_id}")
def class_plan(class_id: int, user: User = Depends(require_role("teacher", "curator")),
               db: Session = Depends(get_db)) -> dict:
    """Тема класса и выполнение сегодняшнего плана учениками."""
    c = get_class(db, user, class_id)
    day = today_local()
    topic = current_topic(db, c.id, day)
    course = db.get(Course, topic.course_id) if topic else None
    students = []
    for s in class_students(db, c.id):
        plan = db.scalar(select(DailyPlan).where(DailyPlan.user_id == s.id, DailyPlan.day == day))
        p = plan_out(db, plan) if plan else None
        students.append({"id": s.id, "name": s.name, "has_plan": bool(p), "rate": p["rate"] if p else 0})
    db.commit()
    return {"day": day.isoformat(), "topic": {"course": course.slug, "title": course.title,
                                              "starts_on": topic.starts_on.isoformat()} if course else None,
            "students": students, "minutes": rules.TOTAL_MIN}


@router.put("/classes/{class_id}/topic")
def put_topic(class_id: int, body: TopicIn, user: User = Depends(require_role("teacher")),
              db: Session = Depends(get_db)) -> dict:
    """Учитель задаёт тему класса с даты (по умолчанию — с сегодняшнего дня); план на эту дату собирается заново."""
    c = get_class(db, user, class_id)
    subject = subject_by_slug(db, c.subject)
    course = db.scalar(select(Course).where(Course.slug == body.course, Course.subject_id == subject.id))
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "course")
    day = body.starts_on or today_local()
    t = set_topic(db, c.id, course.id, day, user.id)
    # план этого дня ещё не начат — пересоберётся при входе ученика
    for plan in db.scalars(select(DailyPlan).where(
            DailyPlan.day == day, DailyPlan.user_id.in_([s.id for s in class_students(db, c.id)] or [-1]))):
        if not any(i.status == "done" for i in refresh_progress(db, plan)):
            db.delete(plan)
    db.add(AuditLog(actor_id=user.id, action="plan.topic", entity="class", entity_id=c.id,
                    data={"course": course.slug, "starts_on": day.isoformat()}))
    db.commit()
    return {"course": course.slug, "starts_on": t.starts_on.isoformat()}
