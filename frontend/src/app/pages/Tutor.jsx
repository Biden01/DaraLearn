import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Icon, Rich, useApp } from "../ui.jsx";
import TutorTask from "./TutorTask.jsx";

const hhmm = (iso) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const BotAva = () => <div className="avatar bot-ava"><Icon n="bot" s={18} /></div>;

export default function Tutor() {
  const { t, L, route, toast } = useApp();
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const body = useRef();
  const input = useRef();
  const tp = t.tutor;
  const sg = t.stages;
  const wanted = route.query.get("lesson");
  const wantedRec = route.query.get("rec");
  const [check, setCheck] = useState(null); // этапы 7–9: {tasks, answers, result}
  const [task, setTask] = useState(null);          // задача первой попытки (карточка в ленте)
  const [taskSeen, setTaskSeen] = useState(true);  // карточка задачи сейчас в кадре
  const taskRef = useRef();
  const msgCount = useRef(0);
  msgCount.current = session?.messages?.length || 0;
  // пока ученик не писал — показываем начало ленты (задачу), потом — последние сообщения
  const toEnd = (el) => { el.scrollTop = msgCount.current ? el.scrollHeight : 0; };

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

  useEffect(() => { if (body.current && !check) toEnd(body.current); }, [session?.messages, busy, check]);
  useEffect(() => { if (body.current && check) body.current.scrollTop = 0; }, [!!check]);
  // лента меняет высоту (задача свернулась/догрузилась, клавиатура на телефоне) — держим низ переписки в кадре
  useEffect(() => {
    const el = body.current;
    if (!el || check || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => toEnd(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [check, !!session]);
  // карточка задачи ушла вверх — показываем закреплённую строку «К задаче»
  useEffect(() => {
    const el = taskRef.current;
    if (!el || !body.current || typeof IntersectionObserver === "undefined") { setTaskSeen(true); return; }
    const io = new IntersectionObserver(([e]) => setTaskSeen(e.isIntersecting), { root: body.current, threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [task, check]);
  // поле ввода растёт вместе с текстом (до 5 строк)
  useEffect(() => {
    const el = input.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; }
  }, [text]);

  async function newSession(lesson) {
    setCheck(null);
    const rec = lesson && lesson === wanted && wantedRec ? Number(wantedRec) : null;
    try { setSession(await api("/tutor/sessions", { method: "POST", body: { lesson: lesson || null, recommendation_id: rec } })); } catch { toast(t.error); }
  }

  async function nextStage() {
    try {
      const s = await api(`/tutor/sessions/${session.id}/stage`, { method: "POST", body: { stage: Math.min(6, session.stage + 1) } });
      setSession(s);
    } catch { toast(t.error); }
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
      input.current?.focus();
    }
  }

  const cur = session?.lesson ? lessons.find((l) => l.slug === session.lesson.slug) : null;
  const hasLesson = !!session?.lesson;
  const locked = !session || session.stage >= 7 || session.finished;
  const noLeft = status?.enabled && status.remaining <= 0;
  const msgs = session?.messages || [];
  const answered = session?.first_attempt_correct !== null && session?.first_attempt_correct !== undefined;
  const canNext = hasLesson && !locked && session.stage < 6 && (session.first_attempt_correct === false || session.hints_used > 0);
  // при верной первой попытке кнопка проверки есть в самой задаче, здесь — только после ошибки
  const canCheck = hasLesson && !locked && !check && answered && !session.first_attempt_correct;
  const stageNo = session ? (session.finished ? 9 : session.stage) : 1;
  const showTask = hasLesson && !locked && !check;

  return (
    <div className="tutor-page">
      <Crumb items={[[t.nav.tutor]]} />
      <div className="tutor-top">
        <div className="row" style={{ gap: 10 }}><h1 style={{ margin: 0 }}>Dara AI Tutor</h1><span className="badge">{tp.beta}</span></div>
        {status && (
          <span className={`quota ${!status.enabled ? "off" : noLeft ? "empty" : ""}`}>
            <Icon n="bot" s={14} /> {status.enabled ? tp.left(status.remaining) : tp.offShort}
          </span>
        )}
      </div>

      <div className={hasLesson ? "grid g-main tutor-grid" : "tutor-solo"}>
        <div className="card chat">
          <div className="chat-head">
            <Box sym="√x" size={34} />
            <select className="chat-topic" value={session?.lesson?.slug || ""} aria-label={tp.pick}
              onChange={(e) => newSession(e.target.value)}>
              <option value="">{tp.free}</option>
              {lessons.map((l) => <option key={l.slug} value={l.slug}>{L(l.title)}</option>)}
            </select>
            <button className="btn sm ghost" onClick={() => newSession(session?.lesson?.slug)} title={tp.newChat} aria-label={tp.newChat}>
              <Icon n="plus" s={16} /> <span className="hide-sm">{tp.newChat}</span></button>
          </div>

          {hasLesson && (
            <div className="stepper">
              <div className="stepper-bar" role="img" aria-label={tp.stepOf(stageNo)}>
                {sg.groups.map((g, gi) => (
                  <div key={g} className="stepper-group" title={g}>
                    {[1, 2, 3].map((k) => {
                      const st = gi * 3 + k;
                      const cls = st < session.stage || session.finished ? "done" : st === session.stage ? "cur" : "";
                      return <span key={st} className={cls} title={`${st}. ${sg.names[st - 1]}`} />;
                    })}
                  </div>
                ))}
              </div>
              <div className="stepper-row">
                <span className="stepper-label"><b>{tp.stepOf(stageNo)}</b> · {sg.names[stageNo - 1]}</span>
                <span className="row" style={{ gap: 6 }}>
                  {canNext && <button className="btn sm ghost" onClick={nextStage}>{sg.next}</button>}
                  {canCheck && <button className="btn sm" onClick={startCheck}><Icon n="lock" s={14} /> {sg.toCheck}</button>}
                </span>
              </div>
            </div>
          )}

          {status && !status.enabled && <div className="chat-banner">{tp.off}</div>}

          {showTask && task && !taskSeen && session.first_attempt_correct !== true && (
            <button className="task-pin" onClick={() => taskRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <Icon n="target" s={15} /><span className="task-pin-q">{L(task.question)}</span><span className="link small">{tp.toTask} ↑</span>
            </button>
          )}

          <div className="chat-body" ref={body} aria-live="polite">
            {check ? (
              <div className="tutor-check">
                <div className="note" style={{ marginBottom: 14 }}><b>{sg.checkTitle}</b><br />{tp.checkNote}</div>
                {check.tasks.map((task, i) => {
                  const res = check.result?.results.find((x) => x.task_id === task.id);
                  return (
                    <div className="task" key={task.id}>
                      <div className="q"><span className="task-no">{i + 7}</span>{L(task.question)}</div>
                      <div className="opts">
                        {task.options.map((o, j) => (
                          <button key={j} disabled={!!check.result}
                            className={res ? (j === res.answer ? "right" : j === res.choice ? "wrong" : "") : check.answers[task.id] === j ? "picked" : ""}
                            onClick={() => setCheck((c) => ({ ...c, answers: { ...c.answers, [task.id]: j } }))}>{L(o)}</button>
                        ))}
                      </div>
                      {res && !res.correct && <div className="feedback">{L(res.explanation)}</div>}
                    </div>
                  );
                })}
                {check.result ? (
                  <div className={`check-result ${check.result.session.result === "passed" ? "ok" : "bad"}`}>
                    <b>{check.result.session.result === "passed" ? sg.passed : sg.failed}</b>
                    <button className="btn sm" onClick={() => newSession(session.lesson?.slug)}>{sg.newSession}</button>
                  </div>
                ) : (
                  <div className="row between wrap">
                    <span className="muted">{tp.answered(Object.keys(check.answers).length, check.tasks.length)}</span>
                    <button className="btn" disabled={Object.keys(check.answers).length < check.tasks.length} onClick={finishCheck}>{sg.submit}</button>
                  </div>
                )}
              </div>
            ) : msgs.length === 0 && !busy && !hasLesson ? (
              <div className="chat-empty">
                <div className="bot-ava big" style={{ marginBottom: 14 }}><Icon n="bot" s={30} /></div>
                <p className="t-strong" style={{ margin: "0 0 6px", fontSize: 16 }}>{tp.hello}</p>
                <p className="muted" style={{ margin: "0 0 18px", lineHeight: 1.5 }}>{tp.freeTip}</p>
                {!locked && !noLeft && (
                  <div className="starters">
                    {tp.quick.map((q) => <button key={q} disabled={busy} onClick={() => send(q)}>{q}<Icon n="arrow" s={16} /></button>)}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="msg bot"><BotAva /><div><div className="bubble">{tp.hello}</div></div></div>
                {showTask && <TutorTask ref={taskRef} session={session} setSession={setSession} onCheck={startCheck} onTask={setTask} />}
                {msgs.map((m) => (
                  <div key={m.id} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
                    {m.role !== "user" && <BotAva />}
                    <div><div className="bubble">{m.role === "user" ? m.content : <Rich text={m.content} />}</div>
                      <div className="time">{hhmm(m.at)}</div></div>
                  </div>
                ))}
                {busy && (
                  <div className="msg bot"><BotAva />
                    <div className="bubble typing" aria-label={tp.thinking}><i /><i /><i /></div>
                  </div>
                )}
              </>
            )}
          </div>

          {!check && (
            locked && session ? (
              <div className="chat-locked">
                {session.finished ? <>
                  <span className="muted">{tp.finished}</span>
                  <button className="btn sm" onClick={() => newSession(session.lesson?.slug)}>{sg.newSession}</button>
                </> : <>
                  <span className="muted">{tp.checkNote}</span>
                  <button className="btn sm" onClick={startCheck}><Icon n="lock" s={14} /> {sg.toCheck}</button>
                </>}
              </div>
            ) : (
              <div className="chat-foot">
                {(msgs.length > 0 || hasLesson) && !noLeft && (
                  <div className="chips chat-quick">
                    {tp.quick.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => send(q)}>{q}</button>)}
                  </div>
                )}
                <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
                  <textarea ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder={noLeft ? tp.limit : tp.placeholder} maxLength={2000} aria-label={tp.placeholder} disabled={locked || noLeft}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
                  <button className="btn send" aria-label={tp.send} disabled={busy || !text.trim() || locked || noLeft}><Icon n="send" s={18} /></button>
                </form>
                <div className="chat-hint hide-sm">{tp.enterHint}</div>
              </div>
            )
          )}
        </div>

        {hasLesson && (
          <div className="stack tutor-side">
            {cur && (
              <div className="card">
                <div className="card-head"><p className="card-title">{t.lesson.state}</p><a href={`#/lesson/${cur.slug}`} className="link">{t.open}</a></div>
                <p className="t-strong" style={{ margin: "0 0 10px" }}>{L(cur.title)}</p>
                <div className="row between small" style={{ marginBottom: 6 }}><span className={`st-${cur.status}`}>{t.status[cur.status]}</span><b>{Math.round(cur.proof * 100)}%</b></div>
                <Bar p={cur.proof * 100} />
                <p className="muted small" style={{ marginBottom: 0 }}>{t.progress.practiceVs}: {Math.round(cur.practice * 100)}% / {Math.round(cur.proof * 100)}%</p>
              </div>
            )}
            <div className="card tutor-stages">
              <p className="card-title" style={{ marginBottom: 12 }}>{sg.title}</p>
              {sg.groups.map((g, gi) => (
                <div key={g} style={{ marginBottom: gi < 2 ? 10 : 0 }}>
                  <div className="muted small" style={{ marginBottom: 6 }}>{g}</div>
                  <div className="stages">
                    {sg.names.slice(gi * 3, gi * 3 + 3).map((n, k) => {
                      const st = gi * 3 + k + 1;
                      const done = st < session.stage || session.finished;
                      return <span key={n} className={done ? "done" : st === session.stage ? "cur" : ""}>
                        {done ? <Icon n="check" s={13} /> : <i>{st}</i>} {n}</span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
