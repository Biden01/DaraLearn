import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, Loading, useApp } from "../ui.jsx";

export default function Metrics() {
  const { t } = useApp();
  const [m, setM] = useState(null);
  const [ai, setAi] = useState(null);
  useEffect(() => {
    api("/admin/metrics").then(setM).catch(() => setM(false));
    api("/admin/ai").then(setAi).catch(() => {});
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
      <p className="subtitle">docs/PLAN.md · 8</p>
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
    </>
  );
}
