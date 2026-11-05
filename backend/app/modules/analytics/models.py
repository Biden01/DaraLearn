"""Метрики пилота, которые вводят люди: время учителя на проверку и разбор ошибок, опрос удобства."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TeacherTimeLog(Base):
    """Сколько минут учитель потратил за день. До старта пилота — baseline, после — «после»."""
    __tablename__ = "teacher_time_logs"
    __table_args__ = (UniqueConstraint("teacher_id", "day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    checking_min: Mapped[int] = mapped_column(Integer, default=0)  # проверка работ
    errors_min: Mapped[int] = mapped_column(Integer, default=0)    # разбор ошибок с учениками
    note: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SurveyResponse(Base):
    """Короткий опрос удобства: раз в неделю, три оценки 1–5 и комментарий."""
    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("user_id", "week"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # student | teacher — на момент ответа
    week: Mapped[date] = mapped_column(Date, index=True)  # понедельник недели
    ease: Mapped[int] = mapped_column(SmallInteger)      # удобно пользоваться
    useful: Mapped[int] = mapped_column(SmallInteger)    # ученик: помогает понять тему; учитель: экономит время
    recommend: Mapped[int] = mapped_column(SmallInteger)  # продолжил бы пользоваться
    comment: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
