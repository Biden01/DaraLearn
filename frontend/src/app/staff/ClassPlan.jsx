import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, useApp } from "../ui.jsx";

// Тема класса (учитель задаёт, ученики получают план от неё) и выполнение сегодняшнего плана.
export default function ClassPlan({ classId }) {
  const { t, L, user, toast } = useApp();
  const [d, setD] = useState(null);
  const [courses, setCourses] = useState([]);
  const [pick, setPick] = useState("");
  const tp = t.topic;
  const load = () => api(`/plan/classes/${classId}`).then(setD).catch(() => setD(false));
  useEffect(() => {
    load();
    api("/content/courses?subject=math").then(setCourses).catch(() => {});
  }, [classId]);
  if (!d) return null;

  async function save() {
    if (!pick) return;
    try { await api(`/plan/classes/${classId}/topic`, { method: "PUT", body: { course: pick } }); toast(tp.saved); setPick(""); load(); }
    catch { toast(t.error); }
  }
  const canEdit = user.role === "teacher" || user.role === "admin";
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <p className="card-title" style={{ marginBottom: 6 }}>{tp.title}</p>
      <p className={d.topic ? "t-strong" : "muted small"} style={{ margin: "0 0 12px" }}>{d.topic ? L(d.topic.title) : tp.none}</p>
      {canEdit && (
        <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={tp.set}>
            <option value="">—</option>
            {courses.map((c) => <option key={c.slug} value={c.slug}>{L(c.title)}</option>)}
          </select>
          <button className="btn sm" disabled={!pick} onClick={save}>{tp.set}</button>
        </div>
      )}
      <p className="muted small" style={{ margin: "0 0 8px" }}>{tp.planToday} · {t.min(d.minutes)}</p>
      {d.students.map((s) => (
        <div key={s.id} className="row" style={{ gap: 12, padding: "4px 0" }}>
          <a className="small" style={{ width: 180, flex: "none" }} href={`#/student/${s.id}`}>{s.name}</a>
          {s.has_plan ? <div className="grow"><Bar p={s.rate * 100} /></div> : <span className="muted small">{tp.noPlan}</span>}
        </div>
      ))}
    </div>
  );
}
