"""Нагрузка учителя (минуты в неделю до/после DaraLearn) и опрос удобства (оценки 1–5).

Сводка по нагрузке парная: «до» и «после» сравниваются только у учителей, у которых есть обе фазы, —
иначе разница отражала бы состав учителей, а не эффект. Это предварительный сигнал, а не доказательство.
"""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.analytics.models import SurveyResponse, TeacherTimeLog
from app.modules.school.models import ClassMember, SchoolClass, User

PILOT_START = date(2026, 11, 7)

# Волна опроса. Для повторного замера (например, в конце пилота) — новая волна, старые ответы остаются.
SURVEY = "pilot-1"
QUESTIONS = {
    "student": ["easy", "plan_clear", "tutor_helps", "confident", "recommend"],
    "teacher": ["easy", "feed_useful", "clear_picture", "saves_time", "recommend"],
}


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def suggested_phase(week: date) -> str:
    """Неделя, учебные дни которой (пн–пт) прошли до старта пилота, — стартовый замер."""
    return "before" if week + timedelta(days=4) < PILOT_START else "after"


def _mean(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 1) if xs else None


def user_arms(db: Session, users: list[User]) -> dict[int, str]:
    """Группа пилота пользователя по его классам: treatment / control, mixed — классы разных групп, "" — без группы."""
    arms: dict[int, set[str]] = {u.id: set() for u in users}
    ids = list(arms)
    if not ids:
        return {}
    for uid, arm in db.execute(select(SchoolClass.teacher_id, SchoolClass.arm).where(SchoolClass.teacher_id.in_(ids))):
        arms[uid].add(arm)
    for uid, arm in db.execute(select(ClassMember.user_id, SchoolClass.arm)
                               .join(SchoolClass, SchoolClass.id == ClassMember.class_id)
                               .where(ClassMember.user_id.in_(ids))):
        arms[uid].add(arm)
    out = {}
    for uid, s in arms.items():
        s.discard("")
        out[uid] = s.pop() if len(s) == 1 else ("mixed" if s else "")
    return out


def time_log_out(x: TeacherTimeLog) -> dict:
    return {"id": x.id, "week": x.week.isoformat(), "phase": x.phase, "check_minutes": x.check_minutes,
            "review_minutes": x.review_minutes, "total": x.check_minutes + x.review_minutes, "note": x.note}


def _phase_means(logs: list[TeacherTimeLog]) -> dict:
    return {"check": _mean([x.check_minutes for x in logs]), "review": _mean([x.review_minutes for x in logs]),
            "total": _mean([x.check_minutes + x.review_minutes for x in logs]), "weeks": len(logs)}


def _paired(rows: list[dict]) -> dict:
    """Среднее по учителям, у которых есть и «до», и «после»."""
    pairs = [r for r in rows if r["before"]["weeks"] and r["after"]["weeks"]]
    out = {"teachers": len(pairs)}
    for phase in ("before", "after"):
        out[phase] = {k: _mean([r[phase][k] for r in pairs]) for k in ("check", "review", "total")}
    b, a = out["before"]["total"], out["after"]["total"]
    out["change"] = round((a - b) / b, 3) if pairs and b else None
    return out


def workload_summary(db: Session) -> dict:
    logs: dict[int, list[TeacherTimeLog]] = {}
    for x in db.scalars(select(TeacherTimeLog).order_by(TeacherTimeLog.week)):
        logs.setdefault(x.user_id, []).append(x)
    teachers = list(db.scalars(select(User).where(User.id.in_(list(logs) or [-1])).order_by(User.name)))
    arms = user_arms(db, teachers)
    rows = []
    for u in teachers:
        mine = logs[u.id]
        rows.append({"id": u.id, "name": u.name, "arm": arms.get(u.id, ""),
                     "before": _phase_means([x for x in mine if x.phase == "before"]),
                     "after": _phase_means([x for x in mine if x.phase == "after"])})
    return {
        "pilot_start": PILOT_START.isoformat(),
        "teachers_logged": len(rows),
        "paired": _paired(rows),
        "by_arm": {arm: _paired([r for r in rows if r["arm"] == arm]) for arm in ("treatment", "control")},
        "teachers": rows,
    }


def survey_summary(db: Session, survey: str = SURVEY) -> dict:
    """Средние оценки по вопросам для каждой роли — всего и по группам пилота. Комментарии без имён."""
    rows = list(db.execute(select(SurveyResponse, User).join(User, User.id == SurveyResponse.user_id)
                           .where(SurveyResponse.survey == survey).order_by(SurveyResponse.updated_at.desc())))
    arms = user_arms(db, [u for _, u in rows])

    def avg(rs: list[SurveyResponse], qs: list[str]) -> dict:
        per_q = {q: _mean([r.answers[q] for r in rs if isinstance(r.answers.get(q), int)]) for q in qs}
        overall = [v for v in per_q.values() if v is not None]
        return {"responses": len(rs), "questions": per_q, "overall": _mean(overall)}

    roles = {}
    for role, qs in QUESTIONS.items():
        mine = [(r, u) for r, u in rows if r.role == role]
        roles[role] = {**avg([r for r, _ in mine], qs),
                       "by_arm": {arm: avg([r for r, u in mine if arms.get(u.id) == arm], qs)
                                  for arm in ("treatment", "control")}}
    comments = [{"role": r.role, "arm": arms.get(u.id, ""), "text": r.comment, "at": r.updated_at.isoformat()}
                for r, u in rows if r.comment.strip()][:50]
    return {"survey": survey, "questions": QUESTIONS, "roles": roles, "comments": comments}
