"""Fake-пилот: полный цикл на тестовых учениках без участия разработчика.

Импорт baseline → состояние → решения → план дня → Tutor → проверка → отложенная проверка → результат.
"""
import io
from datetime import datetime, timedelta, timezone

from openpyxl import Workbook

from app.modules.content.models import Task
from app.modules.plan import rules as plan_rules
from app.modules.verification.models import Check
from tests.conftest import register, uid


def _xlsx(rows: list[list]) -> bytes:
    wb = Workbook()
    for r in rows:
        wb.active.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _answer_all(client, db, tasks) -> dict:
    return {str(t["id"]): db.get(Task, t["id"]).answer for t in tasks}


def test_fake_pilot_full_cycle(school, db):
    teacher, curator, cls = school["teacher"], school["curator"], school["class"]

    # 1. Учитель задаёт тему класса, ученики входят по коду класса
    teacher.ok("PUT", f"/api/plan/classes/{cls['id']}/topic", json={"course": "quadratic-equations"})
    emails = [f"fp{uid()}@test.kz" for _ in range(3)]
    kids = [register(email=e, code=cls["code"], name=f"Ученик {i}") for i, e in enumerate(emails)]
    ids = [k.ok("GET", "/api/auth/me")["id"] for k in kids]

    # 2. Baseline ПҚС из Excel: ученики 0 и 1 не справились с sqrt и linear-eq, ученик 2 всё сдал
    rows = []
    for e, ok in zip(emails, (0, 0, 1)):
        for slug in ("brackets", "sqrt", "linear-eq", "qe-def"):
            rows.append([e, slug, ok if slug in ("sqrt", "linear-eq") else 1, ""])
    imp = teacher.ok("POST", "/api/events/import", files={"file": ("pqs.xlsx", _xlsx(rows), "application/octet-stream")})
    assert imp["saved"] == 12 and imp["error_count"] == 0 and imp["students"] == 3

    # 3. Состояние ученика: пробелы найдены, ПҚС считается verified
    st = kids[0].ok("GET", "/api/state/me")
    by = {x["slug"]: x for x in st["lessons"]}
    assert by["sqrt"]["status"] == "gap" and by["linear-eq"]["status"] == "gap"

    # 4. Решения: у ученика причина-база, у класса групповое объяснение (2 из 3)
    feed = teacher.ok("GET", f"/api/decisions/feed?class_id={cls['id']}")
    actions = {(i.get("lesson"), i["action"]) for i in feed["items"]}
    assert ("sqrt", "group") in actions or ("linear-eq", "group") in actions
    assert all(i["status"] == "new" for i in feed["items"])

    # 5. План дня: Tutor идёт по prerequisite, который блокирует тему класса, объём фиксированный
    plan = kids[0].ok("GET", "/api/plan/today")
    items = {i["block"]: i for i in plan["items"]}
    assert items["tutor"]["reason"] in ("prereq", "carried") and items["tutor"]["lesson"] in ("linear-eq", "sqrt")
    assert plan["total_minutes"] == plan_rules.TOTAL_MIN
    lesson = items["tutor"]["lesson"]

    # 6. Занятие с Tutor: ошибка → подсказки → разбор → проверка 7–9
    sid = kids[0].ok("POST", "/api/tutor/sessions", 201, json={"lesson": lesson})["id"]
    task = kids[0].ok("GET", f"/api/tutor/sessions/{sid}/task")["task"]
    wrong = (db.get(Task, task["id"]).answer + 1) % 4
    assert not kids[0].ok("POST", f"/api/tutor/sessions/{sid}/attempt", json={"choice": wrong})["correct"]
    for _ in range(4):
        kids[0].ok("POST", f"/api/tutor/sessions/{sid}/hint")
    kids[0].ok("POST", f"/api/tutor/sessions/{sid}/stage", json={"stage": 6})
    chk = kids[0].ok("GET", f"/api/tutor/sessions/{sid}/check")
    done = kids[0].ok("POST", f"/api/tutor/sessions/{sid}/check", json={"answers": _answer_all(kids[0], db, chk["tasks"])})
    assert done["session"]["result"] == "passed"

    # 7. Запись сессии вернулась в данные; пункт плана выполнен автоматически
    rec = kids[0].ok("GET", f"/api/tutor/sessions/{sid}/record")
    assert rec["hints_used"] == 4 and rec["verification_result"] == "passed" and rec["skill_id"] == lesson
    plan = kids[0].ok("GET", "/api/plan/today")
    assert {i["block"]: i["status"] for i in plan["items"]}["tutor"] == "done"

    # 8. Отложенная проверка: срок наступил → тест → Outcome «помогло»
    checks = kids[0].ok("GET", "/api/verification/checks")
    assert len(checks) == 1
    for c in db.query(Check).filter(Check.user_id == ids[0], Check.status == "pending"):
        c.due_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    a = kids[0].ok("POST", "/api/verification/attempts", 201, json={"kind": "verification", "check_id": checks[0]["id"]})
    r = kids[0].ok("POST", f"/api/verification/attempts/{a['id']}/submit",
                   json={"answers": _answer_all(kids[0], db, a["tasks"])})
    assert r["outcome"]["helped"] is True

    # 9. Результат виден: состояние обновилось, у учителя и куратора есть картина, у админа — метрики
    after = {x["slug"]: x for x in kids[0].ok("GET", "/api/state/me")["lessons"]}
    assert after[lesson]["proof"] > by[lesson]["proof"]
    cm = teacher.ok("GET", f"/api/state/classes/{cls['id']}")
    assert len(cm["students"]) == 3
    assert curator.ok("GET", "/api/verification/adviser") is not None
    assert school["admin"].ok("GET", "/api/admin/metrics")
    # ученик 2 (всё сдал) получил план без prerequisite-пробела
    p2 = {i["block"]: i for i in kids[2].ok("GET", "/api/plan/today")["items"]}
    assert p2["tutor"]["reason"] == "current"
