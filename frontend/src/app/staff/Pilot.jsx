import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, Loading, fox, useApp } from "../ui.jsx";

const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);

function ArmCard({ title, data, targets, p }) {
  return (
    <div className="card">
      <p className="card-title" style={{ marginBottom: 10 }}>{title} · {data.students} {p.students}</p>
      <div className="row between small" style={{ padding: "4px 0" }}><span>{p.verifiedGain}</span><b>{pct(data.verified_gain)}</b></div>
      <div className="row between small" style={{ padding: "4px 0" }}>
        <span>{p.planCompletion}</span><b>{pct(data.plan_completion)} <span className="muted">/ {pct(targets.plan_completion)}</span></b>
      </div>
      <div className="row between small" style={{ padding: "4px 0" }}>
        <span>{p.recUseful}</span><b>{pct(data.recommendation_useful)} <span className="muted">/ {pct(targets.recommendation_useful)}</span></b>
      </div>
      <div className="row between small" style={{ padding: "4px 0" }}><span>{fox(p.tutorSessions)}</span><b>{data.tutor_sessions_per_student_week ?? "—"}</b></div>
      <div className="row between small" style={{ padding: "4px 0" }}>
        <span>{p.intervention}</span>
        <b>{data.intervention.total ? p.interventionText(data.intervention.helped, data.intervention.total) : p.noOutcomes}</b>
      </div>
    </div>
  );
}

export default function Pilot() {
  const { t } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api("/analytics/pilot").then(setD).catch(() => setD(false)); }, []);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;
  const p = t.pilot;
  const ns = d.north_star;
  return (
    <>
      <Crumb items={[[p.title]]} />
      <h1>{p.title}</h1>
      <p className="subtitle">{p.sub}</p>
      <div className="card row" style={{ marginBottom: 20 }}>
        <Box icon="target" c={ns == null ? "" : ns > 0 ? "green" : "orange"} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{ns == null ? "—" : `${ns > 0 ? "+" : ""}${Math.round(ns * 100)}%`}</div>
          <div className="muted small">{p.northStar}</div>
          <div className="muted small">{p.northStarHelp}</div>
        </div>
      </div>
      <div className="grid g-2">
        <ArmCard title={p.treatment} data={d.treatment} targets={d.targets} p={p} />
        <ArmCard title={p.control} data={d.control} targets={d.targets} p={p} />
      </div>
    </>
  );
}
