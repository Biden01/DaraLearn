"""Сохранение решений: гипотезы и рекомендации со статусами, групповое правило по классу."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.content.models import Lesson
from app.modules.content.service import lessons_of, subject_by_slug
from app.modules.decisions.engine import decide, tutor_sessions_by_lesson
from app.modules.decisions.models import Hypothesis, Recommendation
from app.modules.school.access import class_students
from app.modules.state.engine import SkillState, compute_states

OPEN = ("new", "accepted", "changed")
GROUP_SHARE = 0.3   # доля класса с пробелом в навыке → групповое объяснение
GROUP_MIN = 2
TEACHER_ACTIONS = ("teacher", "group")


def subject_lessons(db: Session, subject: str = "math") -> list[Lesson]:
    return lessons_of(db, subject_by_slug(db, subject).id)


def sync_student(db: Session, user_id: int, lessons: list[Lesson] | None = None) -> list[Recommendation]:
    """Пересчитать решения ученика и привести сохранённые рекомендации в соответствие."""
    lessons = lessons or subject_lessons(db)
    by_slug = {l.slug: l for l in lessons}
    states = compute_states(db, user_id)
    fresh = decide(lessons, states, tutor_sessions_by_lesson(db, user_id))
    now = datetime.now(timezone.utc)

    # одна открытая рекомендация на навык: решение учителя (accepted/changed) не перезаписывается
    existing = {r.lesson_id: r for r in db.scalars(
        select(Recommendation).where(Recommendation.user_id == user_id, Recommendation.status.in_(OPEN),
                                     Recommendation.rule.not_like("escalation:%")))}  # вызовы учителя ведёт сам Tutor
    # отклонённое учителем не создаём заново, пока Decision Engine предлагает то же действие
    rejected = {(r.lesson_id, r.action) for r in db.scalars(
        select(Recommendation).where(Recommendation.user_id == user_id, Recommendation.status == "rejected"))}
    hyps = {h.lesson_id: h for h in db.scalars(
        select(Hypothesis).where(Hypothesis.user_id == user_id, Hypothesis.status == "open"))}
    keep = set()
    for r in fresh:
        lesson = by_slug[r["lesson"]]
        target = by_slug.get(r.get("target"))
        h = hyps.get(lesson.id)
        evidence = {"proof": r["proof"], "status": r["status"], "target": r.get("target")}
        if h is None or h.kind != r["cause"]:
            if h:
                h.status = "closed"
            h = Hypothesis(user_id=user_id, lesson_id=lesson.id, kind=r["cause"], evidence=evidence)
            db.add(h)
            db.flush()
            hyps[lesson.id] = h
        else:
            h.evidence = evidence
        keep.add(lesson.id)
        rec = existing.get(lesson.id)
        if rec is None and (lesson.id, r["action"]) in rejected:
            continue
        if rec is None:
            rec = Recommendation(user_id=user_id, lesson_id=lesson.id, action=r["action"], cause=r["cause"],
                                 rule=f"{r['action']}:{r['cause']}", needs_teacher=r["action"] in TEACHER_ACTIONS)
            db.add(rec)
        elif rec.status == "new":
            rec.action, rec.rule = r["action"], f"{r['action']}:{r['cause']}"
            rec.needs_teacher = r["action"] in TEACHER_ACTIONS
        rec.priority, rec.proof, rec.cause = r["priority"], r["proof"], r["cause"]
        rec.target_lesson_id = target.id if target else None
        rec.hypothesis_id = h.id
    for key, rec in existing.items():
        if key not in keep:
            # ситуация изменилась: принятое учителем считаем выполненным, остальное — устаревшим
            rec.status = "done" if rec.status in ("accepted", "changed") else "obsolete"
            rec.done_at = now
    fresh_lessons = {by_slug[r["lesson"]].id for r in fresh}
    for lid, h in hyps.items():
        if lid not in fresh_lessons:
            h.status = "closed"
    db.flush()
    return visible_for_student(db, user_id)


def visible_for_student(db: Session, user_id: int) -> list[Recommendation]:
    """Ученик видит автоматические и принятые/изменённые учителем шаги; отклонённые — нет."""
    rows = db.scalars(select(Recommendation).where(Recommendation.user_id == user_id, Recommendation.status.in_(OPEN)))
    return sorted(rows, key=lambda r: (-r.priority, r.proof))


def sync_class_group(db: Session, class_id: int, lessons: list[Lesson] | None = None) -> None:
    """Групповое правило: ≥30% класса с пробелом в одном навыке — одна рекомендация учителю."""
    lessons = lessons or subject_lessons(db)
    students = class_students(db, class_id)
    if not students:
        return
    gaps: dict[int, int] = {}
    for s in students:
        for lid, st in compute_states(db, s.id).items():
            if st.status == "gap":
                gaps[lid] = gaps.get(lid, 0) + 1
    existing = {r.lesson_id: r for r in db.scalars(select(Recommendation).where(
        Recommendation.class_id == class_id, Recommendation.status.in_(OPEN)))}
    for l in lessons:
        n = gaps.get(l.id, 0)
        hit = n >= GROUP_MIN and n / len(students) >= GROUP_SHARE
        rec = existing.get(l.id)
        if hit and rec is None:
            db.add(Recommendation(class_id=class_id, lesson_id=l.id, action="group", cause="topic", rule="group:30pct",
                                  priority=3, proof=round(1 - n / len(students), 2), needs_teacher=True,
                                  comment=f"{n}/{len(students)}"))
        elif hit and rec:
            rec.comment = f"{n}/{len(students)}"
        elif not hit and rec:
            rec.status = "done" if rec.status in ("accepted", "changed") else "obsolete"
            rec.done_at = datetime.now(timezone.utc)
    db.flush()


def rec_out(r: Recommendation, lessons_by_id: dict[int, Lesson], states: dict[int, SkillState] | None = None) -> dict:
    l = lessons_by_id.get(r.lesson_id)
    skill = (states or {}).get(r.lesson_id, SkillState())
    t = lessons_by_id.get(r.target_lesson_id) if r.target_lesson_id else None
    return {"id": r.id, "action": r.action, "cause": r.cause, "priority": r.priority, "proof": r.proof,
            "status": r.status, "skill_status": skill.status, "comment": r.comment, "needs_teacher": r.needs_teacher,
            "lesson": l.slug if l else None, "title": l.title if l else None, "order": l.order if l else 0,
            "target": t.slug if t else None, "target_title": t.title if t else None,
            "user_id": r.user_id, "class_id": r.class_id, "created_at": r.created_at.isoformat() if r.created_at else None}
