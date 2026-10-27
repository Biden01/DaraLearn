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
from app.modules.content.service import lessons_of, subject_by_slug, task_public
from app.modules.decisions.models import Recommendation
from app.modules.decisions.service import sync_student
from app.modules.events.models import LearningEvent
from app.modules.verification.service import schedule_check
from app.modules.school.models import User
from app.modules.state.engine import SkillState, compute_states
from app.modules.tutor import gateway, markers
from app.modules.tutor.models import TutorMessage, TutorSession

router = APIRouter(prefix="/tutor", tags=["tutor"])

HISTORY = 20
PROMPT_VERSION = "tutor-v2"
HINT_LEVELS = 4   # намёк → направление → шаг решения → полный разбор
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
- Объясняй только на основе теории урока ниже. Если в ней нет нужного, ничего не выдумывай: скажи, что не уверен, и начни ответ с метки [[LOW_CONFIDENCE]].
- Правильность ответа ученика определяет система по ключу задания, а не ты: не утверждай «верно/неверно» сам, пока не знаешь ключ.
- Если видишь типичную ошибку ученика, в конце ответа добавь метку [[MISCONCEPTION: коротко, в чём ошибка]]. Метки ученик не видит.
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
CALLED = {
    "kk": "Мен нақты сенімді емеспін, сондықтан мұғалімге хабарладым.",
    "ru": "Я не уверен в этом, поэтому передал вопрос учителю.",
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
STYLES = {4: "hints", 5: "explanation", 6: "worked_example"}
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
            "hints_used": s.hints_used, "first_attempt_correct": s.first_attempt_correct, "escalated": s.escalated,
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
                     goal=f"{rec.action}:{rec.cause}" if rec else "", prompt_version=PROMPT_VERSION)
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
        reply, low, mis = markers.parse(reply)
        reply, model = reply or REFUSAL[lang], settings.llm_model
        if mis:
            s.misconception = mis
        if low:
            reply += "\n\n" + CALLED[lang]
            _escalate(db, s, user, "tutor_low_confidence", payload.text)

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
    if payload.stage >= 4 and s.first_attempt_correct is not False and not s.hints_used:
        raise HTTPException(status.HTTP_409_CONFLICT, "try_first")  # сначала сам; помощь — после ошибки или по подсказке
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
        s.style_used = STYLES.get(s.stage, s.style_used)
        s.stage = 7
        db.commit()
    tasks = [{**task_public(t), "step": 7 + i} for i, t in enumerate(_check_tasks(db, s.lesson_id))]
    return {"session": _session_out(db, s), "tasks": tasks}


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


def _escalate(db: Session, s: TutorSession, user: User, reason: str, text: str = "") -> None:
    """Случай в ленту учителя: низкий confidence Tutor или кнопка «позвать учителя». Автоэскалации по числу попыток нет."""
    s.escalated = True
    if reason == "tutor_low_confidence":
        s.tutor_confidence = "low"
    lesson_id = s.lesson_id or lessons_of(db, subject_by_slug(db, "math").id)[0].id
    open_ = db.scalar(select(Recommendation.id).where(
        Recommendation.user_id == user.id, Recommendation.lesson_id == lesson_id,
        Recommendation.rule == f"escalation:{reason}", Recommendation.status == "new"))
    if open_:
        return
    db.add(Recommendation(user_id=user.id, lesson_id=lesson_id, action="teacher", cause="topic", priority=3,
                          rule=f"escalation:{reason}", needs_teacher=True, comment=text[:500]))


class CallIn(BaseModel):
    text: str = Field(default="", max_length=500)


