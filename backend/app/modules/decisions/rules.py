"""Правила Decision Engine. Пороги фиксируются до пилота и меняются только новой версией (docs: пилот 24.10–16.11)."""
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Rules:
    version: str = "decision-v1"
    tutor_limit: float = 0.6        # независимый proof ниже — занятие с AI Tutor
    practice_ok: float = 0.7        # практика получается, а самостоятельно — нет: проблема стратегии
    group_share: float = 0.3        # доля класса с пробелом → групповое объяснение
    group_min: int = 2
    # None — эскалации по числу попыток нет (Tutor): учитель подключается по low confidence или кнопке.
    teacher_after_failed_sessions: int | None = None
    plan_completion_min: float = 0.3  # ниже — очередь куратора (см. plan.rules)
    mastery_needs_verified: bool = True   # «освоено» только при независимо подтверждённом результате


RULES = Rules()


def as_dict() -> dict:
    return asdict(RULES)
