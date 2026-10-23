"""Learning Events: проверка ответов, привязка к навыкам, сохранение событий."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import current_user
from app.modules.content.models import Task
from app.modules.events.models import LearningEvent
from app.modules.school.models import User

router = APIRouter(prefix="/events", tags=["events"])


class PracticeIn(BaseModel):
    task_id: int
    choice: int = Field(ge=0, le=9)


@router.post("/practice")
def practice(payload: PracticeIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Практика внутри урока: ответ сразу проверяется и не влияет на «освоено»."""
    task = db.get(Task, payload.task_id)
    if not task or task.purpose != "practice":
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    correct = payload.choice == task.answer
    db.add(LearningEvent(user_id=user.id, lesson_id=task.lesson_id, task_id=task.id, source="practice",
                         correct=correct, choice=payload.choice))
    db.commit()
    return {"correct": correct, "answer": task.answer, "explanation": task.explanation}
