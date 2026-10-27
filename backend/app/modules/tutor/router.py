"""AI Tutor и AI Gateway: занятие по шагам, обращения к LLM API."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import current_user
from app.modules.content.models import Lesson, Task
from app.modules.content.service import task_public
from app.modules.decisions.models import Recommendation
from app.modules.decisions.service import sync_student
from app.modules.events.models import LearningEvent
from app.modules.verification.service import schedule_check
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states
from app.modules.tutor import gateway
from app.modules.tutor.models import TutorMessage, TutorSession

router = APIRouter(prefix="/tutor", tags=["tutor"])

HISTORY = 20
LOCAL_TZ = timezone(timedelta(hours=5))

RULES = {
    "kk": "Оқушымен тек қазақ тілінде сөйлес.",
    "ru": "Общайся с учеником только на русском языке.",
}

SYSTEM = """Ты — Dara, AI-тьютор платформы DaraLearn для школьников Казахстана ({grade} класс). {lang_rule}

Как ты помогаешь:
- Веди ученика к ответу сам: задай наводящий вопрос, дай подсказку, разбери похожий пример. Готовый ответ к задаче ученика давай, только если он уже попробовал решить и застрял после подсказок.
- Один шаг за сообщение. Коротко: обычно 2–6 предложений.
- Формулы пиши обычным текстом с символами: x², √, ±, ·, ≠, ⇒. Без LaTeX и без markdown-таблиц. Можно **жирный** для ключевого слова.
- Если ученик ошибся, скажи, где именно, и спроси, как исправить.
- Если вопрос не по учёбе, мягко верни разговор к теме.
- Хвали за конкретное действие, без лишних эмоций.

Этап занятия: {stage}

Контекст урока: «{lesson}».
Теория урока:
{theory}

