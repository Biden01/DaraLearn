from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TutorSession(Base):
    __tablename__ = "tutor_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    recommendation_id: Mapped[int | None] = mapped_column(ForeignKey("recommendations.id", ondelete="SET NULL"), nullable=True)
    goal: Mapped[str] = mapped_column(String(300), default="", server_default="")
    stage: Mapped[int] = mapped_column(Integer, default=1, server_default="1")  # 1–9
    result: Mapped[str | None] = mapped_column(String(20), nullable=True)      # passed | failed
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TutorMessage(Base):
    __tablename__ = "tutor_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("tutor_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(50), default="")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
