"""ИИ-черновики заданий по навыку. В банк не пишет: черновик принимает (и правит) человек в редакторе урока."""
import json
import logging
import random
import re

from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from app.modules.content.models import Lesson, Task
from app.modules.tutor import gateway

log = logging.getLogger(__name__)

PURPOSE_HINT = {
    "diagnostic": "диагностика: быстро показывает, понимает ли ученик основу навыка; ошибочный вариант выдаёт типичную причину",
    "practice": "закрепление: тренировка навыка, разбор объясняет шаги решения",
    "verification": "независимая проверка: новая ситуация (другие числа и формулировка), без подсказок, та же сложность",
}

SYSTEM = """Ты методист школьной математики в Казахстане (8–11 класс). Составляешь задания с выбором ответа
для навыка, строго по его теории — не выходи за её рамки и не используй правила, которых в теории нет.

Требования к каждому заданию:
- Тексты на двух языках: казахский (kk) — грамотный литературный казахский, без русизмов; русский (ru).
- Ровно 4 варианта ответа, ровно один верный. Каждый неверный вариант — результат конкретной типичной ошибки
  (неверно применённое правило, ошибка в знаке, непонимание условия), а не случайное число.
- Варианты, состоящие только из чисел и формул, давай строкой (одинаковой для обоих языков),
  иначе — объектом {"kk": ..., "ru": ...}.
- answer — индекс верного варианта (0–3).
- errors — тип ошибки за каждым вариантом, в том же порядке: "" у верного; у неверных одно из
  "base" (не владеет базовой темой-пререквизитом), "condition" (неверно понял условие),
  "strategy" (выбрал неверный способ решения), "calc" (ошибка в вычислениях или знаке).
- explanation — короткий разбор решения по шагам на обоих языках; для неверных вариантов можно назвать ошибку.
- Не повторяй существующие задания навыка. Перепроверь вычисления: верный ответ обязан быть верным.

Ответь только JSON без пояснений и без ```:
{"tasks": [{"question": {"kk": "...", "ru": "..."}, "options": ["...", {"kk": "...", "ru": "..."}, "...", "..."],
"answer": 0, "errors": ["", "calc", "condition", "base"], "explanation": {"kk": "...", "ru": "..."}}]}"""


class _Text2(BaseModel):
    kk: str = Field(min_length=1, max_length=4000)
    ru: str = Field(min_length=1, max_length=4000)


class _Draft(BaseModel):
    question: _Text2
    options: list[str | _Text2] = Field(min_length=4, max_length=4)
    answer: int = Field(ge=0, le=3)
    errors: list[Literal["", "base", "condition", "strategy", "calc"]] = []
    explanation: _Text2


class GenerationFailed(Exception):
    pass


def _context(lesson: Lesson, existing: list[Task], purpose: str, count: int) -> str:
    theory_kk = "\n".join(lesson.theory.get("kk", [])) or "—"
    theory_ru = "\n".join(lesson.theory.get("ru", [])) or "—"
    examples = "\n".join(f"- {e.get('q', '')}: " + " → ".join(e.get("steps", [])) for e in lesson.examples or []) or "—"
    have = "\n".join(f"- {t.question.get('ru') or t.question.get('kk')}" for t in existing[-30:]) or "—"
    return (f"Навык: «{lesson.title.get('ru', '')}» / «{lesson.title.get('kk', '')}» (slug {lesson.slug}).\n\n"
            f"Теория (ru):\n{theory_ru}\n\nТеория (kk):\n{theory_kk}\n\nРазобранные примеры:\n{examples}\n\n"
            f"Уже есть задания (не повторять):\n{have}\n\n"
            f"Составь {count} задани(е/я) с целью «{purpose}» — {PURPOSE_HINT[purpose]}.")


def _parse(text: str) -> list[dict]:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise GenerationFailed("no_json")
    try:
        items = json.loads(text[start:end + 1]).get("tasks", [])
    except (json.JSONDecodeError, AttributeError) as e:
        raise GenerationFailed("bad_json") from e
    return items if isinstance(items, list) else []


def _shuffle(d: _Draft) -> dict:
    """Модели любят ставить верный ответ первым — перемешиваем варианты, сохраняя верный."""
    opts = [o.model_dump() if isinstance(o, _Text2) else o for o in d.options]
    # разметка ошибок: неполная или с ошибкой у верного варианта — отбрасываем разметку, задание оставляем
    errs = list(d.errors) if len(d.errors) == len(opts) and not d.errors[d.answer] else [""] * len(opts)
    order = list(range(len(opts)))
    random.shuffle(order)
    return {"question": d.question.model_dump(), "options": [opts[i] for i in order],
            "answer": order.index(d.answer), "option_errors": [errs[i] for i in order],
            "explanation": d.explanation.model_dump()}


def generate(lesson: Lesson, existing: list[Task], purpose: str, count: int) -> tuple[list[dict], int, int]:
    """Черновики заданий (только валидные) и токены (in, out). Бросает GenerationFailed / gateway.TutorUnavailable."""
    if not lesson.theory.get("ru") and not lesson.theory.get("kk"):
        raise GenerationFailed("no_theory")  # без теории модель будет выдумывать — не генерируем
    text, tin, tout = gateway.complete(SYSTEM, [{"role": "user", "content": _context(lesson, existing, purpose, count)}])
    drafts, bad = [], 0
    for item in _parse(text)[:count]:
        try:
            d = _Draft.model_validate(item)
        except ValidationError:
            bad += 1
            continue
        if len({json.dumps(o, ensure_ascii=False, sort_keys=True) for o in item["options"]}) < 4:
            bad += 1  # одинаковые варианты
            continue
        drafts.append({"purpose": purpose, **_shuffle(d)})
    if bad:
        log.warning("generate %s: %s invalid drafts skipped", lesson.slug, bad)
    if not drafts:
        raise GenerationFailed("no_valid_drafts")
    return drafts, tin, tout
