import { useState } from "react";
import { api } from "../api.js";
import { Bar, useApp } from "../ui.jsx";

const BADGE = { new: "", accepted: "green", changed: "orange", rejected: "gray", done: "green", obsolete: "gray" };
const ACTIONS = ["lesson", "tutor", "practice", "prereq", "verify", "teacher", "group"];

// Рекомендация в ленте учителя: принять / изменить / отклонить / выполнено.
export default function RecItem({ r, onChange, showStudent = true, covered = 0 }) {
  const { t, L, toast } = useApp();
  const [mode, setMode] = useState(null);
  const [comment, setComment] = useState(r.comment || "");
  const [action, setAction] = useState(r.action);
  const [busy, setBusy] = useState(false);
  async function save(status) {
    setBusy(true);
    try {
      const x = await api(`/decisions/${r.id}`, { method: "PATCH", body: { status, comment, action: status === "changed" ? action : null } });
      onChange?.(x);
      setMode(null);
      toast(t.rec[status]);
    } catch { toast(t.error); } finally { setBusy(false); }
  }
  const title = r.action === "group" ? `${t.rec.group}: ${L(r.title)}` : L(r.title);
  return (
    <div className="list-item wrap" style={{ alignItems: "flex-start" }}>
      <div className="grow" style={{ minWidth: 220 }}>
        {showStudent && (r.student
          ? <a href={`#/student/${r.student.id}`} className="t-strong">{r.student.name} <span className="muted small">· {r.student.class}</span></a>
          : <span className="t-strong">{r.class_name} <span className="muted small">· {t.rec.groupText(r.comment)}</span></span>)}
        <div className={showStudent ? "small" : "t-strong"} style={{ marginTop: 2 }}>{title}</div>
        <div className="muted small">{t.actions[r.action]?.[0] || r.action} · {t.causes[r.cause]}
          {r.target_title ? ` → ${L(r.target_title)}` : ""}</div>
        {r.action !== "group" && <div style={{ maxWidth: 220, marginTop: 6 }}><Bar p={r.proof * 100} /></div>}
        {r.comment && r.action !== "group" && <div className="small" style={{ marginTop: 6 }}><b>{t.rec.teacherNote}</b> {r.comment}</div>}
        {covered > 0 && <div className="small muted" style={{ marginTop: 4 }}>{t.rec.covered(covered)}</div>}
        {mode && (
          <div className="stack" style={{ gap: 8, marginTop: 10, maxWidth: 420 }}>
            {mode === "changed" && (
              <label className="field">{t.rec.newAction}
                <select value={action} onChange={(e) => setAction(e.target.value)}>
                  {ACTIONS.map((a) => <option key={a} value={a}>{t.actions[a]?.[0] || t.rec.group}</option>)}
                </select>
              </label>
            )}
            <label className="field">{t.rec.comment}<input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} /></label>
            <div className="row"><button className="btn sm" disabled={busy} onClick={() => save(mode)}>{t.rec.save}</button>
              <button className="btn sm ghost" onClick={() => setMode(null)}>{t.cancel}</button></div>
          </div>
        )}
      </div>
      <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
        <span className={`badge ${BADGE[r.status]}`}>{t.rec[r.status]}</span>
        {r.needs_teacher && r.status === "new" && <span className="badge orange">{t.rec.needsTeacher}</span>}
        {!mode && ["new", "accepted", "changed"].includes(r.status) && (
          <div className="row wrap" style={{ gap: 6, justifyContent: "flex-end" }}>
            {r.status === "new" && <button className="btn sm" disabled={busy} onClick={() => save("accepted")}>{t.rec.accept}</button>}
            <button className="btn sm ghost" onClick={() => setMode("changed")}>{t.rec.change}</button>
            {r.status === "new" && <button className="btn sm ghost" onClick={() => setMode("rejected")}>{t.rec.reject}</button>}
            {r.status !== "new" && <button className="btn sm ghost" disabled={busy} onClick={() => save("done")}>{t.rec.markDone}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