@router.post("/sessions/{session_id}/call-teacher")
def call_teacher(session_id: int, payload: CallIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = _own_session(db, user, session_id)
    _escalate(db, s, user, "student_call", payload.text)
    db.commit()
    return {"escalated": True}


def _first_task(db: Session, s: TutorSession) -> Task:
    seen = set(db.scalars(select(LearningEvent.task_id).where(LearningEvent.user_id == s.user_id,
                                                              LearningEvent.lesson_id == s.lesson_id)))
    tasks = list(db.scalars(select(Task).where(Task.lesson_id == s.lesson_id, Task.purpose == "practice").order_by(Task.id)))
    if not tasks:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no_tasks")
    return next((t for t in tasks if t.id not in seen), tasks[0])


@router.get("/sessions/{session_id}/task")
def first_attempt_task(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Шаг 3: задача без подсказок."""
    s = _own_session(db, user, session_id)
    if not s.lesson_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no_lesson")
    if s.finished_at or s.stage >= 7:
        raise HTTPException(status.HTTP_409_CONFLICT, "check_stage")
    t = db.get(Task, s.first_task_id) if s.first_task_id else _first_task(db, s)
    s.first_task_id = t.id
    s.stage = max(s.stage, 3)
    db.commit()
    return {"task": task_public(t), "answered": s.first_attempt_correct is not None}


class AttemptIn(BaseModel):
    choice: int = Field(ge=0, le=9)


@router.post("/sessions/{session_id}/attempt")
def first_attempt(session_id: int, payload: AttemptIn, user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> dict:
    """Ответ проверяет система по ключу задания. Верно с первой попытки — шаги 4–6 пропускаются."""
    s = _own_session(db, user, session_id)
    if s.first_attempt_correct is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "already_answered")
    if not s.first_task_id or s.stage >= 7 or s.finished_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no_first_task")
    t = db.get(Task, s.first_task_id)
    correct = payload.choice == t.answer
    s.first_attempt_correct = correct
    # это практика внутри занятия (с доступной помощью), а не независимая проверка
    db.add(LearningEvent(user_id=user.id, lesson_id=t.lesson_id, task_id=t.id, source="practice",
                         correct=correct, choice=payload.choice))
    s.stage = 7 if correct else 4
    db.commit()
    return {"correct": correct, "next_stage": s.stage, "explanation": t.explanation if correct else None}


@router.post("/sessions/{session_id}/hint")
def hint(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Лестница подсказок: одна ступень за вызов. Ступень 4 — полный разбор из проверенной базы, после него обязательна проверка."""
    s = _own_session(db, user, session_id)
    if not s.first_task_id or s.stage >= 7 or s.finished_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no_first_task")
    if s.hints_used >= HINT_LEVELS:
        raise HTTPException(status.HTTP_409_CONFLICT, "no_more_hints")
    lang = user.lang if user.lang in RULES else "kk"
    lesson = db.get(Lesson, s.lesson_id)
    t = db.get(Task, s.first_task_id)
    level = s.hints_used + 1
    if level == HINT_LEVELS:
        text = t.explanation.get(lang, "")
    else:
        theory = [l.removeprefix("$ ").removeprefix("! ") for l in lesson.theory.get(lang, [])]
        text = theory[min(level - 1, len(theory) - 1)] if theory else ""
        if gateway.enabled():
            try:
                q = t.question.get(lang, "") if isinstance(t.question, dict) else t.question
                text, *_ = gateway.complete(_system_prompt(db, user, lesson, 4),
                                            [{"role": "user", "content": f"Задача: {q}\nДай подсказку ступени {level} из 3 "
                                              "(1 — намёк, на что обратить внимание; 2 — какую формулу или идею применить; "
                                              "3 — первый шаг решения). Не называй ответ."}])
                text = markers.parse(text)[0] or text
            except gateway.TutorUnavailable:
                pass  # остаётся строка из теории
    s.hints_used = level
    s.stage = max(s.stage, 4)
    db.commit()
    return {"level": level, "hint": text, "last": level == HINT_LEVELS, "check_required": level == HINT_LEVELS}


@router.get("/sessions/{session_id}/record")
def record(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Структурированная запись сессии: именно она возвращается в Student State."""
    s = _own_session(db, user, session_id)
    lesson = db.get(Lesson, s.lesson_id) if s.lesson_id else None
    end = s.finished_at or datetime.now(timezone.utc)
    return {"student_id": f"pseudo-{user.id:05d}", "skill_id": lesson.slug if lesson else None, "goal": s.goal,
            "first_attempt_correct": s.first_attempt_correct, "hints_used": s.hints_used,
            "misconception": s.misconception, "verification_result": s.result, "tutor_confidence": s.tutor_confidence,
            "style_used": s.style_used, "escalated": s.escalated, "duration_sec": int((end - s.created_at).total_seconds()),
            "prompt_version": s.prompt_version}
