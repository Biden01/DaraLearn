import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, Icon, useApp } from "../ui.jsx";

export function RecentAttempts() {
  const { t, L } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api("/verification/attempts?limit=6").then(setList).catch(() => setList([])); }, []);
  if (!list) return null;
  if (!list.length) return <p className="muted">{t.diag.none}</p>;
  return list.map((a) => (
    <a key={a.id} href={`#/result/${a.id}`} className="list-item">
      <Box sym={a.subject.sym} c={a.subject.color} size={40} />
      <div className="grow"><div className="t-strong">{t.diag.kind[a.kind]}: {L(a.title)}</div>
        <div className="muted small">{new Date(a.finished_at).toLocaleDateString()}</div></div>
      <b>{Math.round((100 * a.score) / a.total)}%</b>
    </a>
  ));
}

export default function Diagnostics() {
  const { t, L, startTest } = useApp();
  const [subjects, setSubjects] = useState([]);
  const [sel, setSel] = useState("math");
  useEffect(() => { api("/content/subjects").then(setSubjects).catch(() => {}); }, []);
  const s = subjects.find((x) => x.slug === sel);
  const dp = t.diag;
  return (
    <>
      <Crumb items={[[t.nav.diagnostics]]} />
      <h1>{dp.title}</h1>
      <p className="subtitle">{dp.sub}</p>
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="card-title" style={{ marginBottom: 18 }}>{dp.how}</p>
        <div className="grid g-3 steps">
          {dp.steps.map(([h, d], i) => (
            <div className="row" key={h} style={{ alignItems: "flex-start" }}><div className="num">{i + 1}</div>
              <div><div className="t-strong">{h}</div><p className="muted small" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>{d}</p></div></div>
          ))}
        </div>
      </div>
      <div className="grid g-main">
        <div className="card">
          <p className="card-title" style={{ marginBottom: 18 }}>{dp.choose}</p>
          <div className="grid g-4" style={{ gap: 12 }}>
            {subjects.map((x) => (
              <button key={x.slug} disabled={!x.active} className={`subj-tile ${sel === x.slug ? "on" : ""}`} onClick={() => setSel(x.slug)}
                style={x.active ? undefined : { opacity: 0.55, cursor: "not-allowed" }}>
                <Box sym={x.sym} c={x.color} size={38} />
                <div className="t-strong">{L(x.title)}</div>
                <div className="muted small">{x.active ? t.subjects.topics(x.progress.total) : t.soon}</div>
              </button>
            ))}
          </div>
          <button className="btn" style={{ marginTop: 22 }} disabled={!s?.active}
            onClick={() => startTest({ kind: "diagnostic", subject: sel })}>{dp.startFor(s ? L(s.title) : "")} <Icon n="arrow" s={16} /></button>
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-head"><p className="card-title">{dp.recent}</p></div>
          <RecentAttempts />
        </div>
      </div>
    </>
  );
}
