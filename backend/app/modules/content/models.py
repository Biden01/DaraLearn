from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

# Тексты хранятся парами {"kk": ..., "ru": ...}.


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    title: Mapped[dict] = mapped_column(JSON)
    sym: Mapped[str] = mapped_column(String(10))
    color: Mapped[str] = mapped_column(String(20), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=False)  # есть ли материалы
    order: Mapped[int] = mapped_column(Integer, default=0)


class Course(Base):
    """Тема из нескольких уроков (например, «Квадратные уравнения»)."""
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    title: Mapped[dict] = mapped_column(JSON)
    description: Mapped[dict] = mapped_column(JSON)
    sym: Mapped[str] = mapped_column(String(10))
    level: Mapped[str] = mapped_column(String(10), default="medium")  # easy | medium | hard
    grade: Mapped[int] = mapped_column(Integer, default=8)
    order: Mapped[int] = mapped_column(Integer, default=0)


class Lesson(Base):
    """Урок = навык из Knowledge Graph: теория, примеры, задания."""
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    title: Mapped[dict] = mapped_column(JSON)
    minutes: Mapped[int] = mapped_column(Integer, default=15)
    theory: Mapped[dict] = mapped_column(JSON)    # {"kk": [строки], "ru": [строки]}
    examples: Mapped[list] = mapped_column(JSON)  # [{"q": str, "steps": [str], "note": {kk, ru}}]
    prereqs: Mapped[list] = mapped_column(JSON, default=list)  # slug'и базовых уроков
    order: Mapped[int] = mapped_column(Integer, default=0)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))  # diagnostic | practice | verification
    question: Mapped[dict] = mapped_column(JSON)
    options: Mapped[list] = mapped_column(JSON)       # строка или {kk, ru}
    answer: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[dict] = mapped_column(JSON)
