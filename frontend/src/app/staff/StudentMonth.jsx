import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, useApp } from "../ui.jsx";
import { TOPIC_DOT, dayLabel, monthName } from "../pages/Plan.jsx";

// Цель месяца ученика по неделям: какие темы на какой неделе, с чего начинал и где сейчас. Только для учителя и куратора.
export default function StudentMonth({ studentId }) {
  const { t, L, lang } = useApp();
  const [g, setG] = useState(undefined);
  useEffect(() => { api(`/plan/students/${studentId}/month`).then((r) => setG(r.goal)).catch(() => setG(undefined)); }, [studentId]);
  if (g === undefined) return null;
  const m = t.month;
  if (g === null) return <div className="card" style={{ marginBottom: 20 }}><p className="card-title" style={{ marginBottom: 6 }}>{m.title}</p><p className="muted small" style={{ margin: 0 }}>{m.none}</p></div>;

  const byLesson = Object.fromEntries(g.topics.map((x) => [x.lesson, x]));
  // дни, на которые поставлена тема: «2–5 нояб.»
  const span = (slug) => {
    const ds = g.days.filter((d) => d.topics.includes(slug)).map((d) => d.day);
    if (!ds.length) return "";
    const last = dayLabel(ds[ds.length - 1], lang, { day: "numeric", month: "short" });
    return ds.length === 1 ? last : `${dayLabel(ds[0], lang, { day: "numeric" })}–${last}`;
  };
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="row between wrap" style={{ gap: 8, marginBottom: 4 }}>
        <p className="card-title" style={{ margin: 0 }}>{t.plan.goal(monthName(g.month, lang))}</p>
        <span className="t-strong small">{t.plan.goalDone(g.done, g.total)}</span>
      </div>
      <p className="muted small" style={{ margin: "0 0 14px" }}>{m.onlyStaff}</p>
      <div className="grid g-4">
        {g.weeks.map((w) => (
          <div key={w.week} className="card soft" style={w.week === g.current_week ? { borderColor: "var(--accent)" } : undefined}>
            <div className="row between small" style={{ marginBottom: 8 }}>
              <b>{m.week(w.week)}</b>
              {w.week === g.current_week && <span className="badge orange">{m.current}</span>}
            </div>
            {w.topics.length === 0 && <p className="muted small" style={{ margin: "0 0 8px" }}>{m.noTopics}</p>}
            {w.topics.map((slug) => {
              const x = byLesson[slug];
              return (
                <div key={slug} style={{ marginBottom: 10 }}>
                  <div className="row small" style={{ gap: 8 }}><span className={`dot ${TOPIC_DOT[x.status]}`} /><span style={{ fontWeight: 600 }}>{L(x.title)}</span>
                    {span(slug) && <span className="muted small" style={{ marginLeft: "auto" }}>{span(slug)}</span>}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {m.start}: <span className={`st-${x.start_status}`}>{t.status[x.start_status]}</span> · {m.now}: {Math.round(x.proof * 100)}%
                  </div>
                </div>
              );
            })}
            {w.rate != null && (
              <div style={{ marginTop: 6 }}>
                <div className="row between muted small" style={{ marginBottom: 4 }}><span>{m.rate} · {m.days(w.days)}</span><b>{Math.round(w.rate * 100)}%</b></div>
                <Bar p={w.rate * 100} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
