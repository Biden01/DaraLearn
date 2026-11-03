from datetime import date, datetime, timedelta

from app.modules.content.models import Task
from app.modules.plan.attendance import LOCAL_TZ, summary
from app.modules.plan.router import today_local
from app.modules.school.models import User
from tests.conftest import diagnostic, register


def _do_practice(c, db):
    """Ответить на все задания закрепления сегодняшнего плана — это один выполненный шаг."""
    plan = c.ok("GET", "/api/plan/today")
    practice = next(i for i in plan["items"] if i["block"] == "practice")
    for t in practice["tasks"]:
        task = db.get(Task, t["id"])
        c.ok("POST", "/api/events/practice", json={"task_id": task.id, "choice": task.answer})


def test_summary_weekends_today_and_streak():
    mon = date(2026, 10, 5)  # понедельник
    u = User(created_at=datetime.combine(mon, datetime.min.time(), LOCAL_TZ))
    today = mon + timedelta(days=8)  # вторник следующей недели
    present = {mon, mon + timedelta(days=3), mon + timedelta(days=4), mon + timedelta(days=7)}  # пн, чт, пт, пн
    s = summary(u, present, mon - timedelta(days=2), today)
    st = {d["day"]: d["status"] for d in s["days"]}
    assert st[(mon - timedelta(days=1)).isoformat()] == "none"       # до регистрации
    assert st[(mon + timedelta(days=1)).isoformat()] == "absent"     # вторник пропущен
    assert st[(mon + timedelta(days=5)).isoformat()] == "off"        # суббота без занятий — не пропуск
    assert st[today.isoformat()] == "today"                          # сегодня ещё не занимался — не пропуск
    # учебных дней пн–пт + пн = 6, занимался 4; серия: пт, (сб, вс), пн — выходные не рвут
    assert (s["present"], s["school_days"], s["rate"]) == (4, 6, 0.67)
    assert s["streak"] == 3 and s["today"] is False and s["last_present"] == (mon + timedelta(days=7)).isoformat()


def test_student_attendance_counts_completed_step(db):
    s = register()
    diagnostic(s, wrong={"sqrt"})
    a = s.ok("GET", "/api/plan/attendance")
    assert a["today"] is False and a["days"][-1]["day"] == today_local().isoformat()
    assert a["days"][-1]["status"] in ("today", "off")  # в выходной — «выходной», не пропуск
    _do_practice(s, db)
    a = s.ok("GET", "/api/plan/attendance")
    assert a["today"] is True and a["streak"] == 1 and a["days"][-1]["status"] == "present"


def test_teacher_sees_who_is_missing(school, db):
    t, cls = school["teacher"], school["class"]
    kid1 = register(code=cls["code"], name="Айгерим")
    kid2 = register(code=cls["code"], name="Бауыржан")
    for k in (kid1, kid2):
        diagnostic(k, wrong={"sqrt"})
    _do_practice(kid1, db)

    ov = next(x for x in t.ok("GET", "/api/plan/attendance/overview") if x["class_id"] == cls["id"])
    assert (ov["present"], ov["total"]) == (1, 2) and [m["name"] for m in ov["missing"]] == ["Бауыржан"]

    table = t.ok("GET", f"/api/plan/classes/{cls['id']}/attendance")["students"]
    by_name = {r["name"]: r for r in table}
    assert by_name["Айгерим"]["today"] and not by_name["Бауыржан"]["today"]
    assert len(by_name["Айгерим"]["days"]) == 14

    sid = by_name["Бауыржан"]["id"]
    one = school["curator"].ok("GET", f"/api/plan/students/{sid}/attendance")
    assert one["today"] is False and len(one["days"]) == 35
    kid1.ok("GET", f"/api/plan/students/{sid}/attendance", 403)
    t.ok("GET", "/api/plan/attendance", 403)
