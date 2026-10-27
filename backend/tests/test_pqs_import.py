import io

from openpyxl import Workbook

from app.modules.events import pqs
from tests.conftest import register, uid


def _xlsx(rows):
    wb = Workbook()
    for r in rows:
        wb.active.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _post(teacher, rows, query=""):
    return teacher.ok("POST", f"/api/events/import{query}",
                      files={"file": ("pqs.xlsx", _xlsx(rows), "application/octet-stream")})


def test_parse_result_variants():
    p = pqs.parse_result
    assert p("1") is True and p("Нет") is False and p("") is None
    assert p("75%") is True and p("0,4") is False and p("3/4") is True and p("1/5") is False and p("85") is True
    assert p("abc") is pqs.BAD and p("150") is pqs.BAD and p("1/0") is pqs.BAD


def test_wide_format_names_titles_percent_dry_run_and_duplicates(school):
    t, cls = school["teacher"], school["class"]
    name = f"Тестов Ученик{uid()}"
    kid = register(code=cls["code"], name=name)
    inverted = " ".join(reversed(name.split()))  # «Ученик… Тестов»: порядок слов не важен
    rows = [["ФИО", "sqrt", "Теңдеулер ::нет такого", "linear-eq", "Итого"],
            [inverted, "30%", "1", "4/5", "7"]]
    dry = _post(t, rows, "?dry_run=true")
    assert dry["format"] == "wide" and dry["dry_run"] and dry["saved"] == 2
    assert {e["values"][0] for e in dry["errors"]} == {"Теңдеулер ::нет такого", "Итого"}  # лишние колонки названы, не ломают
    assert kid.ok("GET", "/api/state/me")["progress"]["mastered"] == 0 and not any(
        x["n_indep"] for x in kid.ok("GET", "/api/state/me")["lessons"])  # dry_run ничего не записал
    first = _post(t, rows)
    assert first["saved"] == 2 and first["students"] == 1
    again = _post(t, rows)
    assert again["saved"] == 0 and again["duplicates"] == 2  # повторная загрузка не удваивает
    by = {x["slug"]: x for x in kid.ok("GET", "/api/state/me")["lessons"]}
    assert by["sqrt"]["status"] == "gap" and by["linear-eq"]["n_indep"] == 1


def test_ambiguous_name_and_bad_cell(school):
    t, cls = school["teacher"], school["class"]
    twin = f"Двойной Ученик{uid()}"
    register(code=cls["code"], name=twin)
    register(code=cls["code"], name=twin)
    out = _post(t, [["ФИО", "sqrt"], [twin, "1"], ["Кто-то", "1"], [twin.upper(), "много"]])
    fields = {e["field"] for e in out["errors"]}
    assert {"student_ambiguous", "student", "result"} <= fields and out["saved"] == 0
