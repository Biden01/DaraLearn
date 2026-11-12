import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Crumb, Loading, Ring, useApp } from "../ui.jsx";
import StudentMonth from "../staff/StudentMonth.jsx";
import AttendanceCard from "../Attendance.jsx";

// Ата-анаға тек оқу: жоспар, орындалу, расталған дағдылар. Рекомендациялар мен сынып салыстыруы жоқ.
export default function ParentChild() {
  const { t, L, route } = useApp();
  const [d, setD] = useState(null);
  const [att, setAtt] = useState(null);
  useEffect(() => {
    api(`/state/students/${route.param}`).then(setD).catch(() => setD(false));
    api(`/plan/students/${route.param}/attendance`).then(setAtt).catch(() => {});
  }, [route.param]);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;
  const s = t.student;
  const p = t.parent;
  return (
    <>
      <Crumb items={[[p.title, "#/"], [d.student.name]]} />
      <h1>{d.student.name}</h1>
      <p className="subtitle">{t.grade(d.student.grade)}</p>
      <div className="grid g-4" style={{ marginBottom: 20 }}>
        <div className="card row"><Ring p={d.progress.percent} size={64} /><div className="muted small">{t.home.progressText(d.progress.mastered, d.progress.total)}</div></div>
        <div className="card"><div className="muted small">{s.plan}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{d.plan.items ? `${Math.round(d.plan.rate * 100)}%` : "—"}</div></div>
        <div className="card"><div className="muted small">{s.outcomes}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{d.outcomes.total ? `${d.outcomes.helped}/${d.outcomes.total}` : "—"}</div></div>
        <div className="card"><div className="muted small">{t.progress.accuracy}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{d.stats.acc_this_week != null ? `${Math.round(d.stats.acc_this_week * 100)}%` : "—"}</div></div>
      </div>
      <StudentMonth studentId={route.param} />
      <div className="grid g-main">
        <AttendanceCard a={att} />
        <div className="card">
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
      <a href="#/" className="btn ghost" style={{ marginTop: 20 }}>{p.back}</a>
    </>
  );
}
