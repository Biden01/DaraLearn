from tests.conftest import diagnostic, register


def test_parent_links_by_code_and_sees_child_read_only(school):
    kid = register(code=school["class"]["code"], name="Айгерим")
    diagnostic(kid, wrong={"sqrt"})
    code = kid.ok("POST", "/api/parents/code")["code"]
    assert kid.ok("GET", "/api/parents/mine")["code"] == code

    parent = register(code=code, name="Мама")  # регистрация сразу с кодом ребёнка
    assert parent.ok("GET", "/api/auth/me")["role"] == "parent"
    kids = parent.ok("GET", "/api/parents/children")
    assert len(kids) == 1 and kids[0]["name"] == "Айгерим"
    k = kids[0]
    assert {"today", "streak", "progress", "skills", "checks_due", "goal"} <= set(k)
    assert any(x["status"] == "gap" for x in k["skills"])  # видит пробел ребёнка
    assert "recommendations" not in k and "class" not in k  # без чужих данных и сравнения

    mine = kid.ok("GET", "/api/parents/mine")
    assert mine["code"] is None and [p["name"] for p in mine["parents"]] == ["Мама"]  # код одноразовый

    # родителю закрыты кабинеты ученика/учителя, ученику — кабинет родителя
    assert parent.get("/api/plan/attendance").status_code == 403
    assert parent.get("/api/decisions/feed").status_code == 403
    assert kid.get("/api/parents/children").status_code == 403

    # второй ребёнок — тем же аккаунтом через /join; чужой код и свой код не проходят
    kid2 = register(name="Бауыржан")
    code2 = kid2.ok("POST", "/api/parents/code")["code"]
    assert kid2.post("/api/parents/join", json={"code": code2}).status_code == 400  # свой код
    assert school["teacher"].post("/api/parents/join", json={"code": code2}).status_code == 400  # учитель — не родитель
    assert kid.post("/api/parents/join", json={"code": code2}).status_code == 400  # ученик из класса — не родитель
    parent.ok("POST", "/api/parents/join", json={"code": code2})
    assert len(parent.ok("GET", "/api/parents/children")) == 2
    assert parent.post("/api/parents/join", json={"code": code2}).status_code == 400  # код уже использован

    # отключение: ученик убирает родителя
    link_id = mine["parents"][0]["id"]
    assert kid2.delete(f"/api/parents/links/{link_id}").status_code == 404  # чужая связь
    kid.ok("DELETE", f"/api/parents/links/{link_id}", 204)
    assert [k["name"] for k in parent.ok("GET", "/api/parents/children")] == ["Бауыржан"]
