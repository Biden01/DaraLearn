"""Расписание учителя и анализ прогресса учеников."""
from tests.conftest import diagnostic, register, uid


def test_teacher_schedule_crud_overlap_and_access(school):
    t, cls, admin = school["teacher"], school["class"], school["admin"]
    a = t.ok("POST", "/api/school/schedule", 201, json={"class_id": cls["id"], "weekday": 0, "start": "08:30", "room": "214"})
    assert a["class_name"] == "8А" and a["minutes"] == 45 and a["room"] == "214"
    t.ok("POST", "/api/school/schedule", 201, json={"class_id": cls["id"], "weekday": 2, "start": "10:05", "minutes": 40})
    # пересечение по времени у того же учителя — отказ; встык — можно
    r = t.post("/api/school/schedule", json={"class_id": cls["id"], "weekday": 0, "start": "09:00"})
    assert r.status_code == 409 and r.json()["detail"] == "overlap"
    t.ok("POST", "/api/school/schedule", 201, json={"class_id": cls["id"], "weekday": 0, "start": "09:15"})
    # неверные данные
    assert t.post("/api/school/schedule", json={"class_id": cls["id"], "weekday": 6, "start": "09:00"}).status_code == 422
    assert t.post("/api/school/schedule", json={"class_id": cls["id"], "weekday": 1, "start": "9:00"}).status_code == 422
    rows = t.ok("GET", "/api/school/schedule")
    assert [(x["weekday"], x["start"]) for x in rows] == [(0, "08:30"), (0, "09:15"), (2, "10:05")]
    assert sum(x["minutes"] for x in rows) == 130

    # чужой учитель не видит, не добавляет и не удаляет
    other = register(code=admin.ok("POST", f"/api/school/schools/{school['school']['id']}/invites", 201,
                                   json={"role": "teacher"})["code"], name="Другой")
    assert other.ok("GET", "/api/school/schedule") == []
    assert other.post("/api/school/schedule", json={"class_id": cls["id"], "weekday": 1, "start": "08:00"}).status_code == 404
    assert other.delete(f"/api/school/schedule/{a['id']}").status_code == 404
    # ученик и куратор — нет доступа
    assert register(code=cls["code"]).get("/api/school/schedule").status_code == 403
    assert school["curator"].get("/api/school/schedule").status_code == 403

    t.ok("DELETE", f"/api/school/schedule/{a['id']}", 204)
    assert len(t.ok("GET", "/api/school/schedule")) == 2


def test_students_progress(school):
    t, cls = school["teacher"], school["class"]
    kid = register(code=cls["code"], name=f"Ученик {uid()}")
    register(code=cls["code"], name="Молчун")  # без активности
    diagnostic(kid, wrong={"sqrt"})
    d = t.ok("GET", "/api/state/progress")
    assert [c["id"] for c in d["classes"]] == [cls["id"]]
    rows = {r["name"]: r for r in d["students"]}
    me = next(r for n, r in rows.items() if n.startswith("Ученик"))
    assert me["class_name"] == "8А" and me["total"] > 0 and 0 <= me["percent"] <= 100
    assert len(me["weeks"]) == 6 and me["weeks"][-1]["answers"] > 0 and me["weeks"][-1]["accuracy"] is not None
    assert me["active_days_14"] == 1 and me["last_active"] == d["today"]
    assert me["tests"] and me["tests"][-1]["kind"] == "diagnostic"
    quiet = rows["Молчун"]
    assert quiet["last_active"] is None and quiet["tests"] == [] and all(w["answers"] == 0 for w in quiet["weeks"])
    # фильтр по классу и доступ
    assert len(t.ok("GET", f"/api/state/progress?class_id={cls['id']}")["students"]) == 2
    assert len(school["curator"].ok("GET", "/api/state/progress")["students"]) >= 2
    assert kid.get("/api/state/progress").status_code == 403
    other = register(code=school["admin"].ok("POST", f"/api/school/schools/{school['school']['id']}/invites", 201,
                                             json={"role": "teacher"})["code"])
    assert other.get(f"/api/state/progress?class_id={cls['id']}").status_code == 404
