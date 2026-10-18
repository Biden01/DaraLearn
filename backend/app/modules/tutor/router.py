"""AI Tutor и AI Gateway: занятие из 9 этапов, обращения к LLM API."""
from fastapi import APIRouter

router = APIRouter(prefix="/tutor", tags=["tutor"])
