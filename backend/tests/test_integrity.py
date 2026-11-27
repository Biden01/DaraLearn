"""Защита от списывания (verification/integrity.py) и доверие к оценке (state/trust.py)."""
from datetime import datetime, timedelta, timezone

from app.modules.content.models import Task
from app.modules.events.models import LearningEvent
from app.modules.verification.models import Attempt
from tests.conftest import answer_all, diagnostic, register, right
from tests.test_pqs_import import _post


def _start(s, lesson="sqrt"):
    return s.ok("POST", "/api/verification/attempts", 201, json={"kind": "verification", "subject": "math", "lesson": lesson})


def _lesson_trust(s, slug="sqrt"):
    return next(l["trust"] for l in s.ok("GET", "/api/state/me")["lessons"] if l["slug"] == slug)


def test_shuffled_options_scored_by_meaning_and_stored_as_original(db):
    s = register()
    a = _start(s)
    r = s.ok("POST", f"/api/verification/attempts/{a['id']}/submit", json={"answers": answer_all(a["tasks"])})
    assert r["score"] == r["total"]
    # ученику — индексы в его порядке вариантов, в базе — исходные (на них держится разбор ошибок)
    for res, t in zip(r["results"], a["tasks"]):
        assert res["correct"] and res["choice"] == res["answer"] == right(t)
    evs = db.query(LearningEvent).filter(LearningEvent.attempt_id == a["id"]).all()
    assert evs and all(e.choice == db.get(Task, e.task_id).answer for e in evs)


def test_unseen_tasks_first_and_repeat_flag(db):
    s = register()
    diagnostic(s)  # диагностическое задание sqrt уже видел
    a = _start(s)
    me = s.ok("GET", "/api/auth/me")["id"]
    seen = {e.task_id for e in db.query(LearningEvent).filter(LearningEvent.source == "diagnostic", LearningEvent.user_id == me)}
    ids = [t["id"] for t in a["tasks"]]
    fresh = [i for i in ids if i not in seen]
    assert fresh and ids[:len(fresh)] == fresh, "сначала невиденные"
    s.ok("POST", f"/api/verification/attempts/{a['id']}/submit", json={"answers": answer_all(a["tasks"])})
    flags = {e.task_id: e.flags or "" for e in db.query(LearningEvent).filter(LearningEvent.attempt_id == a["id"])}
    assert all(("repeat" in f) == (tid in seen) for tid, f in flags.items())


def test_retake_cooldown_but_assigned_checks_allowed():
    s = register()
    a = _start(s)
    s.ok("POST", f"/api/verification/attempts/{a['id']}/submit", json={"answers": answer_all(a["tasks"])})
    r = s.post("/api/verification/attempts", json={"kind": "verification", "subject": "math", "lesson": "sqrt"})
    assert r.status_code == 429 and r.json()["detail"].startswith("retake_cooldown:")


def test_signals_away_fast_late(db):
    s = register()
    a = _start(s)
    r = s.ok("POST", f"/api/verification/attempts/{a['id']}/submit",
             json={"answers": answer_all(a["tasks"]), "signals": {"away_count": 3, "away_seconds": 40}})
    assert set(r["integrity"]["flags"]) >= {"away", "fast"}  # сдал сразу — «слишком быстро»
    # сдал после лимита времени
    s2 = register()
    b = _start(s2)
    att = db.get(Attempt, b["id"])
    att.started_at = datetime.now(timezone.utc) - timedelta(seconds=att.time_limit + 600)
    db.commit()
    r2 = s2.ok("POST", f"/api/verification/attempts/{b['id']}/submit", json={"answers": answer_all(b["tasks"])})
    assert "late" in r2["integrity"]["flags"] and "fast" not in r2["integrity"]["flags"]


def test_tutor_check_tasks_fixed_per_session_and_shuffled():
    s = register()
    diagnostic(s, wrong={"sqrt"})
    sid = s.ok("POST", "/api/tutor/sessions", 201, json={"lesson": "sqrt"})["id"]
    s.ok("GET", f"/api/tutor/sessions/{sid}/task")
    s.ok("POST", f"/api/tutor/sessions/{sid}/hint")
    s.ok("POST", f"/api/tutor/sessions/{sid}/stage", json={"stage": 6})
    first = s.ok("GET", f"/api/tutor/sessions/{sid}/check")["tasks"]
    again = s.ok("GET", f"/api/tutor/sessions/{sid}/check")["tasks"]
    assert [t["id"] for t in first] == [t["id"] for t in again] and [t["options"] for t in first] == [t["options"] for t in again]
    done = s.ok("POST", f"/api/tutor/sessions/{sid}/check", json={"answers": answer_all(first)})
    assert done["session"]["result"] == "passed" and all(r["correct"] for r in done["results"])


def test_trust_levels(school):
    teacher = school["teacher"]
    # мало данных
    kid = register(code=school["class"]["code"])
    assert _lesson_trust(kid)["level"] == "insufficient"
    # на сайте всё верно, внешнего результата нет — среднее
    diagnostic(kid)
    a = _start(kid)
    kid.ok("POST", f"/api/verification/attempts/{a['id']}/submit",
           json={"answers": answer_all(a["tasks"]), "signals": {"away_count": 0, "away_seconds": 0}})
    t = _lesson_trust(kid)
    assert t["level"] in ("medium", "low") and "no_external" in t["reasons"] and t["n_external"] == 0
    # ПҚС по теме провален, а на сайте всё верно — низкое доверие: «на сайте выше внешнего»
    email = kid.ok("GET", "/api/auth/me")["email"]
    _post(teacher, [[email, "sqrt", "0", f"2026-11-0{d}"] for d in range(1, 5)])  # длинный формат: ученик, навык, результат, дата
    t = _lesson_trust(kid)
    assert t["level"] == "low" and t["reasons"][0] == "site_higher" and t["n_external"] == 4
    # учитель видит то же доверие в карточке ученика
    kid_id = kid.ok("GET", "/api/auth/me")["id"]
    st = teacher.ok("GET", f"/api/state/students/{kid_id}")
    assert next(l for l in st["lessons"] if l["slug"] == "sqrt")["trust"]["level"] == "low"
    assert st["trust"]["level"] in ("low", "medium", "high")