Состояние ученика по теме: {state}.
Последние ошибки ученика по теме:
{mistakes}"""

STUB = {
    "kk": "AI Tutor әзірге қосылмаған — жақын арада іске қосылады. Әзірше сабақтың теориясы мен мысалдарын қарап шық:\n\n{hint}",
    "ru": "AI Tutor пока не подключён — скоро заработает. А пока посмотри теорию и примеры урока:\n\n{hint}",
}
REFUSAL = {
    "kk": "Бұл сұраққа жауап бере алмаймын. Сабақ тақырыбы бойынша сұрап көр.",
    "ru": "На этот вопрос я ответить не могу. Спроси что-нибудь по теме урока.",
}


STAGES = {
    1: "1 из 9 — цель. Уточни, что именно ученик хочет понять, и коротко назови цель занятия.",
    2: "2 из 9 — диагностика. Задай 1–2 коротких вопроса, чтобы понять, что ученик уже знает по теме.",
    3: "3 из 9 — первая попытка. Предложи ученику самому начать решение похожей задачи.",
    4: "4 из 9 — подсказки. Давай по одной подсказке за раз, не решая за ученика.",
    5: "5 из 9 — объяснение. Коротко объясни правило с формулой и спроси, всё ли понятно.",
    6: "6 из 9 — разобранный пример. Разбери похожий пример по шагам и предложи перейти к проверке без помощи.",
}
CHECK_TASKS = 3   # этапы 7–9: самостоятельная задача, новая ситуация, мини-проверка
PASS = 2


class SessionIn(BaseModel):
    lesson: str | None = None
    recommendation_id: int | None = None


class StageIn(BaseModel):
    stage: int = Field(ge=1, le=6)


class CheckIn(BaseModel):
    answers: dict[str, int]


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def _used_today(db: Session, user_id: int) -> int:
    start = datetime.now(LOCAL_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    return db.scalar(select(func.count()).select_from(TutorMessage).join(TutorSession)
                     .where(TutorSession.user_id == user_id, TutorMessage.role == "user",
                            TutorMessage.created_at >= start)) or 0


def _session_out(db: Session, s: TutorSession) -> dict:
    lesson = db.get(Lesson, s.lesson_id) if s.lesson_id else None
    msgs = db.scalars(select(TutorMessage).where(TutorMessage.session_id == s.id).order_by(TutorMessage.id))
    return {"id": s.id, "lesson": {"slug": lesson.slug, "title": lesson.title} if lesson else None,
            "stage": s.stage, "goal": s.goal, "result": s.result, "finished": s.finished_at is not None,
            "messages": [{"id": m.id, "role": m.role, "content": m.content, "at": m.created_at.isoformat()} for m in msgs]}


@router.get("/status")
def tutor_status(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return {"enabled": gateway.enabled(), "limit": settings.tutor_daily_limit,
            "remaining": max(0, settings.tutor_daily_limit - _used_today(db, user.id))}


@router.get("/sessions/current")
def current_session(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict | None:
    s = db.scalar(select(TutorSession).where(TutorSession.user_id == user.id).order_by(TutorSession.id.desc()))
    return _session_out(db, s) if s else None


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def new_session(payload: SessionIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    lesson = db.scalar(select(Lesson).where(Lesson.slug == payload.lesson)) if payload.lesson else None
    rec = db.get(Recommendation, payload.recommendation_id) if payload.recommendation_id else None
    if rec and rec.user_id != user.id:
        rec = None
    if rec and not lesson:
        lesson = db.get(Lesson, rec.lesson_id)
    s = TutorSession(user_id=user.id, lesson_id=lesson.id if lesson else None, recommendation_id=rec.id if rec else None,
                     goal=f"{rec.action}:{rec.cause}" if rec else "")
    db.add(s)
    db.commit()
    return _session_out(db, s)


def _system_prompt(db: Session, user: User, lesson: Lesson | None, stage: int = 1) -> str:
    lang = user.lang if user.lang in RULES else "kk"
    stage_text = STAGES.get(stage, STAGES[6])
    if not lesson:
        return SYSTEM.format(grade=user.grade, lang_rule=RULES[lang], lesson="свободная тема (математика)",
                             theory="—", state="нет данных", mistakes="—", stage=stage_text)
    s = compute_states(db, user.id).get(lesson.id, SkillState())
    state = (f"самостоятельно верно {round(s.indep * 100)}% (ответов: {s.n_indep}), "
             f"в практике {round(s.practice * 100)}% (ответов: {s.n_practice})") if s.n_indep or s.n_practice else "нет данных"
    wrong = db.execute(select(Task.question, Task.options, LearningEvent.choice, Task.answer)
                       .join(Task, LearningEvent.task_id == Task.id)
                       .where(LearningEvent.user_id == user.id, LearningEvent.lesson_id == lesson.id,
                              LearningEvent.correct.is_(False))
                       .order_by(LearningEvent.id.desc()).limit(3)).all()

    def txt(v):
        return v if isinstance(v, str) else v.get(lang, "")

    mistakes = "\n".join(f"- «{txt(q)}»: ответил «{txt(o[c])}», верно «{txt(o[a])}»" for q, o, c, a in wrong) or "—"
    return SYSTEM.format(grade=user.grade, lang_rule=RULES[lang], lesson=txt(lesson.title),
                         theory="\n".join(lesson.theory.get(lang, [])), state=state, mistakes=mistakes, stage=stage_text)


@router.post("/sessions/{session_id}/messages")
def send(session_id: int, payload: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = db.get(TutorSession, session_id)
    if not s or s.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if s.stage >= 7 or s.finished_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "check_stage")  # во время проверки AI молчит
    if _used_today(db, user.id) >= settings.tutor_daily_limit:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "daily_limit")
    lang = user.lang if user.lang in RULES else "kk"
    lesson = db.get(Lesson, s.lesson_id) if s.lesson_id else None

    user_msg = TutorMessage(session_id=s.id, role="user", content=payload.text.strip())
    db.add(user_msg)
    db.flush()

    if not gateway.enabled():
        hint = "\n".join(l.removeprefix("$ ").removeprefix("! ") for l in (lesson.theory.get(lang, [])[:3] if lesson else []))
        reply, tin, tout, model = STUB[lang].format(hint=hint or "—").strip(), 0, 0, "stub"
    else:
        history = list(db.scalars(select(TutorMessage).where(TutorMessage.session_id == s.id)
                                  .order_by(TutorMessage.id.desc()).limit(HISTORY)))[::-1]
        while history and history[0].role != "user":  # диалог должен начинаться с ученика
            history.pop(0)
        try:
            reply, tin, tout = gateway.complete(_system_prompt(db, user, lesson, s.stage),
                                                [{"role": m.role, "content": m.content} for m in history])
        except gateway.TutorUnavailable:
            db.rollback()
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "tutor_unavailable")
        reply, model = reply or REFUSAL[lang], settings.llm_model

    bot = TutorMessage(session_id=s.id, role="assistant", content=reply, model=model, input_tokens=tin, output_tokens=tout)
    db.add(bot)
    db.commit()
    return {"user": {"id": user_msg.id, "role": "user", "content": user_msg.content, "at": user_msg.created_at.isoformat()},
            "reply": {"id": bot.id, "role": "assistant", "content": bot.content, "at": bot.created_at.isoformat()},
            "remaining": max(0, settings.tutor_daily_limit - _used_today(db, user.id))}


def _own_session(db: Session, user: User, session_id: int) -> TutorSession:
    s = db.get(TutorSession, session_id)
    if not s or s.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return s


def _check_tasks(db: Session, lesson_id: int) -> list[Task]:
    tasks = list(db.scalars(select(Task).where(Task.lesson_id == lesson_id, Task.purpose == "verification").order_by(Task.id)))
    tasks += list(db.scalars(select(Task).where(Task.lesson_id == lesson_id, Task.purpose == "diagnostic").order_by(Task.id)))
    return tasks[:CHECK_TASKS]


@router.post("/sessions/{session_id}/stage")
def set_stage(session_id: int, payload: StageIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = _own_session(db, user, session_id)
    if s.stage >= 7 or s.finished_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "check_stage")
    s.stage = payload.stage
    db.commit()
    return _session_out(db, s)


@router.get("/sessions/{session_id}/check")
def start_check(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Этапы 7–9: задания из банка без помощи AI."""
    s = _own_session(db, user, session_id)
    if not s.lesson_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no_lesson")
    if not s.finished_at:
        s.stage = 7
        db.commit()
    return {"session": _session_out(db, s), "tasks": [task_public(t) for t in _check_tasks(db, s.lesson_id)]}


@router.post("/sessions/{session_id}/check")
def finish_check(session_id: int, payload: CheckIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = _own_session(db, user, session_id)
    if s.finished_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "already_finished")
    if s.stage < 7 or not s.lesson_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "check_not_started")
    results, score = [], 0
    for t in _check_tasks(db, s.lesson_id):
        choice = payload.answers.get(str(t.id))
        correct = choice == t.answer
        if choice is not None:
            score += correct
            db.add(LearningEvent(user_id=user.id, lesson_id=t.lesson_id, task_id=t.id, source="verification",
                                 correct=correct, choice=choice))
        results.append({"task_id": t.id, "choice": choice, "answer": t.answer, "correct": correct, "explanation": t.explanation})
    s.stage, s.finished_at = 9, datetime.now(timezone.utc)
    s.result = "passed" if score >= PASS else "failed"
    db.flush()
    if s.result == "passed":
        schedule_check(db, user.id, s.lesson_id, "tutor", s.recommendation_id)
    sync_student(db, user.id)
    db.commit()
    return {"session": _session_out(db, s), "score": score, "total": len(results), "results": results}
