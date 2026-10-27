import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Icon, Rich, useApp } from "../ui.jsx";
import TutorTask from "./TutorTask.jsx";

const hhmm = (iso) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export default function Tutor() {
  const { t, L, user, route, toast } = useApp();
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const body = useRef();
  const tp = t.tutor;
  const wanted = route.query.get("lesson");
  const wantedRec = route.query.get("rec");
  const [check, setCheck] = useState(null); // этапы 7–9: {tasks, answers, result}

  useEffect(() => {
    api("/tutor/status").then(setStatus).catch(() => {});
    api("/content/courses?subject=math").then((cs) => setLessons(cs.flatMap((c) => c.lessons))).catch(() => {});
    api("/tutor/sessions/current").then((s) => {
      // новая тема из ссылки — новый диалог
      if (!s || s.finished || (wanted && s.lesson?.slug !== wanted)) return newSession(wanted);
      if (s.stage >= 7) api(`/tutor/sessions/${s.id}/check`).then((c) => setCheck({ tasks: c.tasks, answers: {} })).catch(() => {});
      setSession(s);
    }).catch(() => newSession(wanted));
  }, []);

  useEffect(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [session, busy]);

  async function newSession(lesson) {
    setPicking(false);
    setCheck(null);
    const rec = lesson && lesson === wanted && wantedRec ? Number(wantedRec) : null;
    try { setSession(await api("/tutor/sessions", { method: "POST", body: { lesson: lesson || null, recommendation_id: rec } })); } catch { toast(t.error); }
  }

  async function nextStage() {
    try { setSession(await api(`/tutor/sessions/${session.id}/stage`, { method: "POST", body: { stage: Math.min(6, session.stage + 1) } })); }
    catch { toast(t.error); }
  }

  async function startCheck() {
    try {
      const c = await api(`/tutor/sessions/${session.id}/check`);
      setSession((s) => ({ ...s, ...c.session, messages: s.messages }));
      setCheck({ tasks: c.tasks, answers: {} });
    } catch { toast(t.error); }
  }

  async function finishCheck() {
    try {
      const r = await api(`/tutor/sessions/${session.id}/check`, { method: "POST", body: { answers: check.answers } });
      setSession((s) => ({ ...s, ...r.session, messages: s.messages }));
      setCheck((c) => ({ ...c, result: r }));
    } catch { toast(t.error); }
  }

  async function send(msg) {
    const m = msg.trim();
    if (!m || busy || !session) return;
    setText("");
    setBusy(true);
    const tmp = { id: `tmp${Date.now()}`, role: "user", content: m, at: new Date().toISOString() };
    setSession((s) => ({ ...s, messages: [...s.messages, tmp] }));
    try {
      const r = await api(`/tutor/sessions/${session.id}/messages`, { method: "POST", body: { text: m } });
      setSession((s) => ({ ...s, messages: [...s.messages.filter((x) => x.id !== tmp.id), r.user, r.reply] }));
      setStatus((st) => st && { ...st, remaining: r.remaining });
    } catch (e) {
      setSession((s) => ({ ...s, messages: s.messages.filter((x) => x.id !== tmp.id) }));
      setText(m);
      toast(e.status === 429 ? tp.limit : e.status === 503 ? tp.unavailable : t.error);
    } finally {
      setBusy(false);
    }
  }

  const cur = session?.lesson ? lessons.find((l) => l.slug === session.lesson.slug) : null;
  const sg = t.stages;
  const locked = !session || session.stage >= 7 || session.finished;
  return (
    <>
      <Crumb items={[[t.nav.tutor]]} />
      <div className="row" style={{ gap: 10 }}><h1 style={{ margin: 0 }}>Dara AI Tutor</h1><span className="badge">{tp.beta}</span></div>
      <p className="subtitle" style={{ marginTop: 8 }}>{tp.sub}</p>
      <div className="chips">
        {tp.quick.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => send(q)}>{q}</button>)}
      </div>
      <div className="grid g-main">
        <div className="card chat">
          {session?.lesson && !locked && !check && <TutorTask session={session} setSession={setSession} onCheck={startCheck} />}
          <div className="chat-body" ref={body} aria-live="polite">
            <div className="msg bot">
              <div className="avatar" style={{ width: 32, height: 32, background: "var(--accent-soft)", color: "var(--accent)" }}><Icon n="bot" s={18} /></div>
              <div><div className="bubble">{tp.hello}</div></div>
            </div>
            {session?.messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
                {m.role === "user"
                  ? <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{user.name[0].toUpperCase()}</div>
                  : <div className="avatar" style={{ width: 32, height: 32, background: "var(--accent-soft)", color: "var(--accent)" }}><Icon n="bot" s={18} /></div>}
                <div><div className="bubble">{m.role === "user" ? m.content : <Rich text={m.content} />}</div>
                  <div className="time" style={m.role === "user" ? { textAlign: "right" } : undefined}>{hhmm(m.at)}</div></div>
              </div>
            ))}
            {busy && <div className="msg bot"><div className="avatar" style={{ width: 32, height: 32, background: "var(--accent-soft)", color: "var(--accent)" }}><Icon n="bot" s={18} /></div><div className="bubble muted">{tp.thinking}</div></div>}
          </div>
          {check ? (
            <div className="tutor-check">
              <p className="card-title" style={{ marginBottom: 10 }}><Icon n="lock" s={16} /> {sg.checkTitle}</p>
              {check.tasks.map((task, i) => {
                const res = check.result?.results.find((x) => x.task_id === task.id);
                return (
                  <div className="task" key={task.id}>
                    <div className="q">{i + 7}. {L(task.question)}</div>
                    <div className="opts">
                      {task.options.map((o, j) => (
                        <button key={j} disabled={!!check.result}
                          className={res ? (j === res.answer ? "right" : j === res.choice ? "wrong" : "") : check.answers[task.id] === j ? "right" : ""}
                          onClick={() => setCheck((c) => ({ ...c, answers: { ...c.answers, [task.id]: j } }))}>{L(o)}</button>
                      ))}
                    </div>
                    {res && !res.correct && <div className="feedback">{L(res.explanation)}</div>}
                  </div>
                );
              })}
              {check.result ? (
                <div className="row between wrap">
                  <b className={check.result.session.result === "passed" ? "st-mastered" : "st-gap"}>
                    {check.result.session.result === "passed" ? sg.passed : sg.failed}</b>
                  <button className="btn sm" onClick={() => newSession(session.lesson?.slug)}>{sg.newSession}</button>
                </div>
              ) : <button className="btn" disabled={Object.keys(check.answers).length < check.tasks.length} onClick={finishCheck}>{sg.submit}</button>}
            </div>
          ) : (
            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tp.placeholder} maxLength={2000} aria-label={tp.placeholder} disabled={locked} />
              <button className="btn" aria-label={tp.send} disabled={busy || !text.trim() || locked}><Icon n="send" s={18} /></button>
            </form>
          )}
          <div className="row between small muted" style={{ padding: "0 18px 14px" }}>
            <span>{status && !status.enabled ? tp.off : status ? tp.left(status.remaining) : ""}</span>
            <button className="link" onClick={() => newSession(session?.lesson?.slug)}>{tp.newChat}</button>
          </div>
        </div>
        <div className="stack">
          {session?.lesson && (
            <div className="card">
              <p className="card-title" style={{ marginBottom: 12 }}>{sg.title}</p>
              {sg.groups.map((g, gi) => (
                <div key={g} style={{ marginBottom: 10 }}>
                  <div className="muted small" style={{ marginBottom: 6 }}>{g}</div>
                  <div className="stages">
                    {sg.names.slice(gi * 3, gi * 3 + 3).map((n, k) => {
                      const st = gi * 3 + k + 1;
                      return <span key={n} className={st < session.stage || session.finished ? "done" : st === session.stage ? "cur" : ""} title={n}>{st}. {n}</span>;
                    })}
                  </div>
                </div>
              ))}
              {!locked && (
                <div className="row wrap" style={{ marginTop: 8 }}>
                  {session.stage < 6 && (session.first_attempt_correct === false || session.hints_used > 0) &&
                    <button className="btn sm ghost" onClick={nextStage}>{sg.next}</button>}
                  {session.first_attempt_correct !== null && session.first_attempt_correct !== undefined &&
                    <button className="btn sm" onClick={startCheck}>{sg.toCheck}</button>}
                </div>
              )}
            </div>
          )}
          <div className="card">
            <div className="card-head"><p className="card-title">{tp.context}</p><button className="link" onClick={() => setPicking(!picking)}>{tp.change}</button></div>
            <div className="row"><Box sym="√x" /><div><div className="t-strong">{cur ? L(cur.title) : tp.free}</div><div className="muted small">Математика · {t.grade(user.grade)}</div></div></div>
            {picking && (
              <label className="field" style={{ marginTop: 14 }}>{tp.pick}
                <select defaultValue="" onChange={(e) => newSession(e.target.value)}>
                  <option value="" disabled>—</option>
                  <option value="">{tp.free}</option>
                  {lessons.map((l) => <option key={l.slug} value={l.slug}>{L(l.title)}</option>)}
                </select>
              </label>
            )}
          </div>
          {cur && (
            <div className="card">
              <div className="card-head"><p className="card-title">{t.lesson.state}</p><a href={`#/lesson/${cur.slug}`} className="link">{t.open}</a></div>
              <div className="row between small" style={{ marginBottom: 6 }}><span className={`st-${cur.status}`}>{t.status[cur.status]}</span><b>{Math.round(cur.proof * 100)}%</b></div>
              <Bar p={cur.proof * 100} />
              <p className="muted small" style={{ marginBottom: 0 }}>{t.progress.practiceVs}: {Math.round(cur.practice * 100)}% / {Math.round(cur.proof * 100)}%</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
