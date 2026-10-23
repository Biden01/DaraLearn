import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Icon, Rich, useApp } from "../ui.jsx";

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

  useEffect(() => {
    api("/tutor/status").then(setStatus).catch(() => {});
    api("/content/courses?subject=math").then((cs) => setLessons(cs.flatMap((c) => c.lessons))).catch(() => {});
    api("/tutor/sessions/current").then((s) => {
      // новая тема из ссылки — новый диалог
      if (!s || (wanted && s.lesson?.slug !== wanted)) return newSession(wanted);
      setSession(s);
    }).catch(() => newSession(wanted));
  }, []);

  useEffect(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [session, busy]);

  async function newSession(lesson) {
    setPicking(false);
    try { setSession(await api("/tutor/sessions", { method: "POST", body: { lesson: lesson || null } })); } catch { toast(t.error); }
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
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tp.placeholder} maxLength={2000} aria-label={tp.placeholder} />
            <button className="btn" aria-label={tp.send} disabled={busy || !text.trim()}><Icon n="send" s={18} /></button>
          </form>
          <div className="row between small muted" style={{ padding: "0 18px 14px" }}>
            <span>{status && !status.enabled ? tp.off : status ? tp.left(status.remaining) : ""}</span>
            <button className="link" onClick={() => newSession(session?.lesson?.slug)}>{tp.newChat}</button>
          </div>
        </div>
        <div className="stack">
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
