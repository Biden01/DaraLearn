"""Уведомление о новой заявке. Telegram, если заданы токен и чат; иначе только лог."""
import logging

import httpx

from app.core.config import settings
from app.modules.leads.models import Lead

log = logging.getLogger("leads")

ROLE_LABELS = {
    "school": "Представитель школы",
    "teacher": "Учитель",
    "curator": "Куратор",
    "parent": "Родитель",
    "other": "Другое",
}


def format_lead(lead: Lead) -> str:
    lines = [
        f"Новая заявка #{lead.id} с daralearn.kz",
        f"Имя: {lead.name}",
        f"Email: {lead.email}",
    ]
    if lead.phone:
        lines.append(f"Телефон: {lead.phone}")
    if lead.school:
        lines.append(f"Школа/город: {lead.school}")
    if lead.role:
        lines.append(f"Роль: {ROLE_LABELS.get(lead.role, lead.role)}")
    if lead.message:
        lines.append(f"Комментарий: {lead.message}")
    return "\n".join(lines)


def notify_lead(lead: Lead) -> None:
    text = format_lead(lead)
    log.info("lead created: %s", text.replace("\n", " | "))
    send_telegram(text)


def send_telegram(text: str) -> None:
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        return
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    try:
        r = httpx.post(url, json={"chat_id": settings.telegram_chat_id, "text": text}, timeout=10)
        r.raise_for_status()
    except Exception as exc:  # noqa: BLE001  уведомление не должно ломать приём заявки
        log.warning("telegram notify failed: %s", exc)
