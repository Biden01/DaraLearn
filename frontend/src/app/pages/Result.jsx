import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, Ring, useApp } from "../ui.jsx";
import { actionHref } from "./actions.js";

export default function Result() {
  const { t, L, route, startTest } = useApp();
  const [a, setA] = useState(null);
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    api(`/verification/attempts/${route.param}`).then(setA).catch(() => setA(false));
    api("/decisions/me").then(setExtra).catch(() => {});
  }, [route.param]);
  if (a === null) return <Loading />;
  if (a === false) return <p className="muted">{t.error}</p>;

  const q = t.quiz;
  const p = Math.round((100 * a.score) / a.total);
  const lessonIds = new Set(a.tasks.map((x) => x.lesson_id));
  const recs = (extra?.recommendations || []).filter((r) => r.priority >= 2).slice(0, 3);
  const again = a.kind === "diagnostic" ? { kind: "diagnostic", subject: a.subject.slug }
    : a.lesson ? { kind: "verification", lesson: a.lesson.slug } : { kind: "verification", course: a.course.slug };
  return (
    <>
      <Crumb items={[[t.nav.quiz, "#/quiz"], [q.done]]} />
      <h1>{q.done}</h1>
      <p className="subtitle">{t.diag.kind[a.kind]} · {a.lesson ? L(a.lesson.title) : a.course ? L(a.course.title) : L(a.subject.title)}</p>
      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <div className="row wrap" style={{ gap: 28 }}>
              <Ring p={p} size={120} />
              <div><div style={{ fontSize: 26, fontWeight: 700 }}>{q.correct(a.score, a.total)}</div><p style={{ margin: "10px 0 0" }}>{q.verdict(p)}</p></div>
            </div>
          </div>
          <div className="card">
            <p className="card-title" style={{ marginBottom: 12 }}>{q.review}</p>
            {a.results.map((r, k) => {
              const task = a.tasks.find((x) => x.id === r.task_id);
              return (
                <div className="result-row" key={r.task_id}>
                  <span className={`badge ${r.choice == null ? "gray" : r.correct ? "green" : "red"}`}>{k + 1}</span>
                  <div className="grow">
                    <div className="t-strong">{L(task.question)}</div>
                    <div className="small" style={{ marginTop: 4 }}>
                      {q.your}: <b className={r.choice == null ? "" : r.correct ? "st-mastered" : "st-gap"}>{r.choice == null ? q.noAnswer : L(task.options[r.choice])}</b>
                      {!r.correct && <> · {t.lesson.correctIs} <b>{L(task.options[r.answer])}</b></>}
                    </div>
                    {!r.correct && <div className="ex">{L(r.explanation)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <p className="card-title" style={{ marginBottom: 12 }}>{q.nextSteps}</p>
            {recs.length ? recs.map((r) => (
              <div className="list-item" key={r.lesson} style={{ alignItems: "flex-start" }}>
                <span className={`dot ${r.status}`} style={{ marginTop: 5 }} />
                <div className="grow">
                  <div className="t-strong small">{L(r.title)}</div>
                  <div className="muted small">{t.causes[r.cause]}{r.action === "prereq" ? ` → ${L(r.target_title)}` : ""}</div>
                  <a href={actionHref(r)} className="link" style={{ marginTop: 6 }}>{t.actions[r.action][0]}</a>
                </div>
              </div>
            )) : <p className="muted small">{t.gaps.empty}</p>}
            <div className="stack" style={{ gap: 10, marginTop: 14 }}>
              <button className="btn ghost block" onClick={() => startTest(again)}>{q.again}</button>
              <a href="#/" className="btn ghost block">{q.toHome}</a>
            </div>
          </div>
          <div className="card">
            <p className="card-title" style={{ marginBottom: 6 }}>{q.skills}</p>
            <SkillList ids={lessonIds} />
          </div>
        </div>
      </div>
    </>
  );
}

function SkillList({ ids }) {
  const { t, L } = useApp();
  const [all, setAll] = useState(null);
  useEffect(() => { api("/content/courses?subject=math").then((cs) => setAll(cs.flatMap((c) => c.lessons))).catch(() => {}); }, []);
  if (!all) return null;
  const shown = all.filter((l) => ids.has(l.id));
  return shown.map((l) => (
    <a key={l.slug} href={`#/lesson/${l.slug}`} className="list-item">
      <span className={`dot ${l.status}`} /><span className="grow small" style={{ fontWeight: 600 }}>{L(l.title)}</span>
      <span className={`small st-${l.status}`}>{t.status[l.status]}</span>
    </a>
  ));
}
