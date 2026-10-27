from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Attempt(Base):
    """Диагностика или проверочный тест: набор заданий и ответы."""
    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # diagnostic | verification
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    task_ids: Mapped[list] = mapped_column(JSON)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)  # {task_id: choice}
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[int] = mapped_column(Integer)
    time_limit: Mapped[int] = mapped_column(Integer)  # секунд
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Check(Base):
    """Отложенная проверка навыка после помощи."""
    __tablename__ = "checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"))
    reason: Mapped[str] = mapped_column(String(20))  # lesson | tutor | teacher
    recommendation_id: Mapped[int | None] = mapped_column(ForeignKey("recommendations.id", ondelete="SET NULL"), nullable=True)
    before_proof: Mapped[float] = mapped_column(Float, default=0)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending | done
    attempt_id: Mapped[int | None] = mapped_column(ForeignKey("attempts.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Outcome(Base):
    """Результат помощи: proof до и после отложенной проверки."""
    __tablename__ = "outcomes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"))
    check_id: Mapped[int] = mapped_column(ForeignKey("checks.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(String(20))
    before: Mapped[float] = mapped_column(Float)
    after: Mapped[float] = mapped_column(Float)
    helped: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdviserCase(Base):
    """Adviser Lite: ученик не выполняет план — случай для куратора."""
    __tablename__ = "adviser_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open | watching | closed
    plan_rate: Mapped[float] = mapped_column(Float, default=0)
    reason: Mapped[str] = mapped_column(Text, default="")
    next_step: Mapped[str] = mapped_column(Text, default="")
    watch_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    curator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
