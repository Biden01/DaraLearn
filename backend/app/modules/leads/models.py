from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str] = mapped_column(String(50), default="")
    school: Mapped[str] = mapped_column(String(300), default="")
    role: Mapped[str] = mapped_column(String(50), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(100), default="landing")
    ip: Mapped[str] = mapped_column(String(64), default="")
    user_agent: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
