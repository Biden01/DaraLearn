"""«Мои достижения»: все тесты ученика (диагностика, проверка знаний, ПҚС/БЖБ из импорта) — баллы, динамика,
где потеряны баллы по темам и какие именно ответы неверны. Ошибка ведёт в AI Tutor (сессия на это задание)."""
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user
from app.modules.content.models import ERROR_KINDS, Course, Lesson, Subject, Task
from app.modules.events.models import LearningEvent
from app.modules.school.models import User
from app.modules.state.engine import compute_states
from app.modules.state.router import LOCAL_TZ
from app.modules.verification.models import Attempt

router = APIRouter(prefix="/results", tags=["results"])


def _collect(db: Session, user_id: int) -> tuple[list[dict], dict[int, Lesson]]:
    """Все завершённые тесты ученика по времени. Внутри — темы (верно/всего) и неверные ответы (task_id, choice)."""
    lessons = {l.id: l for l in db.scalars(select(Lesson))}
    attempts = list(db.scalars(select(Attempt).where(Attempt.user_id == user_id, Attempt.finished_at.is_not(None))
                               .order_by(Attempt.finished_at)))
    task_ids = {i for a in attempts for i in a.task_ids}
    tasks = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_(task_ids or {-1})))}
    courses = {c.id: c for c in db.scalars(select(Course))}
    subjects = {s.id: s for s in db.scalars(select(Subject))}
    tests = []
    for a in attempts:
        skills: dict[int, list[int]] = defaultdict(lambda: [0, 0])
        wrong = []
        for tid in a.task_ids:
            t = tasks.get(tid)
            if not t:
                continue
            choice = a.answers.get(str(tid))
            ok = choice == t.answer
            skills[t.lesson_id][1] += 1
            skills[t.lesson_id][0] += ok
            if not ok:
                wrong.append((t, choice))
        scope = (lessons[a.lesson_id].title if a.lesson_id in lessons else
                 courses[a.course_id].title if a.course_id in courses else subjects[a.subject_id].title)
        tests.append({"id": f"a{a.id}", "kind": a.kind, "scope": f"{a.kind}:{a.lesson_id or ''}:{a.course_id or ''}",
                      "title": scope, "date": a.finished_at, "skills": skills, "wrong": wrong, "attempt": a.id})

    # ПҚС / БЖБ: импорт учителя — один тест на день загрузки результатов
    by_day: dict = defaultdict(list)
    for e in db.scalars(select(LearningEvent).where(LearningEvent.user_id == user_id, LearningEvent.source == "import")
                        .order_by(LearningEvent.created_at)):
        by_day[e.created_at.astimezone(LOCAL_TZ).date()].append(e)
    for day, events in by_day.items():
        skills = defaultdict(lambda: [0, 0])
        for e in events:
            skills[e.lesson_id][1] += 1
            skills[e.lesson_id][0] += e.correct
        tests.append({"id": f"pqs-{day.isoformat()}", "kind": "pqs", "scope": "pqs", "title": None,
                      "date": events[-1].created_at, "skills": skills, "wrong": [], "attempt": None})

    tests.sort(key=lambda x: x["date"])
    prev: dict[str, int] = {}
    for x in tests:
        x["score"] = sum(c for c, _ in x["skills"].values())
        x["total"] = sum(n for _, n in x["skills"].values())
        x["pct"] = round(100 * x["score"] / x["total"]) if x["total"] else 0
        x["prev_pct"] = prev.get(x["scope"])  # прошлый результат того же теста — для «+12%»
        prev[x["scope"]] = x["pct"]
    return tests, lessons


def _skills_out(skills: dict, lessons: dict[int, Lesson]) -> list[dict]:
    out = [{"lesson": lessons[lid].slug, "title": lessons[lid].title, "order": lessons[lid].order,
            "correct": c, "total": n, "lost": n - c} for lid, (c, n) in skills.items() if lid in lessons]
    return sorted(out, key=lambda s: (-s["lost"], s["order"]))


def _test_out(x: dict, lessons: dict[int, Lesson]) -> dict:
    return {"id": x["id"], "kind": x["kind"], "title": x["title"], "date": x["date"].isoformat(),
            "score": x["score"], "total": x["total"], "pct": x["pct"], "prev_pct": x["prev_pct"],
            "attempt": x["attempt"], "skills": _skills_out(x["skills"], lessons)}


@router.get("/me")
def my_results(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    tests, lessons = _collect(db, user.id)
    states = compute_states(db, user.id)
    # где теряются баллы: по всем тестам, по каждой теме — сколько баллов потеряно из скольких
    agg: dict[int, list] = defaultdict(lambda: [0, 0, None])
    for x in tests:
        for lid, (c, n) in x["skills"].items():
            agg[lid][0] += n - c
            agg[lid][1] += n
            if n - c:
                agg[lid][2] = x["date"]
    topics = [{"lesson": lessons[lid].slug, "title": lessons[lid].title, "lost": lost, "total": total,
               "last_lost": last.isoformat() if last else None,
               "status": states[lid].status if lid in states else "unknown"}
              for lid, (lost, total, last) in agg.items() if lid in lessons and lost]
    topics.sort(key=lambda t: (-t["lost"], t["title"].get("ru", "") if isinstance(t["title"], dict) else ""))
    return {"tests": [_test_out(x, lessons) for x in reversed(tests)], "topics": topics}


@router.get("/me/{test_id}")
def my_result(test_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    tests, lessons = _collect(db, user.id)
    x = next((t for t in tests if t["id"] == test_id), None)
    if not x:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    out = _test_out(x, lessons)
    mistakes = []
    for t, choice in x["wrong"]:
        l = lessons.get(t.lesson_id)
        err = t.option_errors[choice] if choice is not None and t.option_errors and 0 <= choice < len(t.option_errors) else ""
        mistakes.append({"task_id": t.id, "lesson": l.slug if l else None, "lesson_title": l.title if l else None,
                         "question": t.question, "options": t.options, "choice": choice, "answer": t.answer,
                         "explanation": t.explanation, "error": err if err in ERROR_KINDS else ""})
    out["mistakes"] = mistakes
    return out


def wrong_on_task(db: Session, user_id: int, task_id: int) -> bool:
    """Ученик ошибался в этом задании — значит, AI Tutor может разобрать именно его."""
    return db.scalar(select(LearningEvent.id).where(LearningEvent.user_id == user_id, LearningEvent.task_id == task_id,
                                                    LearningEvent.correct.is_(False)).limit(1)) is not None

