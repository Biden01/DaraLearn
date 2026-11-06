import io

from openpyxl import Workbook, load_workbook

import pytest

from tests.conftest import uid


@pytest.fixture(autouse=True)
def _cleanup_lessons(db):
    """Тесты создают навыки без заданий; в общей базе они ломают другие тесты, поэтому убираем за собой."""
    yield
    from app.modules.content.models import Lesson

    db.rollback()
    db.query(Lesson).filter(Lesson.slug.like("skill-%") | Lesson.slug.like("cyc-%")).delete(synchronize_session=False)
    db.commit()


def _xlsx(rows):
    wb = Workbook()
    for r in rows:
        wb.active.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _upload(admin, rows, expect=200):
    return admin.ok("POST", "/api/content/admin/skills/import", expect,
                    files={"file": ("skills.xlsx", _xlsx(rows), "application/octet-stream")})


HEAD = ["course", "slug", "title_kk", "title_ru", "minutes", "prereqs", "theory_kk", "theory_ru"]


def test_skills_export_import_roundtrip(admin):
    r = admin.ok("GET", "/api/content/admin/skills.xlsx")
    rows = list(load_workbook(io.BytesIO(r.content)).active.iter_rows(min_row=2, values_only=True))
    assert any(x[1] == "sqrt" for x in rows)
    # новый навык с prerequisite на существующий; существующий не ломается
    slug = f"skill-{uid()}"
    out = _upload(admin, [HEAD, ["quadratic-equations", slug, "Атауы", "Название", 15, "sqrt, brackets", "Теория\n$ x²", "Теория ru"]])
    assert out["created"] == 1 and not out["errors"]
    lesson = admin.ok("GET", f"/api/content/admin/lessons/{slug}")
    assert lesson["prereqs"] == ["sqrt", "brackets"] and lesson["theory"]["kk"] == ["Теория", "$ x²"]
    assert _upload(admin, [HEAD, ["quadratic-equations", slug, "Жаңа", "Новое", 20, "sqrt", "A", "B"]])["updated"] == 1


def test_skills_import_rejects_bad_rows_and_cycles(admin):
    a, b = f"cyc-a-{uid()}", f"cyc-b-{uid()}"
    bad = _upload(admin, [HEAD, ["nope", a, "x", "y", 10, "", "t", "t"], ["quadratic-equations", b, "x", "y", 10, "ghost", "t", "t"]])
    assert {e["field"] for e in bad["errors"]} == {"course", "prereqs"} and bad["created"] == 0
    r = admin.post("/api/content/admin/skills/import", files={"file": ("s.xlsx", _xlsx([
        HEAD, ["quadratic-equations", a, "x", "y", 10, b, "t", "t"], ["quadratic-equations", b, "x", "y", 10, a, "t", "t"]]),
        "application/octet-stream")})
    assert r.status_code == 400 and r.json()["detail"].startswith("prereq_cycle")
    assert admin.get(f"/api/content/admin/lessons/{a}").status_code == 404  # ничего не сохранилось


def test_coverage_reports_what_is_missing(admin):
    c = admin.ok("GET", "/api/content/admin/coverage")
    sqrt = next(s for s in c["skills"] if s["slug"] == "sqrt")
    assert set(sqrt["have"]) == {"diagnostic", "practice", "verification"} and c["tasks_needed"] == c["total"] * 8
    assert c["ready"] <= c["total"]


def test_generated_templates_are_importable(admin):
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
    import build_content_templates as b

    buf = io.BytesIO()
    b.skills_map().save(buf)
    out = admin.ok("POST", "/api/content/admin/skills/import",
                   files={"file": ("s.xlsx", buf.getvalue(), "application/octet-stream")})
    assert not out["errors"] and out["updated"] >= 12
    buf = io.BytesIO()
    b.tasks().save(buf)  # пустой лист tasks: загрузка ничего не создаёт и не ломается
    out = admin.ok("POST", "/api/content/admin/tasks/import",
                   files={"file": ("t.xlsx", buf.getvalue(), "application/octet-stream")})
    assert out == {"created": 0, "updated": 0, "errors": []}


HEAD10 = HEAD + ["teacher_ok", "teacher_comment"]


