import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Crumb, Loading, Ring, useApp } from "../ui.jsx";
import RecItem from "./RecItem.jsx";
import StudentMonth from "./StudentMonth.jsx";

export default function StudentCard() {
  const { t, L, route } = useApp();
  const [d, setD] = useState(null);
  const [feed, setFeed] = useState([]);
  const load = () => {
    api(`/state/students/${route.param}`).then(setD).catch(() => setD(false));
    api("/decisions/feed?include_closed=true").then((f) => setFeed(f.items.filter((x) => String(x.user_id) === route.param))).catch(() => {});
  };
  useEffect(load, [route.param]);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;
  const s = t.student;
  return (
    <>
      <Crumb items={[[t.classes.title, "#/"], [d.student.name]]} />
      <h1>{d.student.name}</h1>
      <p className="subtitle">{t.grade(d.student.grade)} · {d.student.login || d.student.email}</p>
      <div className="grid g-4" style={{ marginBottom: 20 }}>
        <div className="card row"><Ring p={d.progress.percent} size={64} /><div className="muted small">{t.home.progressText(d.progress.mastered, d.progress.total)}</div></div>
        <div className="card"><div className="muted small">{s.plan}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{d.plan.items ? `${Math.round(d.plan.rate * 100)}%` : "—"}</div></div>
        <div className="card"><div className="muted small">{s.outcomes}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{d.outcomes.total ? `${d.outcomes.helped}/${d.outcomes.total}` : "—"}</div></div>
        <div className="card"><div className="muted small">{t.progress.accuracy}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{d.stats.acc_this_week != null ? `${Math.round(d.stats.acc_this_week * 100)}%` : "—"}</div></div>
      </div>
      <StudentMonth studentId={route.param} />
      <div className="grid g-main">
        <div className="card">
          <p className="card-title" style={{ marginBottom: 6 }}>{s.recs}</p>
          {feed.length ? feed.map((r) => <RecItem key={r.id} r={r} onChange={load} showStudent={false} />) : <p className="muted small">{t.rec.empty}</p>}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <p className="card-title" style={{ marginBottom: 6 }}>{s.skills}</p>
          {d.lessons.map((l) => (
            <div className="list-item" key={l.slug}>
              <span className={`dot ${l.status}`} />
              <div className="grow"><div className="row between"><span className="small" style={{ fontWeight: 600 }}>{L(l.title)}</span><span className={`small st-${l.status}`}>{t.status[l.status]}</span></div>
                <div style={{ marginTop: 5 }}><Bar p={l.proof * 100} /></div></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
