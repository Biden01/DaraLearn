"""Материалы: Knowledge Graph навыков и связей, база знаний, банк заданий."""
from fastapi import APIRouter

router = APIRouter(prefix="/content", tags=["content"])
