from app.modules.content.models import Task
from tests.conftest import diagnostic, register, uid


def _tutor_pass(kid, db, lesson="sqrt"):
    sid = kid.ok("POST", "/api/tutor/sessions", 201, json={"lesson": lesson})["id"]
    kid.ok("GET", f"/api/tutor/sessions/{sid}/task")
    kid.ok("POST", f"/api/tutor/sessions/{sid}/hint")
    kid.ok("POST", f"/api/tutor/sessions/{sid}/stage", json={"stage": 6})
    chk = kid.ok("GET", f"/api/tutor/sessions/{sid}/check")
    kid.ok("POST", f"/api/tutor/sessions/{sid}/check",
           json={"answers": {str(t["id"]): db.get(Task, t["id"]).answer for t in chk["tasks"]}})


def test_pilot_metrics_treatment_vs_control(school, db):
    admin, teacher = school["admin"], school["teacher"]
    t_cls = school["class"]
    c_cls = teacher.ok("POST", "/api/school/classes", 201, json={"name": "8Б", "grade": 8})
    admin.ok("PUT", f"/api/analytics/classes/{t_cls['id']}/arm", json={"arm": "treatment"})
    admin.ok("PUT", f"/api/analytics/classes/{c_cls['id']}/arm", json={"arm": "control"})
    assert teacher.put(f"/api/analytics/classes/{t_cls['id']}/arm", json={"arm": "control"}).status_code == 403

    treat, ctrl = register(code=t_cls["code"]), register(code=c_cls["code"])
    for k in (treat, ctrl):
        diagnostic(k, wrong={"sqrt"})
    _tutor_pass(treat, db)
    treat.ok("GET", "/api/plan/today")

    m = teacher.ok("GET", "/api/analytics/pilot")
    t, c = m["treatment"], m["control"]
    assert t["students"] == 1 and c["students"] == 1
    assert t["verified_gain"] == 1.0  # sqrt: baseline неверно → после Tutor три верных проверки без подсказок
    assert c["verified_gain"] is None and c["tutor_sessions_per_student_week"] == 0
    assert t["tutor_sessions_per_student_week"] == 1.0
    assert m["north_star"] is None  # у control пока нет подтверждённого роста
    assert m["targets"]["plan_completion"] == 0.6
