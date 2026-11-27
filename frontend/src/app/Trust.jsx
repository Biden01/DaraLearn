import { useEffect, useRef, useState } from "react";
import { useApp } from "./ui.jsx";

// Честность проверки: браузер замечает, что ученик ушёл со страницы теста (другая вкладка, окно, приложение).
// Ничего не запрещает — сервер ставит отметку «away» и снижает доверие к результату (backend: verification/integrity.py).
export function useAwayTracker(active) {
  const st = useRef({ count: 0, seconds: 0, since: null });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const leave = () => {
      if (st.current.since !== null) return;
      st.current.since = Date.now();
      st.current.count += 1;
      setCount(st.current.count);
    };
    const back = () => {
      if (st.current.since === null) return;
      st.current.seconds += (Date.now() - st.current.since) / 1000;
      st.current.since = null;
    };
    const onVis = () => (document.hidden ? leave() : back());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
    };
  }, [active]);
  const signals = () => {
    const open = st.current.since !== null ? (Date.now() - st.current.since) / 1000 : 0;
    return { away_count: st.current.count, away_seconds: Math.round(st.current.seconds + open) };
  };
  return { count, signals };
}

// Предупреждение на экране проверки.
export function AwayNote({ count }) {
  const { t } = useApp();
  return <p className={`away-note ${count ? "warn" : ""}`} role={count ? "alert" : undefined}>{count ? t.trust.wasAway : t.trust.stayHere}</p>;
}

export function TrustBadge({ trust }) {
  const { t } = useApp();
  if (!trust) return null;
  return <span className={`trust-badge tr-${trust.level}`}>{t.trust.level[trust.level]}</span>;
}

// Причины одной строкой: «Совпадает с ПҚС / БЖБ · Уходил с вкладки во время теста».
export function TrustReasons({ trust, compact }) {
  const { t } = useApp();
  if (!trust?.reasons?.length) return null;
  const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const nums = !compact && trust.site != null && trust.external != null
    ? ` (${t.trust.site} ${pct(trust.site)}, ${t.trust.external} ${pct(trust.external)})` : "";
  return <span className="trust-why">{trust.reasons.map((r) => t.trust.reasons[r] || r).join(" · ")}{nums}</span>;
}

// Итог по ученику: уровень и сколько навыков на каждом уровне.
export function TrustSummary({ trust, help }) {
  const { t } = useApp();
  if (!trust) return null;
  const c = trust.counts || {};
  return (
    <div className="card trust-card">
      <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
        <p className="card-title" style={{ margin: 0 }}>{t.trust.title}</p>
        <TrustBadge trust={trust} />
      </div>
      <div className="trust-counts">
        {["high", "medium", "low"].map((k) => (
          <span key={k} className={`tr-${k}`}><b>{c[k] || 0}</b> {t.trust.level[k]}</span>
        ))}
      </div>
      <p className="muted small" style={{ margin: "10px 0 0" }}>{help}</p>
    </div>
  );
}
