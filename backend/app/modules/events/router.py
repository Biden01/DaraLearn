"""Learning Events: импорт Excel/CSV, проверка ответов, привязка к навыкам, сохранение событий."""
from fastapi import APIRouter

router = APIRouter(prefix="/events", tags=["events"])
