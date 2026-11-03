"""Замер времени учителя до/после и опрос удобства (docs/PLAN.md, раздел 7)."""
from datetime import date

from app.modules.analytics.feedback import QUESTIONS, suggested_phase

from tests.conftest import register, uid


def _row(summary: dict, user_id: int) -> dict:
    return next(r for r in summary["workload"]["teachers"] if r["id"] == user_id)


def test_suggested_phase():
    assert suggested_phase(date(2026, 10, 26)) == "before"
    assert suggested_phase(date(2026, 11, 2)) == "before"  # пн–пт 02–06.11 прошли до старта 07.11
    assert suggested_phase(date(2026, 11, 9)) == "after"


def test_teacher_time_log_before_after(school):
    teacher, admin = school["teacher"], school["admin"]
    admin.ok("PUT", f"/api/analytics/classes/{school['class']['id']}/arm", json={"arm": "treatment"})
    tid = teacher.ok("GET", "/api/auth/me")["id"]

    t = teacher.ok("GET", "/api/analytics/time")
    assert t["items"] == [] and t["suggested_phase"] in ("before", "after")

    # любой день недели сохраняется как понедельник; повтор той же недели — обновление, а не дубль
    teacher.ok("PUT", "/api/analytics/time", json={"week": "2026-10-28", "phase": "before",
                                                   "check_minutes": 200, "review_minutes": 100})
    x = teacher.ok("PUT", "/api/analytics/time", json={"week": "2026-10-26", "phase": "before",
                                                       "check_minutes": 240, "review_minutes": 120, "note": " обычная "})
    assert x["week"] == "2026-10-26" and x["total"] == 360 and x["note"] == "обычная"
    teacher.ok("PUT", "/api/analytics/time", json={"week": "2026-10-19", "phase": "before",
                                                   "check_minutes": 200, "review_minutes": 80})
    teacher.ok("PUT", "/api/analytics/time", json={"week": "2026-11-02", "phase": "after",
                                                   "check_minutes": 150, "review_minutes": 60})
    items = teacher.ok("GET", "/api/analytics/time")["items"]
    assert [i["week"] for i in items] == ["2026-11-02", "2026-10-26", "2026-10-19"]

    # проверки ввода
    assert teacher.put("/api/analytics/time", json={"week": "2099-01-05", "phase": "after", "check_minutes": 1,
                                                    "review_minutes": 1}).status_code == 400
    assert teacher.put("/api/analytics/time", json={"week": "2026-10-12", "phase": "before", "check_minutes": -5,
                                                    "review_minutes": 1}).status_code == 422
    assert teacher.put("/api/analytics/time", json={"week": "2026-10-12", "phase": "later", "check_minutes": 5,
                                                    "review_minutes": 1}).status_code == 422

    # ученик и куратор не вводят время; чужую запись удалить нельзя
    kid = register(code=school["class"]["code"])
    assert kid.get("/api/analytics/time").status_code == 403
    assert school["curator"].get("/api/analytics/time").status_code == 403
    other = register(code=admin.ok("POST", f"/api/school/schools/{school['school']['id']}/invites", 201,
                                   json={"role": "teacher"})["code"], name="Другой учитель")
    assert other.delete(f"/api/analytics/time/{items[0]['id']}").status_code == 404

    # сводка: среднее по неделям каждой фазы, изменение «после» к «до»
    assert teacher.get("/api/analytics/feedback").status_code == 403
    row = _row(admin.ok("GET", "/api/analytics/feedback"), tid)
    assert row["arm"] == "treatment"
    assert row["before"] == {"check": 220.0, "review": 100.0, "total": 320.0, "weeks": 2}
    assert row["after"] == {"check": 150.0, "review": 60.0, "total": 210.0, "weeks": 1}

    teacher.ok("DELETE", f"/api/analytics/time/{items[0]['id']}", 204)
    row = _row(admin.ok("GET", "/api/analytics/feedback"), tid)
    assert row["after"]["weeks"] == 0 and row["after"]["total"] is None


def test_workload_paired_only(admin, db):
    """В паре «до/после» учитываются только учителя, у которых есть обе фазы."""
    from app.modules.analytics.feedback import _paired
    rows = [
        {"before": {"check": 200, "review": 100, "total": 300, "weeks": 2}, "after": {"check": 100, "review": 50, "total": 150, "weeks": 1}},
        {"before": {"check": 100, "review": 100, "total": 200, "weeks": 1}, "after": {"check": 100, "review": 50, "total": 150, "weeks": 1}},
        {"before": {"check": 999, "review": 999, "total": 1998, "weeks": 1}, "after": {"check": None, "review": None, "total": None, "weeks": 0}},
    ]
    p = _paired(rows)
    assert p["teachers"] == 2
    assert p["before"]["total"] == 250.0 and p["after"]["total"] == 150.0
    assert p["change"] == -0.4
    assert _paired([])["change"] is None


def test_survey_student_and_teacher(school):
    teacher, admin = school["teacher"], school["admin"]
    admin.ok("PUT", f"/api/analytics/classes/{school['class']['id']}/arm", json={"arm": "control"})
    kid = register(code=school["class"]["code"])

    s = kid.ok("GET", "/api/analytics/survey")
    assert s["answered"] is False and s["questions"] == QUESTIONS["student"]
    assert teacher.ok("GET", "/api/analytics/survey")["questions"] == QUESTIONS["teacher"]
    assert school["curator"].get("/api/analytics/survey").status_code == 403

    full = {q: 4 for q in QUESTIONS["student"]}
    # нужны все вопросы своей роли и только оценки 1–5
    assert kid.put("/api/analytics/survey", json={"answers": {"easy": 5}}).status_code == 400
    assert kid.put("/api/analytics/survey", json={"answers": {**full, "easy": 6}}).status_code == 422
    assert kid.put("/api/analytics/survey", json={"answers": {q: 3 for q in QUESTIONS["teacher"]}}).status_code == 400

    first, second = f"Сначала было непонятно {uid()}", f"Tutor помог {uid()}"
    kid.ok("PUT", "/api/analytics/survey", json={"answers": full, "comment": first})
    r = kid.ok("PUT", "/api/analytics/survey", json={"answers": {**full, "easy": 2}, "comment": f" {second} "})
    assert r["answered"] is True and r["answers"]["easy"] == 2 and r["comment"] == second
    teacher.ok("PUT", "/api/analytics/survey", json={"answers": {q: 5 for q in QUESTIONS["teacher"]}})

    sv = admin.ok("GET", "/api/analytics/feedback")["survey"]
    st, te = sv["roles"]["student"], sv["roles"]["teacher"]
    assert st["responses"] >= 1 and te["responses"] >= 1
    assert st["by_arm"]["control"]["responses"] >= 1 and te["by_arm"]["control"]["responses"] >= 1
    assert set(st["questions"]) == set(QUESTIONS["student"])
    # комментарии без имён; повторный ответ заменил первый
    mine = [c for c in sv["comments"] if c["text"] in (first, second)]
    assert [c["text"] for c in mine] == [second] and mine[0]["arm"] == "control"
    assert all("name" not in c for c in sv["comments"])
