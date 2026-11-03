from tests.conftest import register


def test_dev_board_roundtrip(admin):
    assert register().get("/api/dev/board").status_code == 403
    t = admin.ok("POST", "/api/dev/tasks", 201, json={"title": "Доска", "assignee": "daul", "points": 3, "column": "todo"})
    assert admin.post("/api/dev/tasks", json={"title": "x", "assignee": "bob"}).status_code == 422
    admin.ok("PATCH", f"/api/dev/tasks/{t['id']}", json={"column": "done", "position": 0.5})
    board = admin.ok("GET", "/api/dev/board")
    assert board["team"] == ["era", "daul", "ali", "gala"]
    assert any(x["id"] == t["id"] and x["column"] == "done" for x in board["tasks"])
    closed = admin.ok("POST", "/api/dev/sprint/close")
    assert closed["closed"] >= 1 and closed["sprint"] == board["sprint"]
    assert all(x["id"] != t["id"] for x in admin.ok("GET", "/api/dev/board")["tasks"])
    assert admin.ok("GET", "/api/dev/sprints")[0]["sprint"] == closed["sprint"]
    keep = admin.ok("POST", "/api/dev/tasks", 201, json={"title": "Удалить"})
    admin.ok("DELETE", f"/api/dev/tasks/{keep['id']}", 204)
