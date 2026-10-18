"""Proof Engine и Student State: уверенность оценки, динамика, последняя проверка; практика и независимая проверка учитываются отдельно."""
from fastapi import APIRouter

router = APIRouter(prefix="/state", tags=["state"])
