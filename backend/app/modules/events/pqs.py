"""Разбор таблиц ПҚС / БС из Excel и CSV. Формат заранее неизвестен, поэтому поддерживаются два вида.

Длинный: по строке на ответ — ученик, навык или задание, результат, дата (необязательно).
Широкий: по строке на ученика — ученик, затем колонка на каждый навык или задание (заголовок — slug или название).
Результат в ячейке: 1/0, да/нет, процент (75%, 0,75), доля (3/4). Доля или процент не ниже порога — «верно».
"""
import re
from collections.abc import Callable
from dataclasses import dataclass

TRUE = {"1", "+", "да", "иә", "yes", "true", "верно", "дұрыс", "y"}
FALSE = {"0", "-", "нет", "жоқ", "no", "false", "неверно", "қате", "n"}
THRESHOLD = 0.6  # доля верных ответов по навыку, с которой навык засчитан

STUDENT_HEADERS = ("фио", "аты", "name", "ученик", "оқушы", "логин", "login", "email", "e-mail", "student")
DATE_HEADERS = ("дата", "date", "күні")
BAD = object()


@dataclass
class Record:
    row: int
    who: str
    what: str      # slug навыка или задания, как в таблице (или название)
    correct: bool
    date: str


def parse_result(cell: str, threshold: float = THRESHOLD):
    """True / False; None — пусто (пропуск); BAD — не понято."""
    c = cell.strip().lower().replace(",", ".")
    if not c:
        return None
    if c in TRUE:
        return True
    if c in FALSE:
        return False
    try:
        if c.endswith("%"):
            ratio = float(c[:-1]) / 100
        elif "/" in c:
            a, b = c.split("/", 1)
            ratio = float(a) / float(b)
        else:
            v = float(c)
            ratio = v if v <= 1 else v / 100 if v <= 100 else BAD
    except (ValueError, ZeroDivisionError):
        return BAD
    return BAD if ratio is BAD or ratio < 0 or ratio > 1 else ratio >= threshold


def _is_header_cell(cell: str, words: tuple[str, ...]) -> bool:
    c = cell.strip().lower()
    return any(c == w or c.startswith(w) for w in words)


def detect_format(rows: list[list[str]], resolve: Callable[[str], str | None]) -> str:
    """wide — если в заголовке есть колонки, которые распознаются как навыки или задания."""
    if not rows:
        return "long"
    cells = [h for h in rows[0][1:] if h.strip()]
    if any(parse_result(h) not in (None, BAD) for h in cells):
        return "long"  # в первой строке уже есть результаты (1/0, %, доли): это данные, а не заголовок
    known = sum(1 for h in cells if resolve(h))
    return "wide" if known >= 1 and known >= len(cells) / 2 else "long"


def parse(rows: list[list[str]], resolve: Callable[[str], str | None], threshold: float = THRESHOLD,
          default_date: str = "") -> tuple[str, list[Record], list[dict]]:
    """(формат, записи, ошибки). resolve(текст) → slug или None."""
    fmt = detect_format(rows, resolve)
    errors: list[dict] = []
    out: list[Record] = []
    if fmt == "wide":
        header = rows[0]
        date_col = next((j for j, h in enumerate(header) if _is_header_cell(h, DATE_HEADERS)), None)
        cols = {}
        for j, h in enumerate(header):
            if j == 0 or j == date_col or not h.strip():
                continue
            slug = resolve(h)
            if slug:
                cols[j] = slug
            else:
                errors.append({"row": 1, "field": "column", "values": [h]})  # «Итого», «Балл» и т. п. — пропускаем
        for i, r in enumerate(rows[1:], start=2):
            r = r + [""] * (len(header) - len(r))
            if not r[0].strip():
                continue
            when = r[date_col].strip() if date_col is not None else default_date
            for j, slug in cols.items():
                res = parse_result(r[j], threshold)
                if res is None:
                    continue
                if res is BAD:
                    errors.append({"row": i, "field": "result", "values": [r[0], header[j], r[j]]})
                    continue
                out.append(Record(i, r[0].strip(), slug, res, when or default_date))
        return fmt, out, errors

    start = 1 if rows and _is_header_cell(rows[0][0], STUDENT_HEADERS) else 0
    for i, r in enumerate(rows[start:], start=start + 1):
        r = (r + ["", "", "", ""])[:4]
        res = parse_result(r[2], threshold)
        if res is None or res is BAD:
            errors.append({"row": i, "field": "result", "values": r})
            continue
        out.append(Record(i, r[0].strip(), r[1].strip(), res, r[3].strip() or default_date))
    return fmt, out, errors
