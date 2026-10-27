from datetime import date, datetime, timedelta, timezone

from app.modules.content.models import Lesson
from app.modules.plan import rules
from app.modules.plan.models import DailyPlan, PlanItem
from app.modules.plan.service import needs_curator
from tests.conftest import diagnostic, register


def _items(plan: dict) -> dict:
    return {i["block"]: i for i in plan["items"]}


def test_plan_fixed_volume_and_idempotent():
    s = register()
    diagnostic(s, wrong={"sqrt", "brackets"})
    p = s.ok("GET", "/api/plan/today")
    items = _items(p)
    assert p["total_minutes"] == rules.TOTAL_MIN and p["rules_version"] == rules.RULES_VERSION
    assert sum(i["minutes"] for i in p["items"]) == rules.TOTAL_MIN
    assert {"tutor", "practice"} <= set(items)
    assert 3 <= len(items["practice"]["tasks"]) <= 5
    assert all("answer" not in t for t in items["practice"]["tasks"])
    assert s.ok("GET", "/api/plan/today")["id"] == p["id"]


def test_plan_tutor_goes_to_prerequisite_gap(school):
    t, cls = school["teacher"], school["class"]
    t.ok("PUT", f"/api/plan/classes/{cls['id']}/topic", json={"course": "quadratic-equations"})
    kid = register(code=cls["code"])
    diagnostic(kid, wrong={"linear-eq", "qe-def", "discriminant"})
    tutor = _items(kid.ok("GET", "/api/plan/today"))["tutor"]
    # тема класса — квадратные уравнения, но её блокирует линейное уравнение
    assert tutor["lesson"] == "linear-eq" and tutor["reason"] == "prereq"
    overview = t.ok("GET", f"/api/plan/classes/{cls['id']}")
    assert overview["topic"]["course"] == "quadratic-equations" and overview["students"][0]["has_plan"]


def test_plan_progress_from_answers(db):
    from app.modules.content.models import Task

    s = register()
    diagnostic(s, wrong={"sqrt"})
    items = _items(s.ok("GET", "/api/plan/today"))
    assert items["practice"]["status"] == "pending"
    for t in items["practice"]["tasks"]:
        task = db.get(Task, t["id"])
        s.ok("POST", "/api/events/practice", json={"task_id": task.id, "choice": task.answer})
    p = s.ok("GET", "/api/plan/today")
    assert _items(p)["practice"]["status"] == "done" and p["done_minutes"] == rules.PRACTICE_MIN


def test_teacher_topic_rules(school):
    t, cls = school["teacher"], school["class"]
    t.ok("PUT", f"/api/plan/classes/{cls['id']}/topic", 404, json={"course": "nope"})
    kid = register(code=cls["code"])
    assert kid.put(f"/api/plan/classes/{cls['id']}/topic", json={"course": "linear-equations"}).status_code == 403
    assert t.ok("PUT", f"/api/plan/classes/{cls['id']}/topic", json={"course": "linear-equations"})["course"] == "linear-equations"


def test_missed_days_go_to_curator(db):
    s = register()
    uid_ = s.ok("GET", "/api/auth/me")["id"]
    lesson = db.query(Lesson).first()
    today = date.today()
    assert not needs_curator(db, uid_, today)
    for d in (1, 2, 3):
        plan = DailyPlan(user_id=uid_, day=today - timedelta(days=d), rules_version="t", total_minutes=35,
                         created_at=datetime.now(timezone.utc) - timedelta(days=d))
        db.add(plan)
        db.flush()
        db.add(PlanItem(plan_id=plan.id, block="practice", lesson_id=lesson.id, minutes=12, task_ids=[]))
    db.commit()
    assert needs_curator(db, uid_, today)
