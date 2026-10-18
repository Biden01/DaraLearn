"""Root Cause Investigation и Decision Engine: гипотезы причин ошибки и правила выбора следующего действия."""
from fastapi import APIRouter

router = APIRouter(prefix="/decisions", tags=["decisions"])
