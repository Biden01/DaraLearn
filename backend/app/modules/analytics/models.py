"""Метрики пилота, которые вводят люди: замер времени учителя и опрос удобства (docs/PLAN.md, раздел 7)."""
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TeacherTimeLog(Base):
    """Сколько минут за неделю учитель потратил на проверку работ и разбор ошибок.

    phase: before — неделя работы без DaraLearn (стартовый замер), after — неделя с DaraLearn."""
    __tablename__ = "teacher_time_logs"
    __table_args__ = (UniqueConstraint("user_id", "week"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    week: Mapped[date] = mapped_column(Date)  # понедельник недели
    phase: Mapped[str] = mapped_column(String(10))  # before | after
    check_minutes: Mapped[int] = mapped_column(Integer)
    review_minutes: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SurveyResponse(Base):
    """Ответ на короткий опрос удобства: оценки 1–5 по вопросам роли и комментарий. Один ответ на волну опроса."""
    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("user_id", "survey"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    survey: Mapped[str] = mapped_column(String(20), index=True)  # волна опроса, см. service.SURVEY
    role: Mapped[str] = mapped_column(String(20))  # student | teacher — роль на момент ответа
    answers: Mapped[dict] = mapped_column(JSON, default=dict)  # {ключ вопроса: 1..5}
    comment: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
