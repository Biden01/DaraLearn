"""Нагрузка учителя до/после и опрос удобства (docs/PLAN.md, раздел 7)."""
from datetime import date, timedelta

from app.core.config import settings
from app.modules.analytics.router import _today
from tests.conftest import register


def test_teacher_workload_before_after(school, monkeypatch):
    teacher, admin = school["teacher"], school["admin"]
    today = _today()
    monkeypatch.setattr(settings, "pilot_start", today)  # вчера — «до», сегодня — «после»
    y = today - timedelta(days=1)

    teacher.ok("PUT", f"/api/analytics/workload/{y}", json={"checking_min": 60, "errors_min": 30})
    teacher.ok("PUT", f"/api/analytics/workload/{y}", json={"checking_min": 50, "errors_min": 30})  # правка того же дня
    r = teacher.ok("PUT", f"/api/analytics/workload/{today}", json={"checking_min": 30, "errors_min": 10, "note": " тест "})
    assert r["phase"] == "after" and r["note"] == "тест"

    me = teacher.ok("GET", "/api/analytics/workload/me")
    assert [e["day"] for e in me["entries"]] == [today.isoformat(), y.isoformat()]
    s = me["stats"]
    assert s["before"]["total"] == 80 and s["after"]["total"] == 40 and s["change"] == -0.5

    # будущее, слишком старый день, отрицательные минуты, чужая роль
    assert teacher.put(f"/api/analytics/workload/{today + timedelta(days=1)}", json={"checking_min": 1, "errors_min": 1}).status_code == 422
    assert teacher.put(f"/api/analytics/workload/{today - timedelta(days=31)}", json={"checking_min": 1, "errors_min": 1}).status_code == 422
    assert teacher.put(f"/api/analytics/workload/{today}", json={"checking_min": -1, "errors_min": 1}).status_code == 422
    kid = register(code=school["class"]["code"])
    assert kid.put(f"/api/analytics/workload/{today}", json={"checking_min": 1, "errors_min": 1}).status_code == 403

    m = admin.ok("GET", "/api/admin/metrics")
    assert m["teacher_workload"]["after"]["days"] >= 1 and m["teacher_workload"]["pilot_start"] == today.isoformat()


def test_survey_once_per_week(school):
    teacher, admin = school["teacher"], school["admin"]
    kid = register(code=school["class"]["code"])
    assert kid.ok("GET", "/api/analytics/survey/me")["due"] is True

    kid.ok("PUT", "/api/analytics/survey", json={"ease": 4, "useful": 5, "recommend": 3, "comment": "удобно"})
    kid.ok("PUT", "/api/analytics/survey", json={"ease": 5, "useful": 5, "recommend": 4})  # повтор за неделю — правка
    me = kid.ok("GET", "/api/analytics/survey/me")
    assert me["due"] is False and me["answer"]["ease"] == 5 and date.fromisoformat(me["week"]).weekday() == 0

    teacher.ok("PUT", "/api/analytics/survey", json={"ease": 3, "useful": 4, "recommend": 4, "comment": "экономит время"})
    assert kid.put("/api/analytics/survey", json={"ease": 6, "useful": 1, "recommend": 1}).status_code == 422
    assert admin.put("/api/analytics/survey", json={"ease": 3, "useful": 3, "recommend": 3}).status_code == 403

    s = admin.ok("GET", "/api/admin/metrics")["survey"]
    assert s["student"]["n"] >= 1 and s["teacher"]["n"] >= 1
    assert any(c["text"] == "экономит время" and c["role"] == "teacher" for c in s["comments"])
    assert all("user" not in c for c in s["comments"])  # комментарии без имён
