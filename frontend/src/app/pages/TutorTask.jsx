import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon, Rich, useApp } from "../ui.jsx";

// Шаг 3 занятия: задача без подсказок. Помощь открывается после ошибки: лестница из 4 подсказок и кнопка «позвать учителя».
export default function TutorTask({ session, setSession, onCheck }) {
  const { t, L, toast } = useApp();
  const h = t.hybrid;
  const [task, setTask] = useState(null);
  const [picked, setPicked] = useState(null);
  const [hints, setHints] = useState([]);
  const [busy, setBusy] = useState(false);
  const answered = session.first_attempt_correct !== null && session.first_attempt_correct !== undefined;

  useEffect(() => {
    setTask(null); setPicked(null); setHints([]);
    api(`/tutor/sessions/${session.id}/task`).then((r) => setTask(r.task)).catch(() => {});
  }, [session.id]);

  async function choose(j) {
    if (answered || busy) return;
    setPicked(j); setBusy(true);
    try {
      const r = await api(`/tutor/sessions/${session.id}/attempt`, { method: "POST", body: { choice: j } });
      setSession((s) => ({ ...s, stage: r.next_stage, first_attempt_correct: r.correct }));
    } catch { setPicked(null); toast(t.error); }
    setBusy(false);
  }

  async function hint() {
    setBusy(true);
    try {
      const r = await api(`/tutor/sessions/${session.id}/hint`, { method: "POST" });
      setHints((x) => [...x, r]);
      setSession((s) => ({ ...s, hints_used: r.level, stage: Math.max(s.stage, 4) }));
    } catch (e) { toast(e.code === "no_more_hints" ? h.noMore : t.error); }
    setBusy(false);
  }

  async function callTeacher() {
    try { await api(`/tutor/sessions/${session.id}/call-teacher`, { method: "POST", body: {} }); setSession((s) => ({ ...s, escalated: true })); toast(h.called); }
    catch { toast(t.error); }
  }

  if (!task) return null;
  const wrong = answered && !session.first_attempt_correct;
  return (
    <div className="tutor-check" style={{ borderBottom: "1px solid var(--line)" }}>
      <p className="card-title" style={{ marginBottom: 6 }}><Icon n="target" s={16} /> 3. {h.first}</p>
      {!answered && <p className="muted small" style={{ margin: "0 0 10px" }}>{h.firstHint}</p>}
      <div className="task">
        <div className="q">{L(task.question)}</div>
        <div className="opts">
          {task.options.map((o, j) => (
            <button key={j} disabled={answered || busy} className={picked === j ? (answered ? (session.first_attempt_correct ? "right" : "wrong") : "right") : ""}
              onClick={() => choose(j)}>{L(o)}</button>
          ))}
        </div>
      </div>
      {answered && session.first_attempt_correct && (
        <div className="row between wrap"><b className="st-mastered">{h.right}</b><button className="btn sm" onClick={onCheck}>{h.toCheck}</button></div>
      )}
      {wrong && (
        <>
          <p className="note" style={{ margin: "0 0 10px" }}>{h.wrong}</p>
          {hints.map((x) => (
            <div key={x.level} className="feedback" style={{ marginBottom: 8 }}><b>{x.level}. {h.hintLevel[x.level - 1]}:</b> <Rich text={x.hint} />
              {x.check_required && <p className="muted small" style={{ margin: "6px 0 0" }}>{h.lastHint}</p>}</div>
          ))}
          <div className="row wrap" style={{ gap: 8 }}>
            {session.hints_used < 4 && <button className="btn sm ghost" disabled={busy} onClick={hint}>{h.hintBtn(session.hints_used)}</button>}
            <button className="btn sm ghost" disabled={session.escalated} onClick={callTeacher}>{session.escalated ? h.called : h.callTeacher}</button>
          </div>
        </>
      )}
    </div>
  );
}
