"""План ученика: цель месяца к ПҚС, недели (видны только учителю и куратору), план на день; тема класса."""
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
from app.modules.decisions.service import sync_student
from app.modules.events.models import LearningEvent
from app.modules.plan.models import DailyPlan, MonthlyGoal, PlanItem
from app.modules.plan.service import (build_goal, build_plan, current_topic, goal_schedule, goal_topics, next_month,
                                      rebuild_goal, refresh_progress, set_topic, week_of)
from app.modules.school.access import class_students, get_class, get_student
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states
from app.modules.verification.service import schedule_check

router = APIRouter(prefix="/plan", tags=["plan"])

LOCAL_TZ = timezone(timedelta(hours=5))  # Казахстан


def today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


def plan_out(db: Session, plan: DailyPlan) -> dict:
    items = refresh_progress(db, plan)
    lessons = {l.id: l for l in db.scalars(select(Lesson).where(Lesson.id.in_([i.lesson_id for i in items] or [-1])))}
    tasks = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_([t for i in items for t in i.task_ids] or [-1])))}
    done_min = sum(i.minutes for i in items if i.status == "done")
    answered = set(db.scalars(select(LearningEvent.task_id).where(
        LearningEvent.user_id == plan.user_id, LearningEvent.created_at >= plan.created_at,
        LearningEvent.task_id.in_(list(tasks) or [-1]))))
    return {
        "id": plan.id, "day": plan.day.isoformat(), "total_minutes": plan.total_minutes,
        "done_minutes": done_min, "rate": round(sum(i.status == "done" for i in items) / len(items), 2) if items else 0,
        "items": [{"id": i.id, "block": i.block, "reason": i.reason, "minutes": i.minutes, "status": i.status,
                   "lesson": lessons[i.lesson_id].slug, "title": lessons[i.lesson_id].title,
                   "answered": [t for t in i.task_ids if t in answered],
                   "tasks": [task_public(tasks[t]) for t in i.task_ids if t in tasks]} for i in items],
    }


def topic_status(s: SkillState) -> str:
    """Для ученика три состояния: закрыта / в работе / впереди."""
    return "done" if s.status == "mastered" else "learning" if s.status in ("learning", "likely") else "todo"


def goal_out(db: Session, goal: MonthlyGoal, staff: bool = False) -> dict:
    """Ученику — цель, список тем и темы по дням. Учителю и куратору — ещё недели, состояние на старте
    и выполнение планов по неделям."""
    topics = goal_topics(db, goal)
    lessons = {l.id: l for l in db.scalars(select(Lesson).where(Lesson.id.in_([t.lesson_id for t in topics] or [-1])))}
    topics = [t for t in topics if t.lesson_id in lessons]
    states = compute_states(db, goal.user_id)
    rows = []
    for t in topics:
        s = states.get(t.lesson_id, SkillState())
        row = {"lesson": lessons[t.lesson_id].slug, "title": lessons[t.lesson_id].title, "status": topic_status(s)}
        if staff:
            row |= {"week": t.week, "start_status": t.start_status, "start_proof": t.start_proof, "proof": round(s.indep, 2)}
        rows.append(row)
    plans = list(db.scalars(select(DailyPlan).where(DailyPlan.user_id == goal.user_id, DailyPlan.day >= goal.month,
                                                    DailyPlan.day < next_month(goal.month))))
    by_day = {p.day: p for p in plans}
    slugs = {t.lesson_id: lessons[t.lesson_id].slug for t in topics}
    today = today_local()
    days = []
    for d, ids in goal_schedule(goal, topics).items():
        p = by_day.get(d)
        if d == today:
            state = "today"
        elif d > today:
            state = "upcoming"
        else:
            state = "done" if p and all(i.status == "done" for i in refresh_progress(db, p)) else "missed"
        days.append({"day": d.isoformat(), "topics": [slugs[i] for i in ids if i in slugs], "state": state})
    out = {"month": goal.month.isoformat(), "total": len(rows), "done": sum(r["status"] == "done" for r in rows),
           "topics": rows, "days": days}
    if staff:
        weeks = []
        for w in range(1, rules.WEEKS + 1):
            items = [i for p in plans if week_of(p.day) == w for i in refresh_progress(db, p)]
            weeks.append({"week": w, "topics": [r["lesson"] for r in rows if r["week"] == w], "days": sum(week_of(p.day) == w for p in plans),
                          "rate": round(sum(i.status == "done" for i in items) / len(items), 2) if items else None})
        out |= {"rules_version": goal.rules_version, "current_week": week_of(today) if goal.month == today.replace(day=1) else None,
                "weeks": weeks}
    return out


