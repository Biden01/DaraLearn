from datetime import date, datetime, timedelta, timezone

from app.modules.content.models import Lesson
from app.modules.plan import rules
from app.modules.plan.models import DailyPlan, PlanItem
from app.modules.plan.models import GoalTopic, MonthlyGoal
from app.modules.plan.service import build_goal, build_plan, goal_schedule, goal_topics, needs_curator, week_of
from app.modules.school.models import User
from tests.conftest import diagnostic, register


def _items(plan: dict) -> dict:
    return {i["block"]: i for i in plan["items"]}


def test_plan_fixed_volume_and_idempotent():
    s = register()
    diagnostic(s, wrong={"sqrt", "brackets"})
    p = s.ok("GET", "/api/plan/today")
    items = _items(p)
    assert p["total_minutes"] == rules.TOTAL_MIN
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
    p = kid.ok("GET", "/api/plan/today")
    tutor = _items(p)["tutor"]
    # тема класса — квадратные уравнения, но цель месяца ставит базу первой: линейное уравнение
    assert p["goal"]["topics"][0]["lesson"] == "linear-eq"
    assert tutor["lesson"] == "linear-eq" and tutor["reason"] in ("current", "prereq")
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


def test_plan_answer_endpoint(db):
    from app.modules.content.models import Task

    s = register()
    diagnostic(s, wrong={"sqrt"})
    items = _items(s.ok("GET", "/api/plan/today"))
    p = items["practice"]
    t = p["tasks"][0]
    r = s.ok("POST", f"/api/plan/items/{p['id']}/answer", json={"task_id": t["id"], "choice": db.get(Task, t["id"]).answer})
    assert r["correct"] is True and r["explanation"]
    assert _items(s.ok("GET", "/api/plan/today"))["practice"]["answered"] == [t["id"]]
    assert s.post(f"/api/plan/items/{p['id']}/answer", json={"task_id": t["id"], "choice": 0}).status_code == 409
    assert s.post(f"/api/plan/items/{items['tutor']['id']}/answer", json={"task_id": t["id"], "choice": 0}).status_code == 404
    c = items.get("check")
    if c:  # мини-проверка: пока не отвечены все, результат скрыт
        first = c["tasks"][0]
        r = s.ok("POST", f"/api/plan/items/{c['id']}/answer", json={"task_id": first["id"], "choice": 0})
        assert r["correct"] is None and r["explanation"] is None


def test_goal_topics_from_gaps_student_sees_no_weeks(school, monkeypatch):
    monkeypatch.setattr("app.modules.plan.router.today_local", lambda: date(2026, 11, 2))
    t, cls = school["teacher"], school["class"]
    kid = register(code=cls["code"])
    diagnostic(kid, wrong={"vieta", "sqrt", "word-problems", "brackets"})
    goal = kid.ok("GET", "/api/plan/today")["goal"]
    # базовые темы раньше зависимых, ученику — только цель, темы и их состояние
    assert [x["lesson"] for x in goal["topics"]] == ["brackets", "sqrt", "word-problems", "vieta"]
    assert goal["done"] == 0 and goal["total"] == 4
    assert all(set(x) == {"lesson", "title", "status"} for x in goal["topics"])
    assert "weeks" not in goal and "rules_version" not in goal
    # темы по дням: со 2-го по 7-е — скобки, неделя 2 — корень, ..., с 22-го до конца месяца — Виет
    days = {d["day"]: d for d in goal["days"]}
    assert goal["days"][0]["day"] == "2026-11-02" and len(goal["days"]) == 29
    assert days["2026-11-02"] == {"day": "2026-11-02", "topics": ["brackets"], "state": "today"}
    assert days["2026-11-10"]["topics"] == ["sqrt"] and days["2026-11-10"]["state"] == "upcoming"
    assert days["2026-11-15"]["topics"] == ["word-problems"] and days["2026-11-30"]["topics"] == ["vieta"]
    sid = kid.ok("GET", "/api/auth/me")["id"]
    month = t.ok("GET", f"/api/plan/students/{sid}/month")["goal"]
    assert [w["topics"] for w in month["weeks"]] == [["brackets"], ["sqrt"], ["word-problems"], ["vieta"]]
    assert month["topics"][0]["start_status"] == "gap"
    assert kid.get(f"/api/plan/students/{sid}/month").status_code == 403
    assert t.ok("GET", f"/api/plan/classes/{cls['id']}")["students"][0]["goal"] == {"done": 0, "total": 4}


