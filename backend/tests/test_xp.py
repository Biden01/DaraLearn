from tests.conftest import client, diagnostic, register


def test_xp_for_tasks_is_idempotent_and_ranked(school):
    s = register(code=school["class"]["code"])
    sid = s.ok("GET", "/api/auth/me")["id"]
    empty = s.ok("GET", "/api/xp/me")
    assert empty["xp"] == 0 and empty["rank"] == 1 and empty["next_xp"] == empty["ranks"][1]

    r = diagnostic(s, wrong={"linear-eq"})
    a = s.ok("GET", "/api/xp/me")
    assert r["score"] > 0 and a["by_kind"]["task"] == 5 * r["score"]  # каждое верное задание — +5
    assert a["xp"] == sum(a["by_kind"].values()) and a["week"] == a["xp"]
    assert s.ok("GET", "/api/xp/me")["xp"] == a["xp"]  # повторный запрос не начисляет второй раз

    # учитель класса видит ранг ученика, чужой ученик — нет
    assert school["teacher"].ok("GET", f"/api/xp/students/{sid}")["xp"] == a["xp"]
    other = register()
    assert other.get(f"/api/xp/students/{sid}").status_code == 403
    assert school["teacher"].get(f"/api/xp/students/{other.ok('GET', '/api/auth/me')['id']}").status_code == 404
    assert client().get("/api/xp/me").status_code == 401


def test_rank_thresholds():
    from app.modules.xp.service import RANKS, rank_of
    assert rank_of(0) == 1 and rank_of(RANKS[1] - 1) == 1 and rank_of(RANKS[1]) == 2
    assert rank_of(10 ** 6) == len(RANKS)


def test_xp_for_plan_step_and_day_without_skips(db):
    from tests.test_attendance import _do_practice
    s = register()
    diagnostic(s, wrong={"sqrt"})
    before = s.ok("GET", "/api/xp/me")
    assert "plan_step" not in before["by_kind"] and "attendance" not in before["by_kind"]
    _do_practice(s, db)
    after = s.ok("GET", "/api/xp/me")
    assert after["by_kind"]["plan_step"] == 15   # один шаг плана
    assert after["by_kind"]["attendance"] == 10  # первый день серии — без бонуса
    assert after["xp"] > before["xp"]
    assert s.ok("GET", "/api/xp/me")["xp"] == after["xp"]


def test_streak_bonus_grows_and_caps():
    from app.modules.xp.service import XP_STREAK_MAX, _streak_bonus
    assert _streak_bonus(1) == 0 and _streak_bonus(2) == 2 and _streak_bonus(5) == 8
    assert _streak_bonus(100) == XP_STREAK_MAX
