from app.modules.decisions import rules
from app.modules.decisions.engine import decide
from app.modules.state.engine import SkillState
from tests.conftest import diagnostic, register


class L:  # минимальный урок для чистого Decision Engine
    def __init__(self, i, slug, prereqs=()):
        self.id, self.slug, self.title, self.prereqs = i, slug, slug, list(prereqs)


def test_rules_are_versioned_and_exposed(school):
    r = school["teacher"].ok("GET", "/api/decisions/rules")
    assert r["version"] == rules.RULES.version and r["teacher_after_failed_sessions"] is None
    kid = register(code=school["class"]["code"])
    diagnostic(kid, wrong={"sqrt"})
    recs = kid.ok("GET", "/api/decisions/me")["recommendations"]
    assert recs


def test_no_teacher_escalation_by_attempt_count():
    lessons = [L(1, "a")]
    gap = SkillState(indep=0.2, n_indep=3)
    out = decide(lessons, {1: gap}, {1: 5})  # пять провальных сессий подряд
    assert out[0]["action"] == "lesson"      # Tutor продолжает, учитель не вызывается автоматически


def test_mastered_requires_verified_evidence():
    s = SkillState(indep=1.0, n_indep=3)          # три верных ответа в диагностике, проверки нет
    assert s.status == "likely"
    s.n_verified, s.verified = 1, 1.0
    assert s.status == "mastered"


def test_practice_verified_gap(db):
    from app.modules.events.models import LearningEvent
    from app.modules.content.models import Task
    from app.modules.state.engine import compute_states

    s = register()
    me = s.ok("GET", "/api/auth/me")["id"]
    t = db.query(Task).first()
    for source, ok in (("practice", True), ("practice", True), ("verification", False)):
        db.add(LearningEvent(user_id=me, lesson_id=t.lesson_id, task_id=t.id, source=source, correct=ok, choice=0))
    db.commit()
    st = compute_states(db, me)[t.lesson_id]
    assert st.practice == 1.0 and st.verified == 0.0 and st.gap == 1.0 and st.as_dict()["n_verified"] == 1


def test_notifications_seen_state(school):
    kid = register(code=school["class"]["code"])
    diagnostic(kid, wrong={"sqrt"})
    recs = kid.ok("GET", "/api/decisions/me")["recommendations"]
    assert recs and not any(r["seen"] for r in recs)
    ids = [r["id"] for r in recs]
    assert kid.ok("POST", "/api/decisions/me/seen", json={"ids": ids})["updated"] == len(ids)
    assert all(r["seen"] for r in kid.ok("GET", "/api/decisions/me")["recommendations"])
    assert kid.ok("POST", "/api/decisions/me/seen", json={"ids": ids})["updated"] == 0  # повторно — ничего
    # чужие рекомендации отметить нельзя
    other = register(code=school["class"]["code"])
    assert other.ok("POST", "/api/decisions/me/seen", json={"ids": ids})["updated"] == 0
    # решение учителя снова делает уведомление непрочитанным
    school["teacher"].ok("PATCH", f"/api/decisions/{ids[0]}", json={"status": "accepted", "comment": "ok"})
    after = {r["id"]: r for r in kid.ok("GET", "/api/decisions/me")["recommendations"]}
    assert after[ids[0]]["seen"] is False
