"""«Показать решение» (PLAN.md §9 #6): фото страницы тетради к проверочному заданию.
AI проверяет ход решения; сомнительное или неверное — учителю, против списывания.
Выключено до settings.bookwork_check_enabled — модуль готов, но не влияет на пилот."""
import base64
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.content.models import Task
from app.modules.tutor import gateway
from app.modules.verification.models import BookworkCheck

ALLOWED_MIME = {"image/jpeg": "jpg", "image/png": "png"}

SYSTEM = (
    "Ты проверяешь фото страницы тетради ученика с решением математической задачи. "
    "Смотри на ход решения (шаги), а не только на финальный ответ. "
    "Ответь строго одной из трёх меток на первой строке: OK, QUESTIONABLE или WRONG, "
    "затем через перевод строки — одно короткое предложение-причину на русском. "
    "OK — шаги решения видны и ведут к ответу. QUESTIONABLE — решение нечитаемо, слишком короткое "
    "для задания или не совпадает с заявленным ответом. WRONG — шаги явно неверны или решения нет вовсе."
)


def storage_dir() -> Path:
    p = Path(settings.bookwork_storage_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_photo(db: Session, user_id: int, attempt_id: int, task: Task, content: bytes, ext: str) -> BookworkCheck:
    """Сохранить фото и создать запись; AI-проверку запускает review()."""
    name = f"{attempt_id}_{task.id}_{uuid.uuid4().hex[:12]}.{ext}"
    (storage_dir() / name).write_bytes(content)
    check = BookworkCheck(user_id=user_id, attempt_id=attempt_id, task_id=task.id, image_path=name)
    db.add(check)
    db.flush()
    return check


def review(db: Session, check: BookworkCheck, image_bytes: bytes, mime: str) -> BookworkCheck:
    """AI проверяет шаги решения. Без ключа или при ошибке — сомнительное, на проверку учителю."""
    if gateway.enabled():
        b64 = base64.b64encode(image_bytes).decode()
        try:
            text, *_ = gateway.complete_vision(SYSTEM, "Проверь решение на фото.", b64, mime)
        except gateway.TutorUnavailable:
            text = ""
        first, _, rest = text.partition("\n")
        verdict = first.strip().upper()
        if verdict in ("OK", "QUESTIONABLE", "WRONG"):
            check.ai_verdict = verdict.lower()
            check.ai_reason = rest.strip()
        else:
            check.ai_verdict, check.ai_reason = "questionable", "не удалось разобрать ответ AI"
    else:
        check.ai_verdict, check.ai_reason = "", "AI недоступен — проверка вручную"
    check.status = "ok" if check.ai_verdict == "ok" else "flagged"
    db.flush()
    return check


def decide(db: Session, check: BookworkCheck, teacher_id: int, approve: bool, note: str) -> BookworkCheck:
    check.status = "approved" if approve else "rejected"
    check.teacher_id = teacher_id
    check.teacher_note = note
    check.reviewed_at = datetime.now(timezone.utc)
    db.flush()
    return check


def queue_for(db: Session, student_ids: set[int]) -> list[BookworkCheck]:
    if not student_ids:
        return []
    return list(db.scalars(select(BookworkCheck).where(
        BookworkCheck.status == "flagged", BookworkCheck.user_id.in_(student_ids),
    ).order_by(BookworkCheck.created_at)))
