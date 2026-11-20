from tests.test_pqs_import import _post
from tests.conftest import diagnostic, register, uid


def test_results_tests_topics_mistakes_and_tutor_link(school):
    kid = register(code=school["class"]["code"])
    diagnostic(kid, wrong={"sqrt"})
    r = kid.ok("GET", "/api/results/me")
    (test,) = r["tests"]
    assert test["kind"] == "diagnostic" and test["total"] - test["score"] == 1 and test["prev_pct"] is None
    assert test["skills"][0]["lesson"] == "sqrt" and test["skills"][0]["lost"] == 1  # потери — первыми
    assert [t["lesson"] for t in r["topics"]] == ["sqrt"]

    d = kid.ok("GET", f"/api/results/me/{test['id']}")
    (m,) = d["mistakes"]
    assert m["lesson"] == "sqrt" and m["choice"] != m["answer"] and m["question"]

    # повторная диагностика: виден прирост относительно прошлой
    diagnostic(kid)
    again = kid.ok("GET", "/api/results/me")["tests"][0]
    assert again["pct"] == 100 and again["prev_pct"] == test["pct"]

    # AI Tutor: сессия на именно это неверное задание
    s = kid.ok("POST", "/api/tutor/sessions", 201, json={"task": m["task_id"]})
    assert s["lesson"]["slug"] == "sqrt" and s["task"] == m["task_id"] and s["goal"] == f"mistake:{m['task_id']}"
    assert kid.ok("GET", f"/api/tutor/sessions/{s['id']}/task")["task"]["id"] == m["task_id"]
    # чужую ошибку разбирать нельзя: сессия открывается без фокуса
    other = register(code=school["class"]["code"])
    s2 = other.ok("POST", "/api/tutor/sessions", 201, json={"task": m["task_id"]})
    assert s2["task"] is None and s2["lesson"] is None

    kid.ok("GET", "/api/results/me/a999999", 404)
    other.ok("GET", f"/api/results/me/{test['id']}", 404)


def test_results_pqs_import_is_a_test(school):
    name = f"Пкс Ученик{uid()}"
    kid = register(code=school["class"]["code"], name=name)
    _post(school["teacher"], [["ФИО", "Навык", "Результат", "Дата"],
                              [name, "sqrt", "0", "2026-10-01"], [name, "linear-eq", "1", "2026-10-01"]])
    r = kid.ok("GET", "/api/results/me")
    (pqs,) = [t for t in r["tests"] if t["kind"] == "pqs"]
    assert pqs["id"] == "pqs-2026-10-01" and (pqs["score"], pqs["total"]) == (1, 2)
    assert {t["lesson"] for t in r["topics"]} == {"sqrt"}
    assert kid.ok("GET", "/api/results/me/pqs-2026-10-01")["mistakes"] == []
