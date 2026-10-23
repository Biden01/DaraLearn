"""Root Cause Investigation + Decision Engine: правила из docs/PLAN.md.

Для каждого урока со слабым результатом определяем вероятную причину и следующее действие.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.content.models import Lesson
from app.modules.state.engine import SkillState
from app.modules.tutor.models import TutorSession

TUTOR_LIMIT = 0.6        # ниже — занятие с AI Tutor
SESSIONS_NO_GROWTH = 2   # столько сессий Tutor без роста → учитель
PRACTICE_OK = 0.7        # практика с подсказками получается, а самостоятельно — нет


def tutor_sessions_by_lesson(db: Session, user_id: int) -> dict[int, int]:
    rows = db.execute(select(TutorSession.lesson_id, func.count()).where(TutorSession.user_id == user_id)
                      .group_by(TutorSession.lesson_id)).all()
    return {lid: n for lid, n in rows if lid}


def decide(lessons: list[Lesson], states: dict[int, SkillState], tutor_counts: dict[int, int]) -> list[dict]:
    """Список рекомендаций, самые важные первыми.

    action: diagnostic | prereq | lesson | tutor | practice | teacher | verify
    cause:  no_data | base | topic | strategy | not_enough
    """
    by_slug = {l.slug: l for l in lessons}
    recs = []
    for i, l in enumerate(lessons):
        s = states.get(l.id, SkillState())
        st = s.status
        root = _root_gap(l, by_slug, states)
        rec = None
        if st in ("gap", "learning") and root:
            rec = dict(action="prereq", cause="base", priority=3, target=root.slug, target_title=root.title)
        elif st == "gap":
            if s.n_practice >= 2 and s.practice >= PRACTICE_OK:
                rec = dict(action="tutor", cause="strategy", priority=3)
            elif tutor_counts.get(l.id, 0) >= SESSIONS_NO_GROWTH and not _growing(s):
                rec = dict(action="teacher", cause="topic", priority=3)
            else:
                rec = dict(action="lesson", cause="topic", priority=3)
        elif st == "learning":
            if s.indep < TUTOR_LIMIT:
                rec = dict(action="tutor", cause="topic", priority=2)
            else:
                rec = dict(action="practice", cause="not_enough", priority=1)
        elif st == "likely" or (st == "mastered" and not s.confident):
            rec = dict(action="verify", cause="not_enough", priority=1)
        if rec:
            rec.update(lesson=l.slug, title=l.title, proof=round(s.indep, 2), status=st, order=i)
            recs.append(rec)
    recs.sort(key=lambda r: (-r["priority"], r["proof"]))
    return recs


def _root_gap(lesson: Lesson, by_slug: dict[str, Lesson], states: dict[int, SkillState]) -> Lesson | None:
    """Самая глубокая базовая тема с пробелом: у неё самой база в порядке. Её и нужно закрывать первой."""
    def is_gap(x: Lesson) -> bool:
        return states.get(x.id, SkillState()).status == "gap"

    seen: set[str] = set()
    found = None
    frontier = [by_slug[p] for p in lesson.prereqs if p in by_slug and is_gap(by_slug[p])]
    while frontier:
        cur = frontier.pop(0)
        if cur.slug in seen:
            continue
        seen.add(cur.slug)
        deeper = [by_slug[p] for p in cur.prereqs if p in by_slug and is_gap(by_slug[p])]
        if not deeper:
            found = found or cur
        frontier.extend(deeper)
    return found


def _growing(s: SkillState) -> bool:
    h = s.history
    if len(h) < 4:
        return False
    half = len(h) // 2
    return sum(h[half:]) / (len(h) - half) > sum(h[:half]) / half


def next_step(lessons: list[Lesson], states: dict[int, SkillState], recs: list[dict]) -> dict:
    """Одно главное действие для главной страницы."""
    if not any(states.get(l.id) and states[l.id].n_indep for l in lessons):
        return {"action": "diagnostic"}
    if recs and recs[0]["priority"] >= 2:
        return recs[0]
    by_slug = {l.slug: l for l in lessons}
    for l in lessons:  # первый ещё не изученный урок, база которого не в пробеле
        s = states.get(l.id, SkillState())
        if s.status == "unknown":
            blocked = any(states.get(by_slug[p].id, SkillState()).status == "gap" for p in l.prereqs if p in by_slug)
            if not blocked:
                return {"action": "lesson", "lesson": l.slug, "title": l.title, "cause": "new"}
    return recs[0] if recs else {"action": "done"}
