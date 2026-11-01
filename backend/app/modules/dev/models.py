from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class DevTask(Base):
    """Карточка Scrum-доски команды разработки."""
    __tablename__ = "dev_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    column: Mapped[str] = mapped_column(String(20), default="backlog", index=True)
    position: Mapped[float] = mapped_column(Float, default=0)
    assignee: Mapped[str] = mapped_column(String(20), default="")
    points: Mapped[int] = mapped_column(Integer, default=0)
    label: Mapped[str] = mapped_column(String(20), default="")
    sprint: Mapped[int | None] = mapped_column(Integer, nullable=True)  # номер закрытого спринта — карточка в архиве
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
