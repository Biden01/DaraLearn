"""Proof Engine: состояние ученика по каждому уроку (навыку).

Независимые ответы (диагностика, проверка) и практика с мгновенной проверкой считаются отдельно:
«освоено» ставится только по независимым ответам.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.events.models import LearningEvent

WINDOW = 6           # последних независимых ответов в оценке
MASTERED = 0.8
LEARNING = 0.5
CONFIDENT_N = 3      # меньше — «мало данных»


@dataclass
class SkillState:
    indep: float = 0.0
    practice: float = 0.0
    n_indep: int = 0
    n_practice: int = 0
    last_check: datetime | None = None
    history: list[bool] = field(default_factory=list)  # независимые ответы, старые → новые

    @property
    def status(self) -> str:
        if not self.n_indep:
            return "unknown"
        if self.indep >= MASTERED:
            # один верный ответ (например, в диагностике) — только предварительная оценка
            return "mastered" if self.n_indep >= 2 else "likely"
        return "learning" if self.indep >= LEARNING else "gap"

    @property
    def confident(self) -> bool:
        return self.n_indep >= CONFIDENT_N

    def as_dict(self) -> dict:
        return {"status": self.status, "proof": round(self.indep, 2), "practice": round(self.practice, 2),
                "n_indep": self.n_indep, "n_practice": self.n_practice, "confident": self.confident,
                "last_check": self.last_check.isoformat() if self.last_check else None}


def compute_states(db: Session, user_id: int) -> dict[int, SkillState]:
    rows = db.execute(
        select(LearningEvent.lesson_id, LearningEvent.source, LearningEvent.correct, LearningEvent.created_at)
        .where(LearningEvent.user_id == user_id).order_by(LearningEvent.id)
    ).all()
    indep: dict[int, list[tuple[bool, datetime]]] = defaultdict(list)
    practice: dict[int, list[bool]] = defaultdict(list)
    for lesson_id, source, correct, at in rows:
        if source == "practice":
            practice[lesson_id].append(correct)
        else:
            indep[lesson_id].append((correct, at))

    states: dict[int, SkillState] = defaultdict(SkillState)
    for lesson_id, items in indep.items():
        recent = items[-WINDOW:]
        s = states[lesson_id]
        s.n_indep = len(items)
        s.indep = sum(c for c, _ in recent) / len(recent)
        s.last_check = items[-1][1]
        s.history = [c for c, _ in items]
    for lesson_id, items in practice.items():
        recent = items[-WINDOW:]
        s = states[lesson_id]
        s.n_practice = len(items)
        s.practice = sum(recent) / len(recent)
    return states
