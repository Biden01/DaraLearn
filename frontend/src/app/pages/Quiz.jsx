import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, Icon, useApp } from "../ui.jsx";
import { RecentAttempts } from "./Diagnostics.jsx";

export default function Quiz() {
  const { t, L, route, startTest } = useApp();
  const [courses, setCourses] = useState([]);
  const [lesson, setLesson] = useState(route.query.get("lesson") || "");
  useEffect(() => { api("/content/courses?subject=math").then(setCourses).catch(() => {}); }, []);
  const q = t.quiz;
  return (
    <>
      <Crumb items={[[t.nav.quiz]]} />
      <h1>{t.nav.quiz}</h1>
      <p className="subtitle">{q.sub}</p>
      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <p className="card-title" style={{ marginBottom: 6 }}>{q.choose}</p>
            <p className="muted" style={{ marginTop: 0 }}>{q.chooseText}</p>
            {courses.map((c) => (
              <div className="list-item" key={c.slug}>
                <Box sym={c.sym} />
                <div className="grow"><div className="t-strong">{L(c.title)}</div><div className="muted small">{q.courseTest} · {t.lessonsN(c.lessons.length)}</div></div>
                <button className="btn sm" onClick={() => startTest({ kind: "verification", course: c.slug })}>{t.start}</button>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 4 }} className="row wrap">
              <label className="field grow" style={{ minWidth: 220 }}>{q.lessonTest}
                <select value={lesson} onChange={(e) => setLesson(e.target.value)}>
                  <option value="" disabled>—</option>
                  {courses.map((c) => (
                    <optgroup key={c.slug} label={L(c.title)}>
                      {c.lessons.map((l) => <option key={l.slug} value={l.slug}>{L(l.title)} · {t.status[l.status]}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button className="btn" style={{ alignSelf: "flex-end" }} disabled={!lesson}
                onClick={() => startTest({ kind: "verification", lesson })}>{t.start} <Icon n="arrow" s={16} /></button>
            </div>
          </div>
          <div className="card soft">
            <div className="row"><Box icon="lock" size={36} /><p className="card-title" style={{ margin: 0 }}>AI Tutor</p></div>
            <p className="muted small" style={{ lineHeight: 1.5, margin: "12px 0 0" }}>{q.noAi}</p>
          </div>
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-head"><p className="card-title">{t.diag.recent}</p></div>
          <RecentAttempts />
        </div>
      </div>
    </>
  );
}
