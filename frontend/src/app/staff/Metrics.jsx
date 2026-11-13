import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Loading, fox, useApp } from "../ui.jsx";

export default function Metrics() {
  const { t } = useApp();
  const [m, setM] = useState(null);
  const [ai, setAi] = useState(null);
  const [fb, setFb] = useState(null);
  useEffect(() => {
    api("/admin/metrics").then(setM).catch(() => setM(false));
    api("/admin/ai").then(setAi).catch(() => {});
    api("/analytics/feedback").then(setFb).catch(() => {});
  }, []);
  if (m === null) return <Loading />;
  if (m === false) return <p className="muted">{t.error}</p>;
  const a = t.admin;
  const ip = m.independent_progress;
  const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);
  const max = Math.max(...m.activity.map((d) => d.events), 1);
  const cards = [
    ["target", "green", ip.total ? `${ip.helped}/${ip.total}` : "—", a.progress, ip.total ? a.progressText(ip.helped, ip.total) : ""],
    ["check", "", pct(m.recommendations.accepted_share), a.accepted, ""],
    ["clip", "purple", pct(m.recommendations.done_share), a.done, ""],
    ["user", "orange", m.active_students_7d, a.active, ""],
  ];
  return (
    <>
      <Crumb items={[[a.metricsTitle]]} />
      <h1>{a.metricsTitle}</h1>
      <p className="subtitle">docs/PLAN.md · 7</p>
      <div className="grid g-4" style={{ marginBottom: 20 }}>
        {cards.map(([icon, c, v, l, sub]) => (
          <div className="card row" key={l}><Box icon={icon} c={c} /><div><div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="muted small">{l}</div>{sub && <div className="muted small">{sub}</div>}</div></div>
        ))}
      </div>
      <div className="grid g-main" style={{ marginBottom: 20 }}>
        <div className="card">
          <p className="card-title" style={{ marginBottom: 6 }}>{a.activity}</p>
          <div className="chart">{m.activity.map((d) => <div className="col" key={d.day}><span className="v">{d.events || ""}</span><i style={{ height: `${Math.max((d.events / max) * 150, 3)}px` }} /></div>)}</div>
          <div className="chart-labels">{m.activity.map((d) => <span key={d.day}>{d.day.slice(8)}</span>)}</div>
        </div>
        <div className="stack">
          <div className="card">
            <p className="card-title" style={{ marginBottom: 10 }}>{a.users}</p>
            {Object.entries(m.users).map(([r, n]) => <div className="row between small" key={r} style={{ padding: "4px 0" }}><span>{t.roles[r] || r}</span><b>{n}</b></div>)}
            <div className="row between small" style={{ padding: "4px 0" }}><span>{a.schools}</span><b>{m.schools}</b></div>
            <div className="row between small" style={{ padding: "4px 0" }}><span>{t.snav.classes}</span><b>{m.classes}</b></div>
          </div>
          <div className="card">
            <p className="card-title" style={{ marginBottom: 10 }}>{a.ai}</p>
            {ai ? (<>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{a.cost(ai.cost_usd)}</div>
              {ai.models.map((x) => <div className="muted small" key={x.model}>{x.model}: {x.replies} {a.replies}, {x.input_tokens + x.output_tokens} {a.tokens}</div>)}
            </>) : "—"}
          </div>
        </div>
      </div>
      <div className="grid g-3">
        <div className="card"><p className="card-title" style={{ marginBottom: 8 }}>{a.checks}</p>
          {Object.entries(m.checks).map(([k, v]) => <div className="row between small" key={k}><span>{k}</span><b>{v}</b></div>)}{!Object.keys(m.checks).length && "—"}</div>
        <div className="card"><p className="card-title" style={{ marginBottom: 8 }}>{t.snav.feed}</p>
          {Object.entries(m.recommendations.by_status).map(([k, v]) => <div className="row between small" key={k}><span>{t.rec[k] || k}</span><b>{v}</b></div>)}</div>
        <div className="card"><p className="card-title" style={{ marginBottom: 8 }}>{a.events}</p>
          {Object.entries(m.events).map(([k, v]) => <div className="row between small" key={k}><span>{k}</span><b>{v}</b></div>)}
          <div className="row between small"><span>{a.adviser}</span><b>{m.adviser_open}</b></div></div>
      </div>
      {fb && <Feedback fb={fb} />}
    </>
  );
}