def test_daily_plan_follows_week_of_goal(db):
    s = register()
    diagnostic(s, wrong={"vieta", "sqrt", "word-problems", "brackets"})
    user = db.get(User, s.ok("GET", "/api/auth/me")["id"])
    by_week = {}
    for day in (date(2026, 11, 2), date(2026, 11, 9), date(2026, 11, 16), date(2026, 11, 24)):
        plan = build_plan(db, user, day)
        tutor = db.query(PlanItem).filter_by(plan_id=plan.id, block="tutor").one()
        by_week[week_of(day)] = db.get(Lesson, tutor.lesson_id).slug
    db.rollback()
    assert by_week == {1: "brackets", 2: "sqrt", 3: "word-problems", 4: "vieta"}
    assert week_of(date(2026, 11, 30)) == 4


def test_teacher_rebuilds_goals_after_pqs(school):
    t, cls = school["teacher"], school["class"]
    kid = register(code=cls["code"])
    diagnostic(kid, wrong={"sqrt"})
    assert [x["lesson"] for x in kid.ok("GET", "/api/plan/today")["goal"]["topics"]] == ["sqrt"]
    assert school["curator"].post(f"/api/plan/classes/{cls['id']}/goals/rebuild").status_code == 403
    diagnostic(kid, wrong={"sqrt", "brackets"})  # новые результаты: появился ещё один пробел
    assert [x["lesson"] for x in kid.ok("GET", "/api/plan/today")["goal"]["topics"]] == ["sqrt"]  # цель месяца не скачет сама
    assert t.ok("POST", f"/api/plan/classes/{cls['id']}/goals/rebuild")["rebuilt"] == 1
    assert [x["lesson"] for x in kid.ok("GET", "/api/plan/today")["goal"]["topics"]] == ["brackets", "sqrt"]


def _goal(db, user, day, slugs):
    """Цель с заданными темами в порядке программы (без диагностики)."""
    lessons = {l.slug: l for l in db.query(Lesson)}
    goal = MonthlyGoal(user_id=user.id, month=day.replace(day=1), starts_on=day, rules_version="t")
    db.add(goal)
    db.flush()
    first = week_of(day)
    k = rules.WEEKS - first + 1
    n = len(slugs)
    db.add_all([GoalTopic(goal_id=goal.id, lesson_id=lessons[x].id, week=first + (i * k // n if n >= k else i), order=i,
                          start_status="gap", start_proof=0) for i, x in enumerate(slugs)])
    db.flush()
    by_id = {l.id: l.slug for l in lessons.values()}
    return {d: [by_id[i] for i in ids] for d, ids in goal_schedule(goal, goal_topics(db, goal)).items()}


def test_schedule_splits_week_days_between_topics(db):
    s = register()
    user = db.get(User, s.ok("GET", "/api/auth/me")["id"])
    sched = _goal(db, user, date(2026, 11, 1), ["brackets", "fsu", "sqrt", "linear-eq", "qe-def", "discriminant",
                                                "roots-formula", "vieta"])
    db.rollback()
    # неделя 1 (1–7): 7 дней на 2 темы — 4 дня первой, 3 второй; у каждого дня ровно одна тема
    assert [sched[date(2026, 11, d)] for d in range(1, 8)] == [["brackets"]] * 4 + [["fsu"]] * 3
    assert all(len(v) == 1 for v in sched.values()) and len(sched) == 30
    # неделя 4 (22–30): 9 дней на 2 темы
    assert [sched[date(2026, 11, d)][0] for d in (22, 26, 27, 30)] == ["roots-formula", "roots-formula", "vieta", "vieta"]


def test_goal_built_mid_month_uses_remaining_weeks(db):
    s = register()
    diagnostic(s, wrong={"vieta", "sqrt", "word-problems", "brackets"})
    user = db.get(User, s.ok("GET", "/api/auth/me")["id"])
    goal = build_goal(db, user, date(2026, 12, 20))  # неделя 3: прошедшие недели пропускаем
    weeks = [t.week for t in goal_topics(db, goal)]
    sched = goal_schedule(goal, goal_topics(db, goal))
    db.rollback()
    assert weeks == [3, 3, 4, 4] and min(sched) == date(2026, 12, 20) and max(sched) == date(2026, 12, 31)
    assert all(sched.values())


def test_more_topics_than_days_share_a_day(db):
    s = register()
    user = db.get(User, s.ok("GET", "/api/auth/me")["id"])
    sched = _goal(db, user, date(2026, 11, 29), ["brackets", "fsu", "sqrt"])  # осталось 2 дня
    db.rollback()
    assert sched == {date(2026, 11, 29): ["brackets", "fsu"], date(2026, 11, 30): ["sqrt"]}
