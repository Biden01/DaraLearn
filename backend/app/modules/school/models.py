from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class School(Base):
    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    city: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True, nullable=True)
    login: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)  # для учеников без email
    password_hash: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    grade: Mapped[int] = mapped_column(Integer, default=8)
    lang: Mapped[str] = mapped_column(String(2), default="kk")  # kk | ru
    role: Mapped[str] = mapped_column(String(20), default="student")  # student | teacher | curator | admin | parent
    school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id", ondelete="SET NULL"), nullable=True, index=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    weekly_goal: Mapped[int] = mapped_column(Integer, default=30)  # заданий в неделю
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    day: Mapped[date] = mapped_column(Date, index=True)
    time: Mapped[str] = mapped_column(String(5), default="")
    kind: Mapped[str] = mapped_column(String(20), default="lesson")  # lesson | homework | test | other
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


SUPPORT_TOPICS = ("account", "bug", "lessons", "tutor", "idea", "other")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(String(20), default="other", server_default="other", index=True)  # см. SUPPORT_TOPICS
    status: Mapped[str] = mapped_column(String(10), default="new", server_default="new", index=True)  # new | done
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SchoolClass(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(50))          # «8А»
    grade: Mapped[int] = mapped_column(Integer, default=8)
    subject: Mapped[str] = mapped_column(String(50), default="math")
    arm: Mapped[str] = mapped_column(String(10), default="", server_default="")  # treatment | control (пилот)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClassMember(Base):
    __tablename__ = "class_members"
    __table_args__ = (UniqueConstraint("class_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Invite(Base):
    """Код приглашения: в школу (учитель/куратор) или в класс (ученик)."""
    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(20))  # student | teacher | curator
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"))
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)
    max_uses: Mapped[int] = mapped_column(Integer, default=200)
    uses: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ParentLink(Base):
    """Родитель ↔ ребёнок. Ученик создаёт код (parent_id пуст), родитель вводит его — связь готова.
    Родитель видит ребёнка только на чтение; отключить связь может любая сторона."""
    __tablename__ = "parent_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    code: Mapped[str | None] = mapped_column(String(12), unique=True, nullable=True)  # стирается после привязки
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    linked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
