import { forwardRef, useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon, Rich, useApp } from "../ui.jsx";

// Шаг 3 занятия: задача без подсказок — карточка от Dara прямо в ленте чата.
// Помощь открывается после ошибки: лестница из 4 подсказок и кнопка «позвать учителя».
const TutorTask = forwardRef(function TutorTask({ session, setSession, onCheck, onTask }, ref) {
  const { t, L, toast } = useApp();
  const h = t.hybrid;
  const [task, setTask] = useState(null);
  const [picked, setPicked] = useState(null);
  const [hints, setHints] = useState([]);
  const [busy, setBusy] = useState(false);
  const answered = session.first_attempt_correct !== null && session.first_attempt_correct !== undefined;

  useEffect(() => {
    setTask(null); setPicked(null); setHints([]); onTask?.(null);
    api(`/tutor/sessions/${session.id}/task`).then((r) => { setTask(r.task); onTask?.(r.task); }).catch(() => {});
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
  const ok = answered && session.first_attempt_correct;
  const wrong = answered && !session.first_attempt_correct;
  return (
    <div className="msg bot task-msg" ref={ref}>
      <div className="avatar bot-ava"><Icon n="bot" s={18} /></div>
      <div className="task-card">
        <div className="task-card-head">
          <Icon n="target" s={16} /><b>{h.first}</b>
          {answered && <span className={`badge ${ok ? "green" : "red"}`}>{ok ? h.rightShort : h.wrongShort}</span>}
        </div>
        {!answered && <p className="muted small" style={{ margin: "0 0 10px" }}>{h.firstHint}</p>}
        <div className="q">{L(task.question)}</div>
        <div className="opts">
          {task.options.map((o, j) => (
            <button key={j} disabled={answered || busy}
              className={picked === j ? (answered ? (ok ? "right" : "wrong") : "picked") : ""}
              onClick={() => choose(j)}>
              <span className="opt-letter">{"ABCDEF"[j]}</span>{L(o)}
            </button>
          ))}
        </div>
        {ok && (
          <div className="task-card-foot"><b className="st-mastered">{h.right}</b><button className="btn sm" onClick={onCheck}>{h.toCheck}</button></div>
        )}
        {wrong && (
          <>
            <p className="task-card-note">{h.wrong}</p>
            {hints.map((x) => (
              <div key={x.level} className="hint"><b><Icon n="bulb" s={14} /> {x.level}. {h.hintLevel[x.level - 1]}</b><Rich text={x.hint} />
                {x.check_required && <p className="muted small" style={{ margin: "6px 0 0" }}>{h.lastHint}</p>}</div>
            ))}
            <div className="task-card-foot">
              {session.hints_used < 4 && <button className="btn sm" disabled={busy} onClick={hint}><Icon n="bulb" s={14} /> {h.hintBtn(session.hints_used)}</button>}
              <button className="btn sm ghost" disabled={session.escalated} onClick={callTeacher}>
                <Icon n={session.escalated ? "check" : "bell"} s={14} /> {session.escalated ? h.called : h.callTeacher}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default TutorTask;
