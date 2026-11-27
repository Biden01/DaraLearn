"""Доверие к оценке навыка («уверенность оценки» в Student State, ТЗ слайд 9).

Насколько можно верить результату ученика по навыку. Смотрим на две группы данных:
- работы на сайте: диагностика, проверочные тесты, этапы 7–9 Tutor и отложенные проверки (без подсказок);
- внешние результаты: ПҚС / БЖБ и другие тесты, загруженные учителем (source="import").

Уровень:
- insufficient — меньше MIN_DATA ответов всего: «Недостаточно данных»;
- low — на сайте результат намного выше внешнего (возможная помощь со стороны) или больше половины ответов
  на сайте с отметками честности (уходил с вкладки, слишком быстро, после лимита, знакомое задание);
- high — внешний результат есть и совпадает с сайтом, ответы на сайте в основном без отметок, проверка недавняя;
- medium — всё остальное, в том числе когда внешнего подтверждения пока нет.

Доверие ничего не блокирует и не меняет правила decision-v1: это объяснение для ученика и учителя.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.events.models import LearningEvent

WINDOW = 6            # последних ответов с каждой стороны
MIN_DATA = 3
AGREE = 0.2           # |сайт − внешний| не больше — совпадает
MISMATCH = 0.4        # сайт выше внешнего больше чем на это — низкое доверие
CLEAN_HIGH = 0.8      # доля ответов без отметок для высокого доверия
CLEAN_LOW = 0.5
STALE_DAYS = 45       # последняя проверка старше — доверие не выше среднего
LEVELS = ("insufficient", "low", "medium", "high")


@dataclass
class Trust:
    level: str = "insufficient"
    reasons: list[str] = field(default_factory=list)
    site: float | None = None       # доля верных на сайте (последние WINDOW)
    external: float | None = None   # доля верных во внешних результатах
    n_site: int = 0
    n_external: int = 0
    clean: float | None = None      # доля ответов на сайте без отметок

    def as_dict(self) -> dict:
        r = lambda v: round(v, 2) if v is not None else None
        return {"level": self.level, "reasons": self.reasons, "site": r(self.site), "external": r(self.external),
                "n_site": self.n_site, "n_external": self.n_external, "clean": r(self.clean)}


def _level(site: list[tuple[bool, str | None, datetime]], ext: list[tuple[bool, datetime]], now: datetime) -> Trust:
    t = Trust(n_site=len(site), n_external=len(ext))
    recent_site, recent_ext = site[-WINDOW:], ext[-WINDOW:]
    if recent_site:
        t.site = sum(c for c, _, _ in recent_site) / len(recent_site)
        t.clean = sum(not f for _, f, _ in recent_site) / len(recent_site)
    if recent_ext:
        t.external = sum(c for c, _ in recent_ext) / len(recent_ext)
    if t.n_site + t.n_external < MIN_DATA:
        t.reasons.append("few_data")
        return t

    flags = defaultdict(int)
    for _, f, _ in recent_site:
        for x in (f or "").split(","):
            if x:
                flags[x] += 1
    t.reasons += [f for f in ("away", "fast", "late", "repeat") if flags[f]]

    last = max([at for _, _, at in site] + [at for _, at in ext])
    last = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
    stale = now - last > timedelta(days=STALE_DAYS)
    if stale:
        t.reasons.append("stale")

    if t.site is not None and t.external is not None:
        diff = t.site - t.external
        if diff > MISMATCH:
            t.reasons.insert(0, "site_higher")
            t.level = "low"
            return t
        if abs(diff) <= AGREE:
            t.reasons.insert(0, "external_agrees")
        else:
            t.reasons.insert(0, "site_higher" if diff > 0 else "site_lower")
    elif t.external is None:
        t.reasons.append("no_external")
    else:
        t.reasons.append("no_site")

    if t.clean is not None and t.clean < CLEAN_LOW:
        t.level = "low"
    elif ("external_agrees" in t.reasons and (t.clean is None or t.clean >= CLEAN_HIGH) and not stale):
        t.level = "high"
    else:
        t.level = "medium"
    return t


def compute_trust(db: Session, user_id: int) -> dict[int, Trust]:
    rows = db.execute(select(LearningEvent.lesson_id, LearningEvent.source, LearningEvent.correct,
                             LearningEvent.flags, LearningEvent.created_at)
                      .where(LearningEvent.user_id == user_id, LearningEvent.source != "practice")
                      .order_by(LearningEvent.id)).all()
    site: dict[int, list] = defaultdict(list)
    ext: dict[int, list] = defaultdict(list)
    for lesson_id, source, correct, flags, at in rows:
        if source == "import":
            ext[lesson_id].append((correct, at))
        else:
            site[lesson_id].append((correct, flags, at))
    now = datetime.now(timezone.utc)
    return {lid: _level(site.get(lid, []), ext.get(lid, []), now) for lid in set(site) | set(ext)}


def overall(trusts: list[Trust]) -> dict:
    """Итог по ученику: уровень, который чаще всего встречается среди навыков с данными (худший при равенстве)."""
    known = [t for t in trusts if t.level != "insufficient"]
    counts = {lvl: sum(t.level == lvl for t in known) for lvl in LEVELS}
    if not known:
        return {"level": "insufficient", "counts": counts}
    level = max(LEVELS[1:], key=lambda lvl: (counts[lvl], -LEVELS.index(lvl)))
    return {"level": level, "counts": counts}
