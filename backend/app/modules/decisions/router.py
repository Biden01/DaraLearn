"""Root Cause Investigation и Decision Engine: гипотезы причин ошибки и правила выбора следующего действия."""
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user
from app.modules.content.service import lessons_of, subject_by_slug
from app.modules.decisions.engine import decide, tutor_sessions_by_lesson
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.get("/me")
def my_decisions(subject: str = "math", user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    subj = subject_by_slug(db, subject)
    lessons = lessons_of(db, subj.id)
    states = compute_states(db, user.id)
    recs = decide(lessons, states, tutor_sessions_by_lesson(db, user.id))
    known = [states[l.id] for l in lessons if l.id in states and states[l.id].n_indep]
    understanding = round(100 * sum(s.indep for s in known) / len(known)) if known else None

    # цепочка базовых тем для самого важного пробела
    chain = []
    if recs:
        by_slug = {l.slug: l for l in lessons}
        seen, stack = set(), [recs[0]["lesson"]]
        while stack:
            slug = stack.pop()
            if slug in seen or slug not in by_slug:
                continue
            seen.add(slug)
            stack.extend(by_slug[slug].prereqs)
        chain = [{"slug": l.slug, "title": l.title, **states.get(l.id, SkillState()).as_dict()}
                 for l in lessons if l.slug in seen]
    return {"recommendations": recs, "understanding": understanding,
            "causes": dict(Counter(r["cause"] for r in recs)), "chain": chain,
            "unknown": sum(1 for l in lessons if states.get(l.id, SkillState()).status == "unknown")}
