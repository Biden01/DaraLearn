"""Метрики пилота: treatment против control."""
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_role
from app.modules.analytics.service import TARGETS, group_metrics
from app.modules.school.access import class_students, get_class, visible_classes
from app.modules.school.models import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

LOCAL_TZ = timezone(timedelta(hours=5))


class ArmIn(BaseModel):
    arm: Literal["treatment", "control", ""]


@router.put("/classes/{class_id}/arm")
def set_arm(class_id: int, payload: ArmIn, user: User = Depends(require_role("admin")),
            db: Session = Depends(get_db)) -> dict:
    from app.modules.school.models import SchoolClass

    c = db.get(SchoolClass, class_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    c.arm = payload.arm
    db.commit()
    return {"class_id": c.id, "arm": c.arm}


@router.get("/pilot")
def pilot(user: User = Depends(require_role("teacher", "curator")), db: Session = Depends(get_db)) -> dict:
    """Метрики по группам treatment / control и North Star по классам, которые пользователь видит."""
    today = datetime.now(LOCAL_TZ).date()
    arms: dict[str, list[int]] = {"treatment": [], "control": []}
    for c in visible_classes(db, user):
        if c.arm in arms:
            arms[c.arm] += [s.id for s in class_students(db, c.id)]
    out = {arm: group_metrics(db, ids, today) for arm, ids in arms.items()}
    t, c = out["treatment"]["verified_gain"], out["control"]["verified_gain"]
    db.commit()
    return {**out, "north_star": round(t - c, 3) if t is not None and c is not None else None, "targets": TARGETS}