def test_teacher_review_of_theory(admin):
    slug = f"skill-{uid()}"
    row = ["quadratic-equations", slug, "Атауы", "Название", 15, "", "Ереже\n$ x²", "Правило\n$ x²"]
    out = _upload(admin, [HEAD10, row + ["да", "Тексерілді"]])
    assert out["created"] == 1 and out["theory_ok"] == 1
    sk = lambda: next(s for s in admin.ok("GET", "/api/content/admin/coverage")["skills"] if s["slug"] == slug)
    assert sk()["theory_ok"] and sk()["theory_comment"] == "Тексерілді"
    # пустая колонка и та же теория — отметка остаётся
    _upload(admin, [HEAD10, row + ["", ""]])
    assert sk()["theory_ok"]
    # теорию поправили — проверять заново
    _upload(admin, [HEAD10, row[:6] + ["Ереже\n$ x³", "Правило\n$ x³", "", ""]])
    assert not sk()["theory_ok"]
    # учитель ответил «нет» с комментарием
    _upload(admin, [HEAD10, row[:6] + ["Ереже\n$ x³", "Правило\n$ x³", "да", ""]])
    _upload(admin, [HEAD10, row[:6] + ["Ереже\n$ x³", "Правило\n$ x³", "нет", "Қате формула"]])
    assert not sk()["theory_ok"] and sk()["theory_comment"] == "Қате формула"
    bad = _upload(admin, [HEAD10, row + ["может быть", ""]])
    assert bad["errors"] == [{"row": 2, "field": "teacher_ok"}]
    exported = load_workbook(io.BytesIO(admin.ok("GET", "/api/content/admin/skills.xlsx").content)).active
    r = next(x for x in exported.iter_rows(min_row=2, values_only=True) if x[1] == slug)
    assert r[8] in ("", None) and r[9] == "Қате формула"


def test_generate_task_drafts(admin, monkeypatch):
    from app.modules.tutor import gateway

    assert admin.post("/api/content/admin/lessons/sqrt/generate", json={}).status_code in (503,)  # без ключа — честный отказ
    monkeypatch.setattr(gateway, "enabled", lambda: True)
    seen = {}

    def complete(system, msgs):
        seen["prompt"] = msgs[0]["content"]
        return ('```json\n{"tasks": ['
                '{"question": {"kk": "√49 = ?", "ru": "√49 = ?"}, "options": ["7", "-7", "49", {"kk": "жоқ", "ru": "нет"}],'
                ' "answer": 0, "explanation": {"kk": "7² = 49", "ru": "7² = 49"}},'
                '{"question": {"kk": "x", "ru": "x"}, "options": ["1", "1", "2", "3"], "answer": 0,'
                ' "explanation": {"kk": "-", "ru": "-"}},'
                '{"question": {"kk": "", "ru": "пусто"}, "options": ["1", "2", "3", "4"], "answer": 9,'
                ' "explanation": {"kk": "-", "ru": "-"}}]}\n```', 100, 200)
    monkeypatch.setattr(gateway, "complete", complete)
    before = len(admin.ok("GET", "/api/content/admin/lessons/sqrt")["tasks"])
    out = admin.ok("POST", "/api/content/admin/lessons/sqrt/generate", json={"purpose": "verification", "count": 3})
    assert "verification" in seen["prompt"] and "Теория" in seen["prompt"]
    assert len(out["drafts"]) == 1  # дубли вариантов и пустой вопрос / неверный индекс отброшены
    d = out["drafts"][0]
    assert d["purpose"] == "verification" and d["options"][d["answer"]] == "7"  # верный ответ сохранился после перемешивания
    assert len(admin.ok("GET", "/api/content/admin/lessons/sqrt")["tasks"]) == before  # черновик в банк не попал

    t = admin.ok("POST", "/api/content/admin/tasks", 201, json={"lesson": "sqrt", **d, "ai": True})
    assert t["source"] == "ai"
    admin.ok("DELETE", f"/api/content/admin/tasks/{t['id']}", 204)

    monkeypatch.setattr(gateway, "complete", lambda s, m: ("не JSON", 1, 1))
    assert admin.post("/api/content/admin/lessons/sqrt/generate", json={}).status_code == 422
    assert admin.post("/api/content/admin/lessons/sqrt/generate", json={"count": 9}).status_code == 422
    assert admin.post("/api/content/admin/lessons/nope-xx/generate", json={}).status_code == 404
