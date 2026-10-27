"""Тесты гоняются против отдельной Postgres (DATABASE_URL). Перед сессией — миграции и seed."""
import os
import uuid

import pytest

os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("ADMIN_EMAILS", '["admin@test.kz"]')

from fastapi.testclient import TestClient  # noqa: E402

from app import migrate  # noqa: E402
from app.core.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    migrate.main()


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


def uid() -> str:
    return uuid.uuid4().hex[:8]


class Client(TestClient):
    def ok(self, method: str, url: str, expect: int = 200, **kw):
        r = self.request(method, url, **kw)
        assert r.status_code == expect, f"{method} {url} → {r.status_code}: {r.text[:300]}"
        return r.json() if r.content and r.headers.get("content-type", "").startswith("application/json") else r


def client() -> Client:
    return Client(app, headers={"x-forwarded-for": f"10.0.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"})


def register(email: str | None = None, code: str = "", **extra) -> Client:
    c = client()
    c.ok("POST", "/api/auth/register", 201, json={"email": email or f"s{uid()}@test.kz", "password": "secret123",
                                                  "name": extra.pop("name", "Ученик"), "grade": 8, "code": code, **extra})
    return c


@pytest.fixture
def admin() -> Client:
    c = client()
    r = c.post("/api/auth/login", json={"login": "admin@test.kz", "password": "secret123"})
    if r.status_code != 200:
        c = register("admin@test.kz", name="Admin")
    return c


@pytest.fixture
def school(admin):
    """Школа + учитель + куратор + класс с кодом."""
    s = admin.ok("POST", "/api/school/schools", 201, json={"name": f"Школа {uid()}", "city": "Астана"})
    t_inv = admin.ok("POST", f"/api/school/schools/{s['id']}/invites", 201, json={"role": "teacher"})
    c_inv = admin.ok("POST", f"/api/school/schools/{s['id']}/invites", 201, json={"role": "curator"})
    teacher = register(code=t_inv["code"], name="Учитель")
    curator = register(code=c_inv["code"], name="Куратор")
    cls = teacher.ok("POST", "/api/school/classes", 201, json={"name": "8А", "grade": 8})
    return {"school": s, "teacher": teacher, "curator": curator, "class": cls, "admin": admin}


def tasks_key():
    """slug урока → индекс верного ответа диагностического задания (из data.py)."""
    from app.modules.content.data import COURSES
    return {l["slug"]: next(t[3] for t in l["tasks"] if t[0] == "d") for c in COURSES for l in c["lessons"]}


def diagnostic(c: Client, wrong: set[str] = frozenset()) -> dict:
    """Пройти диагностику: верно везде, кроме уроков из wrong."""
    from app.modules.content.data import COURSES
    order = [l["slug"] for co in COURSES for l in co["lessons"]]
    key = tasks_key()
    a = c.ok("POST", "/api/verification/attempts", 201, json={"kind": "diagnostic", "subject": "math"})
    ans = {str(t["id"]): (key[slug] + 1) % 4 if slug in wrong else key[slug] for t, slug in zip(a["tasks"], order)}
    return c.ok("POST", f"/api/verification/attempts/{a['id']}/submit", json={"answers": ans})
