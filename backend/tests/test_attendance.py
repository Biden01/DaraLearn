from datetime import date, datetime, timedelta

from sqlalchemy import func, select

from app.modules.content.models import Task
from app.modules.plan import attendance as attendance_mod
from app.modules.plan.attendance import LOCAL_TZ, attendance_for, summary
from app.modules.plan.router import today_local
from app.modules.school.models import StreakFreezeUse, User
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
    s = summary(u, present, mon - timedelta(days=2), today, frozen=set(), balance=0)
    st = {d["day"]: d["status"] for d in s["days"]}
    assert st[(mon - timedelta(days=1)).isoformat()] == "none"       # до регистрации
    assert st[(mon + timedelta(days=1)).isoformat()] == "absent"     # вторник пропущен
    assert st[(mon + timedelta(days=5)).isoformat()] == "off"        # суббота без занятий — не пропуск
    assert st[today.isoformat()] == "today"                          # сегодня ещё не занимался — не пропуск
    # учебных дней пн–пт + пн = 6, занимался 4; серия: пт, (сб, вс), пн — выходные не рвут
    assert (s["present"], s["school_days"], s["rate"]) == (4, 6, 0.67)
    assert s["streak"] == 3 and s["today"] is False and s["last_present"] == (mon + timedelta(days=7)).isoformat()


def test_summary_freeze_bridges_one_absence_not_two():
    mon = date(2026, 10, 5)  # понедельник
    u = User(created_at=datetime.combine(mon, datetime.min.time(), LOCAL_TZ))
    today = mon + timedelta(days=2)  # среда
    present = {mon, today}  # пн и ср — вт пропущен
    s = summary(u, present, mon, today, frozen=set(), balance=1)
    st = {d["day"]: d["status"] for d in s["days"]}
    tue = (mon + timedelta(days=1)).isoformat()
    assert st[tue] == "frozen" and s["streak"] == 3 and s["newly_frozen"] == date.fromisoformat(tue)
    assert s["freezes"] == 0  # заморозка потрачена

    # без запаса — пропуск остаётся пропуском, серия рвётся
    s0 = summary(u, present, mon, today, frozen=set(), balance=0)
    assert s0["days"][1]["status"] == "absent" and s0["streak"] == 1 and s0["newly_frozen"] is None

    # два пропуска подряд — одна заморозка спасает только один из них, серия с понедельником не соединяется
    present2 = {mon, mon + timedelta(days=3)}  # пн, чт; вт и ср пропущены
    s2 = summary(u, present2, mon, mon + timedelta(days=3), frozen=set(), balance=2)
    assert s2["days"][1]["status"] == "absent" and s2["days"][2]["status"] == "frozen"
    assert s2["streak"] == 2  # ср (заморожена) + чт; понедельник отрезан вторником


def test_attendance_for_persists_freeze_use_and_grants_milestone(db, monkeypatch):
    s = register()
    uid = s.ok("GET", "/api/auth/me")["id"]
    user = db.get(User, uid)
    mon = date(2026, 10, 5)  # понедельник — независимо от реальной сегодняшней даты
    user.created_at = datetime.combine(mon, datetime.min.time(), LOCAL_TZ)
    user.streak_freezes = 1
    db.commit()

    present_fixed = {uid: {mon, mon + timedelta(days=2)}}  # пн и ср присутствовал, вт — нет
    monkeypatch.setattr(attendance_mod, "present_days", lambda db, ids, first, last: present_fixed)

    out = attendance_for(db, [user], mon + timedelta(days=2), 10)[uid]
    assert out["streak"] == 3 and out["freezes"] == 0
    db.refresh(user)
    assert user.streak_freezes == 0
    assert db.scalar(select(func.count()).select_from(StreakFreezeUse).where(
        StreakFreezeUse.user_id == uid, StreakFreezeUse.day == mon + timedelta(days=1))) == 1

    # повторный запрос не списывает заморозку заново (день уже отмечен как frozen)
    out2 = attendance_for(db, [user], mon + timedelta(days=2), 10)[uid]
    assert out2["freezes"] == 0 and out2["streak"] == 3


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
