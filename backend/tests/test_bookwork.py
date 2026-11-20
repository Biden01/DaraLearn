"""«Показать решение» (PLAN.md §9 #6): выключено по умолчанию; включено — AI или учитель решает."""
from app.core.config import settings
from app.modules.tutor import gateway
from tests.conftest import register


def _attempt(s) -> dict:
    return s.ok("POST", "/api/verification/attempts", 201,
               json={"kind": "verification", "subject": "math", "lesson": "sqrt"})


def _upload(s, attempt_id: int, task_id: int, expect: int = 201):
    return s.request("POST", f"/api/verification/bookwork/attempts/{attempt_id}/tasks/{task_id}/photo",
                     files={"file": ("p.jpg", b"fake-photo-bytes", "image/jpeg")})


def test_disabled_by_default_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "bookwork_check_enabled", False)
    s = register()
    a = _attempt(s)
    r = _upload(s, a["id"], a["tasks"][0]["id"])
    assert r.status_code == 503


def test_ai_ok_auto_resolves(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "bookwork_check_enabled", True)
    monkeypatch.setattr(settings, "bookwork_storage_dir", str(tmp_path))
    monkeypatch.setattr(gateway, "enabled", lambda: True)
    monkeypatch.setattr(gateway, "complete_vision", lambda *a, **k: ("OK\nшаги верны", 10, 5))
    s = register()
    a = _attempt(s)
    task_id = a["tasks"][0]["id"]
    r = _upload(s, a["id"], task_id)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["status"] == "ok" and out["ai_verdict"] == "ok"
    mine = s.ok("GET", "/api/verification/bookwork/mine")
    assert mine[0]["id"] == out["id"]
    assert list(tmp_path.iterdir())  # фото сохранено на диск


def test_without_ai_key_goes_straight_to_teacher(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "bookwork_check_enabled", True)
    monkeypatch.setattr(settings, "bookwork_storage_dir", str(tmp_path))
    monkeypatch.setattr(gateway, "enabled", lambda: False)
    s = register()
    a = _attempt(s)
    out = _upload(s, a["id"], a["tasks"][0]["id"]).json()
    assert out["status"] == "flagged" and out["ai_verdict"] == ""


def test_wrong_verdict_flags_for_teacher_who_can_decide(school, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "bookwork_check_enabled", True)
    monkeypatch.setattr(settings, "bookwork_storage_dir", str(tmp_path))
    monkeypatch.setattr(gateway, "enabled", lambda: True)
    monkeypatch.setattr(gateway, "complete_vision", lambda *a, **k: ("WRONG\nшаги не ведут к ответу", 10, 5))
    teacher, cls = school["teacher"], school["class"]
    kid = register(code=cls["code"])
    a = _attempt(kid)
    chk = _upload(kid, a["id"], a["tasks"][0]["id"]).json()
    assert chk["status"] == "flagged" and chk["ai_verdict"] == "wrong"

    q = teacher.ok("GET", "/api/verification/bookwork/queue")
    assert any(c["id"] == chk["id"] for c in q)

    out = teacher.ok("POST", f"/api/verification/bookwork/{chk['id']}/decision",
                     json={"approve": False, "note": "похоже на списывание"})
    assert out["status"] == "rejected" and out["teacher_note"] == "похоже на списывание"
    assert teacher.ok("GET", "/api/verification/bookwork/queue") == []


def test_teacher_cannot_decide_for_invisible_student(school, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "bookwork_check_enabled", True)
    monkeypatch.setattr(settings, "bookwork_storage_dir", str(tmp_path))
    monkeypatch.setattr(gateway, "enabled", lambda: True)
    monkeypatch.setattr(gateway, "complete_vision", lambda *a, **k: ("WRONG\nнет решения", 10, 5))
    outsider = register()  # не в классе school["class"]
    a = _attempt(outsider)
    chk = _upload(outsider, a["id"], a["tasks"][0]["id"]).json()

    teacher = school["teacher"]
    r = teacher.post(f"/api/verification/bookwork/{chk['id']}/decision", json={"approve": True})
    assert r.status_code == 404