@router.get("/today")
def today(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Ученику: цель месяца, темы для повторения, темы по дням и план на сегодня. Разбивка по неделям сюда не входит."""
    day = today_local()
    plan = build_plan(db, user, day)
    out = plan_out(db, plan) | {"goal": goal_out(db, build_goal(db, user, day))}
    db.commit()
    return out


@router.get("/students/{student_id}/month")
def student_month(student_id: int, user: User = Depends(require_role("teacher", "curator")),
                  db: Session = Depends(get_db)) -> dict:
    """Цель месяца ученика с разбивкой по неделям. Пока ученик не открыл план в этом месяце, цели нет."""
    s = get_student(db, user, student_id)
    goal = db.scalar(select(MonthlyGoal).where(MonthlyGoal.user_id == s.id, MonthlyGoal.month == today_local().replace(day=1)))
    out = {"goal": goal_out(db, goal, staff=True) if goal else None}
    db.commit()
    return out


@router.post("/classes/{class_id}/goals/rebuild")
def rebuild_goals(class_id: int, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)) -> dict:
    """Пересобрать цели месяца класса по свежим результатам (после загрузки ПҚС)."""
    c = get_class(db, user, class_id)
    day = today_local()
    students = class_students(db, c.id)
    for s in students:
        rebuild_goal(db, s, day)
    db.add(AuditLog(actor_id=user.id, action="plan.goals_rebuild", entity="class", entity_id=c.id,
                    data={"month": day.replace(day=1).isoformat(), "students": len(students)}))
    db.commit()
    return {"rebuilt": len(students)}


class TopicIn(BaseModel):
    course: str
    starts_on: date | None = None


@router.get("/classes/{class_id}")
def class_plan(class_id: int, user: User = Depends(require_role("teacher", "curator")),
               db: Session = Depends(get_db)) -> dict:
    """Тема класса, цель месяца и выполнение сегодняшнего плана учениками."""
    c = get_class(db, user, class_id)
    day = today_local()
    topic = current_topic(db, c.id, day)
    course = db.get(Course, topic.course_id) if topic else None
    students = []
    for s in class_students(db, c.id):
        plan = db.scalar(select(DailyPlan).where(DailyPlan.user_id == s.id, DailyPlan.day == day))
        p = plan_out(db, plan) if plan else None
        goal = db.scalar(select(MonthlyGoal).where(MonthlyGoal.user_id == s.id, MonthlyGoal.month == day.replace(day=1)))
        g = goal_out(db, goal) if goal else None
        students.append({"id": s.id, "name": s.name, "has_plan": bool(p), "rate": p["rate"] if p else 0,
                         "goal": {"done": g["done"], "total": g["total"]} if g else None})
    db.commit()
    return {"day": day.isoformat(), "topic": {"course": course.slug, "title": course.title,
                                              "starts_on": topic.starts_on.isoformat()} if course else None,
            "students": students, "minutes": rules.TOTAL_MIN, "week": week_of(day)}


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


class AnswerIn(BaseModel):
    task_id: int
    choice: int


@router.post("/items/{item_id}/answer")
def answer(item_id: int, payload: AnswerIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Ответ на задание пункта плана. Закрепление — практика с разбором; мини-проверка — независимый результат без разбора."""
    item = db.get(PlanItem, item_id)
    plan = db.get(DailyPlan, item.plan_id) if item else None
    if not item or plan.user_id != user.id or item.block == "tutor" or payload.task_id not in item.task_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    task = db.get(Task, payload.task_id)
    if not 0 <= payload.choice < len(task.options):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad_choice")
    if db.scalar(select(LearningEvent.id).where(LearningEvent.user_id == user.id, LearningEvent.task_id == task.id,
                                                LearningEvent.created_at >= plan.created_at).limit(1)):
        raise HTTPException(status.HTTP_409_CONFLICT, "already_answered")
    correct = payload.choice == task.answer
    db.add(LearningEvent(user_id=user.id, lesson_id=task.lesson_id, task_id=task.id, choice=payload.choice,
                         correct=correct, source="verification" if item.block == "check" else "practice"))
    db.flush()
    if item.block == "practice":
        schedule_check(db, user.id, task.lesson_id, "lesson")
    items = refresh_progress(db, plan)
    if all(i.status == "done" for i in items if i.block == item.block):
        sync_student(db, user.id)
    db.commit()
    done = next(i for i in items if i.id == item.id).status == "done"
    # проверка не подсказывает: результат и разбор открываются, когда все задания блока отвечены
    reveal = item.block == "practice" or done
    return {"item_status": "done" if done else "pending", "correct": correct if reveal else None,
            "answer": task.answer if reveal else None, "explanation": task.explanation if reveal else None}
