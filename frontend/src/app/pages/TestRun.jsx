import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Bar, Icon, Loading, useApp } from "../ui.jsx";

const SKIP = -1; // «Не знаю»: вопрос пройден, но ответа нет — это не ошибка, а отсутствие данных

export default function TestRun({ id }) {
  const { t, L, toast } = useApp();
  const [a, setA] = useState(null);
  const [i, setI] = useState(0);
  const [ans, setAns] = useState({});
  const [left, setLeft] = useState(null);
  const [sending, setSending] = useState(false);
  const sent = useRef(false);
  const q = t.quiz;

  useEffect(() => {
    api(`/verification/attempts/${id}`).then((x) => {
      if (x.finished) { window.location.hash = `#/result/${x.id}`; return; }
      setA(x);
      const spent = Math.floor((Date.now() - new Date(x.started_at).getTime()) / 1000);
      setLeft(Math.max(0, x.time_limit - spent));
    }).catch(() => { window.location.hash = "#/quiz"; });
  }, [id]);

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) { submit(true); return; }
    const tm = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(tm);
  }, [left]);

  useEffect(() => {
    if (!a) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const n = Number(e.key);
      if (n >= 1 && n <= a.tasks[i].options.length) choose(n - 1);
      if (e.key === "Enter") next();
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!a) return <Loading />;
  const task = a.tasks[i];
  const last = i === a.tasks.length - 1;

  function choose(j) { setAns((s) => ({ ...s, [task.id]: j })); }
  function next() { if (last) submit(false); else setI(i + 1); }

  async function submit(timeout) {
    if (sent.current) return;
    const unanswered = a.tasks.filter((x) => ans[x.id] === undefined).length;
    if (!timeout && unanswered && !window.confirm(q.unanswered(unanswered))) return;
    sent.current = true;
    setSending(true);
    const answers = Object.fromEntries(Object.entries(ans).filter(([, v]) => v !== SKIP));
    try {
      await api(`/verification/attempts/${a.id}/submit`, { method: "POST", body: { answers } });
      window.location.hash = `#/result/${a.id}`;
    } catch (e) {
      if (e.status === 409) { window.location.hash = `#/result/${a.id}`; return; }
      sent.current = false;
      setSending(false);
      toast(t.error);
    }
  }

  const title = a.lesson ? L(a.lesson.title) : a.course ? L(a.course.title) : L(a.subject.title);
  const mm = Math.floor((left ?? 0) / 60), ss = String((left ?? 0) % 60).padStart(2, "0");
  return (
    <div className="focus">
      <div className="focus-top">
        <button className="close" aria-label={t.back} onClick={() => { if (window.confirm(q.confirmExit)) window.location.hash = "#/quiz"; }}><Icon n="x" /></button>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row between small" style={{ marginBottom: 6 }}>
            <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.diag.kind[a.kind]} · {title}</span>
            <span className="muted">{q.q(i + 1, a.tasks.length)}</span>
          </div>
          <Bar p={(100 * (i + 1)) / a.tasks.length} />
        </div>
        <span className={`timer ${left < 60 ? "low" : ""}`} aria-label={q.left}><Icon n="clock" s={18} />{mm}:{ss}</span>
      </div>
      <div className="focus-body">
        <div className="question">{L(task.question)}</div>
        {task.options.map((o, j) => (
          <button key={j} className={`option ${ans[task.id] === j ? "sel" : ""}`} onClick={() => choose(j)} aria-pressed={ans[task.id] === j}>
            <span className="l">{"ABCD"[j]}</span>{L(o)}<span className="k">{j + 1}</span>
          </button>
        ))}
        <button className={`option ${ans[task.id] === SKIP ? "sel" : ""}`} style={{ justifyContent: "center", color: "var(--muted)" }} onClick={() => { choose(SKIP); if (!last) setI(i + 1); }}>{q.dontKnow}</button>
        <p className="muted small" style={{ textAlign: "center", marginTop: 18 }}><Icon n="lock" s={14} /> {q.noAi}</p>
      </div>
      <div className="focus-foot">
        <div className="focus-foot-in">
          <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}><Icon n="left" s={16} /> {q.prev}</button>
          <div className="qnums inline" aria-label="nav">
            {a.tasks.map((x, k) => (
              <button key={x.id} className={k === i ? "cur" : ans[x.id] !== undefined ? "done" : ""} onClick={() => setI(k)} aria-label={String(k + 1)}>{k + 1}</button>
            ))}
          </div>
          <button className="btn" disabled={sending} onClick={next}>{last ? q.finish : q.next} {!last && <Icon n="arrow" s={16} />}</button>
        </div>
      </div>
    </div>
  );
}
