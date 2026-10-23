import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Loading, useApp } from "../ui.jsx";
import { Chain } from "./Courses.jsx";

function Theory({ lines, t }) {
  return (
    <div className="theory">
      {lines.map((ln, i) => {
        if (ln.startsWith("$ ")) return <span key={i} className="formula" style={{ textAlign: "center", padding: 14 }}>{ln.slice(2)}</span>;
        if (ln.startsWith("! ")) return <div key={i} className="note" style={{ margin: "16px 0" }}><b>{t.lesson.remember}</b><br />{ln.slice(2)}</div>;
        return <p key={i}>{ln.split(/(\*\*[^*]+\*\*)/).map((p, k) => (p.startsWith("**") ? <b key={k}>{p.slice(2, -2)}</b> : p))}</p>;
      })}
    </div>
  );
}

function PracticeTask({ task, i }) {
  const { t, L } = useApp();
  const [res, setRes] = useState(null);
  const [choice, setChoice] = useState(null);
  async function answer(c) {
    setChoice(c);
    try { setRes(await api("/events/practice", { method: "POST", body: { task_id: task.id, choice: c } })); } catch { setChoice(null); }
  }
  return (
    <div className="task">
      <div className="q">{i + 1}. {L(task.question)}</div>
      <div className="opts">
        {task.options.map((o, j) => (
          <button key={j} disabled={res !== null}
            className={res ? (j === res.answer ? "right" : j === choice ? "wrong" : "") : ""}
            onClick={() => answer(j)}>{L(o)}</button>
        ))}
      </div>
      {res && (
        <div className="feedback" role="status">
          <b className={res.correct ? "st-mastered" : "st-gap"}>{res.correct ? t.lesson.right : t.lesson.wrong}</b>
          {!res.correct && <>{t.lesson.correctIs} {L(task.options[res.answer])}. </>}{L(res.explanation)}
          {!res.correct && <div style={{ marginTop: 8 }}><button className="link" onClick={() => { setRes(null); setChoice(null); }}>{t.quiz.again}</button></div>}
        </div>
      )}
    </div>
  );
}

export default function Lesson() {
  const { t, L, lang, route, startTest } = useApp();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("theory");
  useEffect(() => { api(`/content/lessons/${route.param}`).then(setD).catch(() => setD(false)); }, [route.param]);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const lp = t.lesson;
  const idx = d.course.lessons.findIndex((l) => l.slug === d.slug);
  const st = d.state;
  return (
    <>
      <div className="crumb"><a href="#/courses">{t.nav.courses}</a> / {L(d.course.title)}</div>
      <p className="muted small" style={{ margin: "12px 0 6px" }}>{idx + 1} / {d.course.lessons.length} · {t.min(d.minutes)}</p>
      <h1>{L(d.title)}</h1>
      <p className="subtitle">{L(d.course.title)}</p>
      <div className="grid g-main">
        <div className="card">
          <div className="tabs" style={{ marginBottom: 22 }}>
            {Object.entries(lp.tabs).map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {tab === "theory" && <Theory lines={d.theory[lang] || d.theory.kk} t={t} />}
          {tab === "examples" && (
            <div className="stack" style={{ gap: 14 }}>
              {d.examples.map((ex, i) => (
                <div className="example" key={i}>
                  <b>{lp.example(i + 1)}.</b> {L(ex.q)}
                  <div className="steps-list">{ex.steps.map((s, j) => <span key={j}>{L(s)}</span>)}</div>
                </div>
              ))}
            </div>
          )}
          {tab === "practice" && (
            <>
              <p className="muted" style={{ marginTop: 0, lineHeight: 1.5 }}>{lp.practiceNote}</p>
              {d.practice.map((task, i) => <PracticeTask key={task.id} task={task} i={i} />)}
            </>
          )}
          <div className="row between wrap" style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginTop: 18, gap: 12 }}>
            {d.prev ? <a className="btn ghost" href={`#/lesson/${d.prev}`}><Icon n="left" s={16} /> {lp.prev}</a> : <span />}
            <div className="row wrap">
              <a href={`#/tutor?lesson=${d.slug}`} className="btn ghost">{lp.ask}</a>
              <button className="btn" onClick={() => startTest({ kind: "verification", lesson: d.slug })}>{lp.check} <Icon n="check" s={16} /></button>
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <p className="card-title" style={{ marginBottom: 12 }}>{lp.state}</p>
            {st.status === "unknown" ? <p className="muted small" style={{ lineHeight: 1.5, margin: 0 }}>{lp.noData}</p> : (
              <>
                <div className="row between" style={{ marginBottom: 8 }}><b className={`st-${st.status}`}>{t.status[st.status]}</b><b>{Math.round(st.proof * 100)}%</b></div>
                <Bar p={st.proof * 100} />
                <p className="muted small" style={{ margin: "10px 0 0" }}>{t.progress.practiceVs}: {Math.round(st.practice * 100)}% / {Math.round(st.proof * 100)}%</p>
              </>
            )}
          </div>
          {d.prereqs.length > 0 && (
            <div className="card">
              <p className="card-title" style={{ marginBottom: 6 }}>{lp.base}</p>
              {d.prereqs.map((p) => (
                <a key={p.slug} href={`#/lesson/${p.slug}`} className="list-item">
                  <span className={`dot ${p.status}`} /><span className="grow small" style={{ fontWeight: 600 }}>{L(p.title)}</span>
                  <span className={`small st-${p.status}`}>{t.status[p.status]}</span>
                </a>
              ))}
            </div>
          )}
          <div className="card">
            <div className="row" style={{ marginBottom: 16 }}><Box sym={d.course.sym} /><div><div className="t-strong">{L(d.course.title)}</div>
              <div className="muted small">{t.lessonsN(d.course.lessons.length)} · {t.min(d.course.minutes)}</div></div></div>
            <div className="row between small" style={{ marginBottom: 8 }}><span>{lp.yourProgress}</span><b>{d.course.progress.percent}%</b></div>
            <Bar p={d.course.progress.percent} />
            <div style={{ marginTop: 16 }}><Chain lessons={d.course.lessons} current={d.slug} /></div>
            {d.next && <a className="link" style={{ marginTop: 16 }} href={`#/lesson/${d.next}`}>{lp.next} <Icon n="arrow" s={14} /></a>}
          </div>
        </div>
      </div>
    </>
  );
}