// Нагрузка учителя до/после и опрос удобства (GET /analytics/feedback).
function Feedback({ fb }) {
  const { t } = useApp();
  const f = t.fb;
  const w = fb.workload;
  const sv = fb.survey;
  const min = (x) => (x == null ? "—" : `${Math.round(x)} ${f.min}`);
  const pct = (x) => (x == null ? "—" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);
  const score = (x) => (x == null ? "—" : x.toFixed(1));
  const p = w.paired;
  return (
    <div className="grid g-2" style={{ marginTop: 20 }}>
      <div className="card">
        <p className="card-title">{f.workload}</p>
        <p className="muted small" style={{ margin: "4px 0 14px" }}>{f.workloadSub}</p>
        {w.teachers_logged ? (<>
          <div className="row wrap" style={{ gap: 24, marginBottom: 6 }}>
            {[["before", f.before], ["after", f.after]].map(([k, l]) => (
              <div key={k}><div className="muted small">{l}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{min(p[k].total)}</div>
                <div className="muted small">{f.check} {min(p[k].check)} · {f.review} {min(p[k].review)}</div></div>
            ))}
            <div><div className="muted small">{f.change}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }} className={p.change < 0 ? "st-mastered" : p.change > 0 ? "st-gap" : ""}>{pct(p.change)}</div></div>
          </div>
          <p className="muted small">{f.paired(p.teachers, w.teachers_logged)} · {f.signal}</p>
          {["treatment", "control"].map((arm) => w.by_arm[arm].teachers > 0 && (
            <div className="row between small" key={arm} style={{ padding: "4px 0" }}>
              <span>{f.arm[arm]}</span><span>{min(w.by_arm[arm].before.total)} → {min(w.by_arm[arm].after.total)} <b>{pct(w.by_arm[arm].change)}</b></span>
            </div>
          ))}
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="small" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr className="muted" style={{ textAlign: "left" }}><th>{f.teacher}</th><th>{f.group}</th><th>{f.before}</th><th>{f.after}</th></tr></thead>
              <tbody>{w.teachers.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 6px 6px 0" }}>{r.name}</td><td>{f.arm[r.arm] ?? r.arm}</td>
                  <td>{min(r.before.total)} <span className="muted">({r.before.weeks} {f.weeks})</span></td>
                  <td>{min(r.after.total)} <span className="muted">({r.after.weeks} {f.weeks})</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>) : <p className="muted">{f.noTime}</p>}
      </div>
      <div className="card">
        <p className="card-title">{f.survey}</p>
        <p className="muted small" style={{ margin: "4px 0 14px" }}>{f.surveySub(sv.survey)}</p>
        {Object.entries(sv.roles).map(([role, r]) => (
          <div key={role} style={{ marginBottom: 16 }}>
            <div className="row between"><b>{f.roles[role]}</b>
              <span className="muted small">{f.responses(r.responses)} · {f.overall}: <b>{score(r.overall)}</b>
                {["treatment", "control"].map((arm) => r.by_arm[arm].responses > 0 && ` · ${f.arm[arm]} ${score(r.by_arm[arm].overall)}`)}</span></div>
            {r.responses ? sv.questions[role].map((q) => (
              <div key={q} style={{ marginTop: 8 }}>
                <div className="row between small"><span>{fox(t.survey.q[role]?.[q] || q)}</span><b>{score(r.questions[q])}</b></div>
                <Bar p={((r.questions[q] || 0) / 5) * 100} />
              </div>
            )) : <p className="muted small">{f.noSurvey}</p>}
          </div>
        ))}
        <p className="card-title" style={{ marginTop: 8 }}>{f.comments}</p>
        {sv.comments.length ? sv.comments.map((c, i) => (
          <div key={i} className="small" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
            <div className="muted">{f.roles[c.role]}{c.arm ? ` · ${f.arm[c.arm] ?? c.arm}` : ""} · {new Date(c.at).toLocaleDateString("ru-RU")}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{c.text}</div>
          </div>
        )) : <p className="muted small">{f.noComments}</p>}
      </div>
    </div>
  );
}
