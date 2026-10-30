"""План ученика от цели месяца к ПҚС: месяц → 4 недели по непокрытым темам → темы по дням → план на день.

План на день: занятие с Tutor, закрепление, мини-проверка. Объём фиксирован (rules.py).
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.content.models import Course, Lesson, Task
from app.modules.content.service import lessons_of, subject_by_slug
from app.modules.decisions.engine import _root_gap
from app.modules.events.models import LearningEvent
from app.modules.plan import rules
from app.modules.plan.models import ClassTopic, DailyPlan, GoalTopic, MonthlyGoal, PlanItem
from app.modules.school.models import ClassMember, SchoolClass, User
from app.modules.state.engine import SkillState, compute_states
from app.modules.tutor.models import TutorSession
from app.modules.verification.models import Check


def student_class(db: Session, user_id: int) -> SchoolClass | None:
    return db.scalar(select(SchoolClass).join(ClassMember, ClassMember.class_id == SchoolClass.id)
                     .where(ClassMember.user_id == user_id).order_by(ClassMember.id).limit(1))


def current_topic(db: Session, class_id: int, day: date) -> ClassTopic | None:
    return db.scalar(select(ClassTopic).where(ClassTopic.class_id == class_id, ClassTopic.starts_on <= day)
                     .order_by(ClassTopic.starts_on.desc()).limit(1))


def set_topic(db: Session, class_id: int, course_id: int, day: date, by: int) -> ClassTopic:
    t = db.scalar(select(ClassTopic).where(ClassTopic.class_id == class_id, ClassTopic.starts_on == day))
    if t:
        t.course_id, t.set_by = course_id, by
    else:
        t = ClassTopic(class_id=class_id, course_id=course_id, starts_on=day, set_by=by)
        db.add(t)
    db.flush()
    return t


def _dropping(s: SkillState) -> bool:
    """Динамика падает: последние независимые ответы хуже предыдущих."""
    h = s.history
    if len(h) < 4:
        return False
    half = len(h) // 2
    return sum(h[half:]) / len(h[half:]) < sum(h[:half]) / half


def _unseen_tasks(db: Session, user_id: int, lesson_id: int, purpose: str, n: int, taken: set[int]) -> list[int]:
    """Сначала задания, которых ученик ещё не видел; если их не хватает — повторяем, чтобы объём не менялся."""
    seen = set(db.scalars(select(LearningEvent.task_id).where(LearningEvent.user_id == user_id,
                                                              LearningEvent.lesson_id == lesson_id)))
    ids = list(db.scalars(select(Task.id).where(Task.lesson_id == lesson_id, Task.purpose == purpose).order_by(Task.id)))
    ids = [i for i in ids if i not in taken]
    fresh = [i for i in ids if i not in seen]
    return (fresh + [i for i in ids if i in seen])[:n]


def _carried_lessons(db: Session, user_id: int, day: date) -> set[int]:
    """Навыки из невыполненных пунктов последних дней: идут в приоритет."""
    since = day - timedelta(days=rules.CARRY_DAYS)
    return set(db.scalars(select(PlanItem.lesson_id).join(DailyPlan, DailyPlan.id == PlanItem.plan_id).where(
        DailyPlan.user_id == user_id, DailyPlan.day >= since, DailyPlan.day < day, PlanItem.status == "pending")))


def _pick_course(db: Session, user: User, lessons: list[Lesson], states: dict[int, SkillState], day: date) -> int:
    cls = student_class(db, user.id)
    topic = current_topic(db, cls.id, day) if cls else None
    if topic:
        return topic.course_id
    # учитель тему не задал: первая тема, где есть не освоенный урок
    for l in lessons:
        if states.get(l.id, SkillState()).status != "mastered":
            return l.course_id
    return lessons[-1].course_id


def week_of(day: date) -> int:
    """Неделя месяца 1–4: 1–7, 8–14, 15–21, с 22-го до конца месяца."""
    return min(rules.WEEKS, (day.day - 1) // 7 + 1)


def next_month(m: date) -> date:
    return (m.replace(day=28) + timedelta(days=4)).replace(day=1)


def _subject_lessons(db: Session, user: User) -> list[Lesson]:
    cls = student_class(db, user.id)
    return lessons_of(db, subject_by_slug(db, cls.subject if cls else "math").id)


def build_goal(db: Session, user: User, day: date) -> MonthlyGoal:
    """Цель месяца: темы с пробелом или ещё не закреплённые (в том числе по ПҚС), в порядке программы —
    базовые раньше зависимых. Делятся поровну на оставшиеся недели месяца (собрана в середине месяца — прошедшие
    недели пропускаем). Нет таких тем — берём неосвоенные уроки темы класса."""
    month = day.replace(day=1)
    goal = db.scalar(select(MonthlyGoal).where(MonthlyGoal.user_id == user.id, MonthlyGoal.month == month))
    if goal:
        return goal
    lessons = _subject_lessons(db, user)
    states = compute_states(db, user.id)

    def st(l: Lesson) -> SkillState:
        return states.get(l.id, SkillState())

    picked = [l for l in lessons if st(l).status in ("gap", "learning")][:rules.GOAL_TOPICS]
    if not picked and lessons:
        course_id = _pick_course(db, user, lessons, states, day)
        picked = [l for l in lessons if l.course_id == course_id and st(l).status != "mastered"][:rules.GOAL_TOPICS]
    goal = MonthlyGoal(user_id=user.id, month=month, starts_on=day, rules_version=rules.RULES_VERSION)
    db.add(goal)
    db.flush()
    n, first = len(picked), week_of(day)
    k = rules.WEEKS - first + 1
    db.add_all([GoalTopic(goal_id=goal.id, lesson_id=l.id, week=first + (i * k // n if n >= k else i),
                          order=i, start_status=st(l).status, start_proof=round(st(l).indep, 2))
                for i, l in enumerate(picked)])
    db.flush()
    return goal


def goal_topics(db: Session, goal: MonthlyGoal) -> list[GoalTopic]:
    return list(db.scalars(select(GoalTopic).where(GoalTopic.goal_id == goal.id).order_by(GoalTopic.order)))


def goal_schedule(goal: MonthlyGoal, topics: list[GoalTopic]) -> dict[date, list[int]]:
    """Темы по дням: дни недели делятся между её темами подряд (первые темы получают лишний день).
    Тем в неделе больше, чем дней, — в день по несколько. Неделя без тем — дни повторения (пустой список)."""
    start, end = goal.starts_on or goal.month, next_month(goal.month)
    days = [start + timedelta(days=i) for i in range((end - start).days)]
    out: dict[date, list[int]] = {d: [] for d in days}
    for w in range(1, rules.WEEKS + 1):
        dw = [d for d in days if week_of(d) == w]
        tw = [t.lesson_id for t in topics if t.week == w]
        if not dw or not tw:
            continue
        if len(tw) <= len(dw):
            for j, d in enumerate(dw):
                out[d] = [tw[j * len(tw) // len(dw)]]
        else:
            for i, lid in enumerate(tw):
                out[dw[i * len(dw) // len(tw)]].append(lid)
    return out


def rebuild_goal(db: Session, user: User, day: date) -> MonthlyGoal:
    """Собрать цель месяца заново (например, после загрузки новых результатов ПҚС).
    Начатый план на сегодня не трогаем, не начатый пересоберётся от новой цели."""
    month = day.replace(day=1)
    old = db.scalar(select(MonthlyGoal).where(MonthlyGoal.user_id == user.id, MonthlyGoal.month == month))
    if old:
        db.delete(old)
        db.flush()
    plan = db.scalar(select(DailyPlan).where(DailyPlan.user_id == user.id, DailyPlan.day == day))
    if plan and not any(i.status == "done" for i in refresh_progress(db, plan)):
        db.delete(plan)
        db.flush()
    return build_goal(db, user, day)


def build_plan(db: Session, user: User, day: date) -> DailyPlan:
    """Собрать план на день от цели месяца. Повторный вызов возвращает уже собранный план."""
    plan = db.scalar(select(DailyPlan).where(DailyPlan.user_id == user.id, DailyPlan.day == day))
    if plan:
        return plan
    lessons = _subject_lessons(db, user)
    states = compute_states(db, user.id)
    by_id = {l.id: l for l in lessons}
    by_slug = {l.slug: l for l in lessons}
    carried = _carried_lessons(db, user.id, day)
    goal = build_goal(db, user, day)
    topics = [t for t in goal_topics(db, goal) if t.lesson_id in by_id]
    goal_ids = {t.lesson_id for t in topics}
    of_day = [i for i in goal_schedule(goal, topics).get(day, []) if i in by_id]

    def st(l: Lesson) -> SkillState:
        return states.get(l.id, SkillState())

    # 1. Занятие с Tutor: тема этого дня по расписанию; уже освоена — тема недели, потом оставшиеся с прошлых
    #    недель, потом следующие. Вся цель освоена — повторяем самую слабую её тему.
    #    Если тему блокирует prerequisite — занимаемся им.
    week = week_of(day)
    open_ = [t for t in topics if st(by_id[t.lesson_id]).status != "mastered"]
    queue = ([t for t in open_ if t.lesson_id in of_day] + [t for t in open_ if t.week == week]
             + [t for t in open_ if t.week < week] + [t for t in open_ if t.week > week])
    if queue:
        target = by_id[queue[0].lesson_id]
    elif topics:
        target = min((by_id[t.lesson_id] for t in topics), key=lambda l: st(l).indep)
    else:
        course_id = _pick_course(db, user, lessons, states, day)
        topic_lessons = [l for l in lessons if l.course_id == course_id]
        target = next((l for l in topic_lessons if st(l).status != "mastered"), None) \
            or min(topic_lessons, key=lambda l: st(l).indep)
    root = _root_gap(target, by_slug, states)
    tutor_lesson, tutor_reason = (root, "prereq") if root else (target, "current")
    if tutor_lesson.id in carried:
        tutor_reason = "carried"

    plan = DailyPlan(user_id=user.id, day=day, rules_version=rules.RULES_VERSION, total_minutes=rules.TOTAL_MIN)
    db.add(plan)
    db.flush()
    items = [PlanItem(plan_id=plan.id, block="tutor", lesson_id=tutor_lesson.id, reason=tutor_reason,
                      minutes=rules.TUTOR_MIN, task_ids=[], order=0)]

    # 2. Закрепление: тема дня + самые слабые навыки, сначала из цели месяца (пропущенное вчера — первым).
    weak = [l for l in lessons if l.id != target.id and l.id != tutor_lesson.id
            and st(l).n_indep + st(l).n_practice > 0 and st(l).status in ("gap", "learning")]
    weak.sort(key=lambda l: (l.id not in of_day, l.id not in goal_ids, l.id not in carried, st(l).indep - (0.1 if _dropping(st(l)) else 0)))
    weak = weak[:rules.WEAK_SKILLS]
    taken: set[int] = set()
    quotas = [(target, max(rules.PRACTICE_TASKS - len(weak), 2) if weak else rules.PRACTICE_TASKS, "current")]
    left = rules.PRACTICE_TASKS - quotas[0][1]
    for i, l in enumerate(weak):
        q = left // len(weak) + (1 if i < left % len(weak) else 0)
        if q:
            quotas.append((l, q, "weak"))
    practice_ids: list[int] = []
    for l, q, _ in quotas:
        ids = _unseen_tasks(db, user.id, l.id, "practice", q, taken)
        taken.update(ids)
        practice_ids += ids
    if practice_ids:
        items.append(PlanItem(plan_id=plan.id, block="practice", lesson_id=target.id, reason="current",
                              minutes=rules.PRACTICE_MIN, task_ids=practice_ids, order=1))

    # 3. Мини-проверка: навык, который дольше всех не проверяли после помощи; темы цели — первыми.
    helped = {tid for tid in db.scalars(select(Check.lesson_id).where(Check.user_id == user.id))}
    helped |= {l.id for l in lessons if st(l).n_practice}
    helped |= set(db.scalars(select(TutorSession.lesson_id).where(TutorSession.user_id == user.id,
                                                                    TutorSession.lesson_id.is_not(None))))
    pool = [by_id[i] for i in helped if i in by_id] or [l for l in lessons if st(l).n_indep]
    pool.sort(key=lambda l: (l.id not in goal_ids, st(l).last_check or datetime.min.replace(tzinfo=timezone.utc)))
    for l in pool:
        ids = _unseen_tasks(db, user.id, l.id, "verification", rules.CHECK_TASKS, set())
        if ids:
            items.append(PlanItem(plan_id=plan.id, block="check", lesson_id=l.id, reason="delayed",
                                  minutes=rules.CHECK_MIN, task_ids=ids, order=2))
            break

    db.add_all(items)
    db.flush()
    return plan


def refresh_progress(db: Session, plan: DailyPlan) -> list[PlanItem]:
    """Пункт выполнен, когда ученик ответил на все его задания (practice, check) или завершил сессию Tutor."""
    items = list(db.scalars(select(PlanItem).where(PlanItem.plan_id == plan.id).order_by(PlanItem.order)))
    start = plan.created_at
    now = datetime.now(timezone.utc)
    for it in items:
        if it.status == "done":
            continue
        if it.block == "tutor":
            done = db.scalar(select(TutorSession.id).where(
                TutorSession.user_id == plan.user_id, TutorSession.lesson_id == it.lesson_id,
                TutorSession.finished_at.is_not(None), TutorSession.created_at >= start).limit(1)) is not None
        else:
            answered = set(db.scalars(select(LearningEvent.task_id).where(
                LearningEvent.user_id == plan.user_id, LearningEvent.task_id.in_(it.task_ids or [-1]),
                LearningEvent.created_at >= start)))
            done = bool(it.task_ids) and answered >= set(it.task_ids)
        if done:
            it.status, it.done_at = "done", now
    db.flush()
    return items


def adherence(db: Session, user_id: int, today: date) -> tuple[float, int, int]:
    """За последние дни (без сегодняшнего): доля выполненных пунктов, число дней плана, дни без единого выполненного."""
    since = today - timedelta(days=rules.ADHERENCE_DAYS)
    plans = list(db.scalars(select(DailyPlan).where(DailyPlan.user_id == user_id, DailyPlan.day >= since,
                                                    DailyPlan.day < today)))
    for p in plans:
        refresh_progress(db, p)
    rows = list(db.scalars(select(PlanItem).where(PlanItem.plan_id.in_([p.id for p in plans] or [-1]))))
    if not rows:
        return 1.0, 0, 0
    misses = sum(not any(i.status == "done" for i in rows if i.plan_id == p.id) for p in plans)
    return sum(i.status == "done" for i in rows) / len(rows), len(plans), misses


def needs_curator(db: Session, user_id: int, today: date) -> bool:
    rate, days, misses = adherence(db, user_id, today)
    return days >= rules.ADHERENCE_MISSES and (rate < rules.ADHERENCE_LIMIT or misses >= rules.ADHERENCE_MISSES)
