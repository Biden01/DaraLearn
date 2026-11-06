from app.modules.content.models import Lesson, Task
from tests.conftest import diagnostic, register


def test_live_lesson_shows_stuck_called_and_groups(school, db):
    teacher, code, cid = school["teacher"], school["class"]["code"], school["class"]["id"]
    a, b, c, d = (register(code=code, name=n) for n in ("Әлия", "Бекзат", "Дана", "Ерлан"))
    lid = db.query(Lesson).filter(Lesson.slug == "sqrt").one().id
    tasks = db.query(Task).filter(Task.lesson_id == lid, Task.purpose == "practice").order_by(Task.id).all()

    def wrong(c, n):
        for t in (tasks * 3)[:n]:
            c.ok("POST", "/api/events/practice", json={"task_id": t.id, "choice": (t.answer + 1) % len(t.options)})

    wrong(a, 3)  # три ошибки подряд — застрял
    wrong(b, 3)
    t = tasks[0]
    c.ok("POST", "/api/events/practice", json={"task_id": t.id, "choice": t.answer})  # работает
    sess = d.ok("POST", "/api/tutor/sessions", 201, json={"lesson": "sqrt"})
    d.ok("POST", f"/api/tutor/sessions/{sess['id']}/call-teacher", json={"text": "Түсінбедім"})  # позвал учителя

    live = teacher.ok("GET", f"/api/state/classes/{cid}/live")
    st = {r["name"]: r for r in live["students"]}
    assert st["Әлия"]["status"] == "stuck" and st["Бекзат"]["status"] == "stuck" and st["Әлия"]["wrong_streak"] == 3
    assert st["Дана"]["status"] == "active" and st["Дана"]["correct"] == 1
    assert st["Ерлан"]["status"] == "called" and st["Ерлан"]["call"]["text"] == "Түсінбедім"
    assert live["students"][0]["name"] == "Ерлан"  # позвавшие — первыми
    assert live["counts"]["stuck"] == 2 and live["counts"]["called"] == 1
    g = live["groups"]
    assert len(g) == 1 and set(g[0]["students"]) >= {"Әлия", "Бекзат"}  # одна тема — объяснить вместе

    other = register(name="Чужой")
    assert other.get(f"/api/state/classes/{cid}/live").status_code == 403
    assert school["admin"].get(f"/api/state/classes/{cid}/live").status_code == 200
