from app.modules.content.models import Task
from app.modules.tutor import gateway
from tests.conftest import diagnostic, register


def _session(s, lesson="sqrt"):
    return s.ok("POST", "/api/tutor/sessions", 201, json={"lesson": lesson})["id"]


def test_correct_first_attempt_skips_help(db):
    s = register()
    diagnostic(s, wrong={"sqrt"})
    sid = _session(s)
    task = s.ok("GET", f"/api/tutor/sessions/{sid}/task")["task"]
    assert "answer" not in task
    r = s.ok("POST", f"/api/tutor/sessions/{sid}/attempt", json={"choice": db.get(Task, task["id"]).answer})
    assert r["correct"] and r["next_stage"] == 7
    assert s.post(f"/api/tutor/sessions/{sid}/attempt", json={"choice": 0}).status_code == 409
    rec = s.ok("GET", f"/api/tutor/sessions/{sid}/record")
    assert rec["first_attempt_correct"] is True and rec["hints_used"] == 0 and rec["skill_id"] == "sqrt"


def test_wrong_attempt_opens_hint_ladder_and_record(db):
    s = register()
    diagnostic(s, wrong={"sqrt"})
    sid = _session(s)
    task = s.ok("GET", f"/api/tutor/sessions/{sid}/task")["task"]
    wrong = (db.get(Task, task["id"]).answer + 1) % 4
    r = s.ok("POST", f"/api/tutor/sessions/{sid}/attempt", json={"choice": wrong})
    assert not r["correct"] and r["next_stage"] == 4 and r["explanation"] is None  # ключ не раскрываем
    levels = [s.ok("POST", f"/api/tutor/sessions/{sid}/hint") for _ in range(4)]
    assert [x["level"] for x in levels] == [1, 2, 3, 4] and levels[3]["check_required"] and levels[3]["hint"]
    assert s.post(f"/api/tutor/sessions/{sid}/hint").status_code == 409
    s.ok("POST", f"/api/tutor/sessions/{sid}/stage", json={"stage": 6})
    chk = s.ok("GET", f"/api/tutor/sessions/{sid}/check")
    assert [t["step"] for t in chk["tasks"]] == [7, 8, 9]
    answers = {str(t["id"]): db.get(Task, t["id"]).answer for t in chk["tasks"]}
    assert s.ok("POST", f"/api/tutor/sessions/{sid}/check", json={"answers": answers})["session"]["result"] == "passed"
    rec = s.ok("GET", f"/api/tutor/sessions/{sid}/record")
    assert rec["first_attempt_correct"] is False and rec["hints_used"] == 4 and rec["verification_result"] == "passed"
    assert rec["style_used"] == "worked_example" and rec["student_id"].startswith("pseudo-") and rec["escalated"] is False


def test_call_teacher_button_goes_to_feed(school):
    t, cls = school["teacher"], school["class"]
    kid = register(code=cls["code"])
    diagnostic(kid, wrong={"sqrt"})
    sid = _session(kid)
    kid.ok("POST", f"/api/tutor/sessions/{sid}/call-teacher", json={"text": "Не понимаю корни"})
    kid.ok("POST", f"/api/tutor/sessions/{sid}/call-teacher", json={"text": "ещё раз"})  # без дублей
    feed = t.ok("GET", "/api/decisions/feed")
    items = [x for x in (feed if isinstance(feed, list) else feed.get("items", [])) if x.get("comment") == "Не понимаю корни"]
    assert len(items) == 1 and items[0]["needs_teacher"]
    assert kid.ok("GET", f"/api/tutor/sessions/{sid}/record")["escalated"] is True


def test_low_confidence_marker_escalates_and_is_hidden(monkeypatch):
    monkeypatch.setattr(gateway, "enabled", lambda: True)
    monkeypatch.setattr(gateway, "complete", lambda system, msgs: (
        "[[LOW_CONFIDENCE]] Не уверен. [[MISCONCEPTION: путает корень и квадрат]]", 10, 5))
    s = register()
    diagnostic(s, wrong={"sqrt"})
    sid = _session(s)
    reply = s.ok("POST", f"/api/tutor/sessions/{sid}/messages", json={"text": "Чему равен корень?"})["reply"]["content"]
    assert "[[" not in reply and "Не уверен" in reply
    rec = s.ok("GET", f"/api/tutor/sessions/{sid}/record")
    assert rec["tutor_confidence"] == "low" and rec["escalated"] and rec["misconception"] == "путает корень и квадрат"
    assert rec["prompt_version"] == "tutor-v3"


def test_free_topic_is_grounded_in_subject_theory(monkeypatch):
    seen = {}
    monkeypatch.setattr(gateway, "enabled", lambda: True)

    def complete(system, msgs):
        seen["system"] = system
        return "Ок", 1, 1

    monkeypatch.setattr(gateway, "complete", complete)
    s = register()
    sid = s.ok("POST", "/api/tutor/sessions", 201, json={})["id"]
    s.ok("POST", f"/api/tutor/sessions/{sid}/messages", json={"text": "Как раскрыть скобки?"})
    assert "a(b + c) = ab + ac" in seen["system"] and "D = b² − 4ac" in seen["system"]


def test_lesson_without_theory_goes_to_teacher_without_llm(db, monkeypatch):
    from app.modules.content.models import Lesson

    monkeypatch.setattr(gateway, "enabled", lambda: True)
    monkeypatch.setattr(gateway, "complete", lambda *a: (_ for _ in ()).throw(AssertionError("LLM не должен вызываться")))
    l = db.query(Lesson).filter_by(slug="sqrt").one()
    saved = dict(l.theory)
    try:
        l.theory = {"kk": [], "ru": []}
        db.commit()
        s = register()
        sid = _session(s)
        reply = s.ok("POST", f"/api/tutor/sessions/{sid}/messages", json={"text": "Что такое корень?"})["reply"]["content"]
        assert "мұғалім" in reply or "учител" in reply
        assert s.ok("GET", f"/api/tutor/sessions/{sid}/record")["escalated"]
    finally:
        l.theory = saved
        db.commit()
