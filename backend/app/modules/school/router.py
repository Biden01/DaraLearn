"""Школа: пользователи, классы, роли (ученик, учитель, куратор, администратор)."""
from fastapi import APIRouter

router = APIRouter(prefix="/school", tags=["school"])
