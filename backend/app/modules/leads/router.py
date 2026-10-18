"""Заявки на пилот с лендинга."""
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.leads.models import Lead

router = APIRouter(prefix="/leads", tags=["leads"])


class LeadIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    school: str = Field(default="", max_length=300)
    role: str = Field(default="", max_length=50)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadIn, db: Session = Depends(get_db)) -> dict:
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    return {"id": lead.id}
