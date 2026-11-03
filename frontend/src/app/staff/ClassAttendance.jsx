import { useEffect, useState } from "react";
import { api } from "../api.js";
import { AttLegend, AttStrip } from "../Attendance.jsx";
import { useApp } from "../ui.jsx";

// Посещаемость класса за 2 недели: строка на ученика, сначала те, кто сегодня ещё не занимался.
export default function ClassAttendance({ classId }) {
  const { t } = useApp();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api(`/plan/classes/${classId}/attendance`).then((d) => setRows(d.students)).catch(() => setRows([]));
  }, [classId]);
  if (!rows?.length) return null;
  const at = t.att;
  const sorted = [...rows].sort((a, b) => a.today - b.today || (a.rate ?? 0) - (b.rate ?? 0));
  const present = rows.filter((r) => r.today).length;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head"><p className="card-title">{at.table}</p><span className="muted small">{at.classToday(present, rows.length)}</span></div>
      {sorted.map((s) => (
        <div key={s.id} className="att-row">
          <a className="small att-name" href={`#/student/${s.id}`}>{s.name}</a>
          <AttStrip days={s.days} />
          <span className="muted small att-rate">{s.rate == null ? "—" : `${Math.round(s.rate * 100)}%`}</span>
        </div>
      ))}
      <AttLegend />
    </div>
  );
}
