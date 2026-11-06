from app.modules.content.models import Lesson, Task
from tests.conftest import diagnostic, register


def test_teacher_assist_quiz_exit_and_plan(school, db, monkeypatch):
    from app.modules.tutor import gateway
    teacher, code, cid = school["teacher"], school["class"]["code"], school["class"]["id"]
    kids = [register(code=code, name=n) for n in ("Әлия", "Бекзат")]
    t = db.query(Task).filter(Task.lesson_id == db.query(Lesson).filter(Lesson.slug == "sqrt").one().id,
                              Task.purpose == "practice").order_by(Task.id).first()
    wrong = (t.answer + 1) % len(t.options)
    old = t.option_errors
    t.option_errors = ["calc" if i == wrong else "" for i in range(len(t.options))]
    db.commit()
    try:
        for k in kids:
            diagnostic(k, wrong={"sqrt"})
            k.ok("POST", "/api/events/practice", json={"task_id": t.id, "choice": wrong})
        a = teacher.ok("GET", f"/api/state/classes/{cid}/assist", params={"lesson": "sqrt"})
        assert set(a["gap"]) == {"Әлия", "Бекзат"} and a["errors"]["calc"] == 2
        assert 1 <= len(a["quiz"]) <= 5 and all("answer" in x for x in a["quiz"])  # для учителя — с ответами
        assert len(a["exit"]) >= 1

        assert teacher.post(f"/api/state/classes/{cid}/assist/plan", json={"lesson": "sqrt"}).status_code == 503  # без ключа
        monkeypatch.setattr(gateway, "enabled", lambda: True)
        seen = {}

        def complete(system, msgs):
            seen["system"], seen["user"] = system, msgs[0]["content"]
            return "## Цель\nПонять √", 10, 20
        monkeypatch.setattr(gateway, "complete", complete)
        r = teacher.ok("POST", f"/api/state/classes/{cid}/assist/plan", json={"lesson": "sqrt", "lang": "kk"})
        assert r["text"].startswith("## Цель") and "казахский" in seen["system"]
        assert "ошибаются в вычислениях" in seen["user"] and "с пробелом — 2" in seen["user"]

        assert teacher.get(f"/api/state/classes/{cid}/assist", params={"lesson": "nope"}).status_code == 404
        assert register(name="Чужой").get(f"/api/state/classes/{cid}/assist", params={"lesson": "sqrt"}).status_code == 403
    finally:
        t.option_errors = old
        db.commit()
