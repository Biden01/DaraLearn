"""Заявки на пилот с лендинга."""
import time
from collections import defaultdict, deque
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.modules.leads.models import Lead
from app.modules.leads.notify import notify_lead

router = APIRouter(prefix="/leads", tags=["leads"])

RATE_LIMIT = 5          # заявок
RATE_WINDOW = 600       # секунд
_recent: dict[str, deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "")[:64]


def check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    q = _recent[ip]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много заявок, попробуйте позже")
    q.append(now)


class LeadIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(default="", max_length=50)
    school: str = Field(default="", max_length=300)
    role: str = Field(default="", max_length=50)
    message: str = Field(default="", max_length=2000)
    website: str = Field(default="", max_length=200)  # honeypot: люди его не видят


class LeadOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    school: str
    role: str
    message: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadIn, request: Request, background: BackgroundTasks,
                db: Session = Depends(get_db)) -> dict:
    if payload.website.strip():
        return {"id": 0}  # бот заполнил скрытое поле: делаем вид, что приняли
    ip = client_ip(request)
    check_rate_limit(ip)
    data = payload.model_dump(exclude={"website"})
    lead = Lead(**data, ip=ip, user_agent=request.headers.get("user-agent", "")[:300])
    db.add(lead)
    db.commit()
    background.add_task(notify_lead, lead)
    return {"id": lead.id}


@router.get("", response_model=list[LeadOut])
def list_leads(limit: int = 100, x_admin_token: str = Header(default=""),
               db: Session = Depends(get_db)) -> list[Lead]:
    if not settings.admin_token:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if x_admin_token != settings.admin_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный токен")
    limit = max(1, min(limit, 500))
    stmt = select(Lead).order_by(Lead.id.desc()).limit(limit)
    return list(db.scalars(stmt))
