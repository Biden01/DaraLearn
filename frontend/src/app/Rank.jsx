import { useEffect, useState } from "react";
import { Bar, useApp } from "./ui.jsx";

// Ранги ученика: рамка аватарки (своя у каждого ранга), карточка ранга и поздравление с новым рангом.
// Данные — GET /xp/me (или /xp/students/{id} для учителя и родителя).

export function RankAvatar({ name, rank, size = 40, style }) {
  const letter = (name || "?")[0].toUpperCase();
  const inner = <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4), ...style }}>{letter}</div>;
  if (!rank) return inner;
  return <div className={`rank-frame r${rank}`} style={{ "--rf": `${Math.max(3, Math.round(size / 14))}px` }}>{inner}</div>;
}

export function RankCard({ x, title, name: who }) {
  const { t, user } = useApp();
  const s = t.xp;
  const name = (n) => s.names[n - 1];
  const next = x.next_xp != null;
  const pct = next ? (100 * (x.xp - x.rank_xp)) / (x.next_xp - x.rank_xp) : 100;
  const r = x.rules;
  const ways = [s.ways.task(r.task), s.ways.plan_step(r.plan_step), s.ways.plan_day(r.plan_day),
    s.ways.attendance(r.attendance, r.streak_max), s.ways.mastered(r.mastered)];
  return (
    <div className="card rank-card">
      <p className="card-title" style={{ marginBottom: 14 }}>{title || s.title}</p>
      <div className="row" style={{ gap: 16, marginBottom: 14 }}>
        <RankAvatar name={who || user.name} rank={x.rank} size={56} />
        <div className="grow">
          <div className="muted small">{s.rank(x.rank)}</div>
          <div className="t-strong" style={{ fontSize: 18 }}>{name(x.rank)}</div>
          <div className="small"><b>{x.xp}</b> {s.unit}{x.week ? <span className="muted"> · {s.week(x.week)}</span> : null}</div>
        </div>
      </div>
      <Bar p={pct} />
      <p className="muted small" style={{ margin: "8px 0 0" }}>{next ? s.toNext(x.next_xp - x.xp, name(x.rank + 1)) : s.max}</p>
      {!title && (
        <>
          <details className="rank-more">
            <summary className="small t-strong">{s.how}</summary>
            {ways.map(([v, txt]) => (
              <div key={txt} className="row small" style={{ gap: 10, marginTop: 8 }}>
                <span className="rank-xp">{v}</span><span>{txt}</span>
              </div>
            ))}
          </details>
          <details className="rank-more">
            <summary className="small t-strong">{s.ladder}</summary>
            <div className="rank-ladder">
              {x.ranks.map((need, i) => (
                <div key={i} className={`rank-step${i + 1 > x.rank ? " locked" : ""}${i + 1 === x.rank ? " current" : ""}`}>
                  <RankAvatar name={String(i + 1)} rank={i + 1} size={34} />
                  <div className="small t-strong">{name(i + 1)}</div>
                  <div className="muted small">{need} XP</div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

// Поздравление, когда ранг вырос. Последний увиденный ранг хранится в браузере; при первом заходе
// просто запоминаем текущий, без поздравления.
export function RankUp({ x }) {
  const { t, user } = useApp();
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!x) return;
    const key = `dl-rank-${user.id}`;
    let seen = null;
    try { seen = Number(localStorage.getItem(key)) || null; } catch { /* */ }
    if (seen && x.rank > seen) setShown(x.rank);
    try { if (!seen || x.rank > seen) localStorage.setItem(key, String(x.rank)); } catch { /* */ }
  }, [x, user.id]);
  if (!shown) return null;
  const name = t.xp.names[shown - 1];
  return (
    <div className="dev-modal rank-up" role="dialog" aria-modal="true" onClick={() => setShown(null)}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <div className="rank-up-ava"><RankAvatar name={user.name} rank={shown} size={88} /></div>
        <h2 style={{ margin: "0 0 6px" }}>{t.xp.up}</h2>
        <p className="muted" style={{ margin: "0 0 18px" }}>{t.xp.upText(name)}</p>
        <button type="button" className="btn" onClick={() => setShown(null)}>{t.xp.upOk}</button>
      </div>
    </div>
  );
}
