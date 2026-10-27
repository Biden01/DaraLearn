"""Root Cause Investigation и Decision Engine: гипотезы причин ошибки, правила выбора следующего действия, Teacher Action Feed."""
from collections import Counter
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user, require_role
from app.modules.decisions import rules
from app.modules.decisions.models import Recommendation
from app.modules.decisions.service import OPEN, rec_out, subject_lessons, sync_class_group, sync_student
from app.modules.school.access import class_students, get_class, visible_classes, visible_student_ids
from app.modules.school.models import User
from app.modules.school.router import audit
from app.modules.state.engine import SkillState, compute_states

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.get("/rules")
def active_rules(user: User = Depends(require_role("teacher", "curator"))) -> dict:
    """Действующая версия правил и пороги: чтобы объяснить любую рекомендацию."""
    return rules.as_dict()


class DecisionIn(BaseModel):
    status: Literal["accepted", "changed", "rejected", "done"]
    comment: str = Field(default="", max_length=1000)
    action: Literal["lesson", "tutor", "practice", "teacher", "verify", "prereq", "group"] | None = None


def student_view(db: Session, student: User) -> dict:
    lessons = subject_lessons(db)
    by_id = {l.id: l for l in lessons}
    recs = sync_student(db, student.id, lessons)
    db.commit()
    states = compute_states(db, student.id)
    known = [states[l.id] for l in lessons if l.id in states and states[l.id].n_indep]
    understanding = round(100 * sum(s.indep for s in known) / len(known)) if known else None
    out = [rec_out(r, by_id, states) for r in recs]

    # цепочка базовых тем для самого важного пробела
    chain = []
    if out:
        by_slug = {l.slug: l for l in lessons}
        seen, stack = set(), [out[0]["lesson"]]
        while stack:
            slug = stack.pop()
            if slug in seen or slug not in by_slug:
                continue
            seen.add(slug)
            stack.extend(by_slug[slug].prereqs)
        chain = [{"slug": l.slug, "title": l.title, **states.get(l.id, SkillState()).as_dict()}
                 for l in lessons if l.slug in seen]
    return {"recommendations": out, "understanding": understanding,
            "causes": dict(Counter(r["cause"] for r in out)), "chain": chain,
            "unknown": sum(1 for l in lessons if states.get(l.id, SkillState()).status == "unknown")}


@router.get("/me")
def my_decisions(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return student_view(db, user)


@router.get("/feed")
def feed(class_id: int | None = None, include_closed: bool = False,
         user: User = Depends(require_role("teacher", "curator")), db: Session = Depends(get_db)) -> dict:
    """Teacher Action Feed: рекомендации по ученикам и группе, которые учитель может принять, изменить, отклонить."""
    classes = [get_class(db, user, class_id)] if class_id else visible_classes(db, user)
    lessons = subject_lessons(db)
    by_id = {l.id: l for l in lessons}
    students: dict[int, User] = {}
    class_of: dict[int, str] = {}
    for c in classes:
        for s in class_students(db, c.id):
            students[s.id] = s
            class_of[s.id] = c.name
        sync_class_group(db, c.id, lessons)
    for sid in students:
        sync_student(db, sid, lessons)
    db.commit()
    statuses = OPEN + (("rejected", "done") if include_closed else ())
    rows = list(db.scalars(select(Recommendation).where(
        Recommendation.status.in_(statuses),
        (Recommendation.user_id.in_(students.keys())) | (Recommendation.class_id.in_([c.id for c in classes])))))
    items = []
    for r in rows:
        o = rec_out(r, by_id)
        if r.user_id:
            o["student"] = {"id": r.user_id, "name": students[r.user_id].name, "class": class_of[r.user_id]}
        else:
            o["class_name"] = next((c.name for c in classes if c.id == r.class_id), "")
        items.append(o)
    # учителю важнее: сначала то, что требует его решения, затем приоритет
    items.sort(key=lambda o: (o["status"] != "new", not o["needs_teacher"], -o["priority"], o["proof"]))
    return {"items": items, "counts": dict(Counter(o["status"] for o in items))}


@router.patch("/{rec_id}")
def decide_rec(rec_id: int, payload: DecisionIn, user: User = Depends(require_role("teacher", "curator")),
               db: Session = Depends(get_db)) -> dict:
    r = db.get(Recommendation, rec_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    allowed = visible_student_ids(db, user)
    in_scope = (r.user_id and (allowed is None or r.user_id in allowed)) or \
        (r.class_id and r.class_id in [c.id for c in visible_classes(db, user)])
    if not in_scope:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    r.status, r.comment = payload.status, payload.comment.strip() or r.comment
    if payload.status == "changed" and payload.action:
        r.action = payload.action
    r.decided_by, r.decided_at = user.id, datetime.now(timezone.utc)
    if payload.status == "done":
        r.done_at = r.decided_at
    audit(db, user, f"recommendation.{payload.status}", "recommendation", r.id, comment=payload.comment, new_action=payload.action)
    db.commit()
    if payload.status == "done" and r.user_id:
        # помощь учителя завершена — назначаем отложенную проверку
        from app.modules.verification.service import schedule_check
        schedule_check(db, r.user_id, r.lesson_id, "teacher", r.id)
        db.commit()
    return rec_out(r, {l.id: l for l in subject_lessons(db)})
