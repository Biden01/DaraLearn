from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ClassTopic(Base):
    """Текущая тема класса: действует с starts_on до следующей записи. Учитель может заменить тему дня."""
    __tablename__ = "class_topics"
    __table_args__ = (UniqueConstraint("class_id", "starts_on"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    starts_on: Mapped[date] = mapped_column(Date)
    set_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MonthlyGoal(Base):
    """Цель месяца к ПҚС: темы, которые ученик не освоил. Собирается один раз в начале месяца."""
    __tablename__ = "monthly_goals"
    __table_args__ = (UniqueConstraint("user_id", "month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    month: Mapped[date] = mapped_column(Date)  # первое число месяца
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)  # с какого дня расписание (собрана в середине месяца)
    rules_version: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GoalTopic(Base):
    """Тема цели и неделя (1–4), на которую она поставлена. Недели видят только учитель и куратор."""
    __tablename__ = "goal_topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("monthly_goals.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"))
    week: Mapped[int] = mapped_column(Integer)
    order: Mapped[int] = mapped_column(Integer, default=0)
    start_status: Mapped[str] = mapped_column(String(10))  # состояние навыка, когда цель собиралась
    start_proof: Mapped[float] = mapped_column(Float, default=0.0)


class DailyPlan(Base):
    __tablename__ = "daily_plans"
    __table_args__ = (UniqueConstraint("user_id", "day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    rules_version: Mapped[str] = mapped_column(String(20))
    total_minutes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlanItem(Base):
    __tablename__ = "plan_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("daily_plans.id", ondelete="CASCADE"), index=True)
    block: Mapped[str] = mapped_column(String(10))    # tutor | practice | check
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"))  # главный навык блока
    reason: Mapped[str] = mapped_column(String(20), default="current")  # current | prereq | weak | carried | delayed
    minutes: Mapped[int] = mapped_column(Integer)
    task_ids: Mapped[list] = mapped_column(JSON, default=list)
    order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending | done
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
