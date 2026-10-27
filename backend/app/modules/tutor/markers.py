"""Служебные пометки в ответе LLM: уверенность и ошибка ученика. Ученику они не показываются."""
import re

LOW = re.compile(r"\[\[LOW_CONFIDENCE\]\]")
MISCONCEPTION = re.compile(r"\[\[MISCONCEPTION:\s*(.+?)\]\]", re.S)


def parse(reply: str) -> tuple[str, bool, str]:
    """(текст без пометок, низкая ли уверенность, описание ошибки)."""
    low = bool(LOW.search(reply))
    m = MISCONCEPTION.search(reply)
    text = MISCONCEPTION.sub("", LOW.sub("", reply)).strip()
    return text, low, (m.group(1).strip()[:300] if m else "")
