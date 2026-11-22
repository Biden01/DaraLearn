from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class XpAward(Base):
    """Одно начисление опыта. key уникален для ученика — одно и то же действие не засчитывается дважды
    (например, «task:12:2026-11-22» — задание 12, решённое верно в этот день)."""
    __tablename__ = "xp_awards"
    __table_args__ = (UniqueConstraint("user_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(20))  # task | plan_step | plan_day | attendance | mastered
    xp: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
