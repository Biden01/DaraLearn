import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Icon, Loading, useApp } from "../ui.jsx";

export function Chain({ lessons, current }) {
  const { L, t } = useApp();
  return (
    <div className="chain">
      {lessons.map((l, i) => (
        <a key={l.slug} href={`#/lesson/${l.slug}`} className={`${l.status} ${l.slug === current ? "cur" : ""}`}
          title={`${L(l.title)} — ${t.status[l.status]}`} aria-label={`${i + 1}. ${L(l.title)} — ${t.status[l.status]}`}>
          {l.status === "mastered" ? <Icon n="check" s={16} /> : i + 1}
        </a>
      ))}
    </div>
  );
}

export default function Courses() {
  const { t, L, startTest } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api("/content/courses?subject=math").then(setList).catch(() => setList([])); }, []);
  if (!list) return <Loading />;

  const c = t.courses;
  // рекомендуемый — первый курс, где ещё не всё освоено
  const rec = list.find((x) => x.progress.mastered < x.progress.total) || list[0];
  const recNext = rec?.lessons.find((l) => l.status !== "mastered") || rec?.lessons[0];
  return (
    <>
      <Crumb items={[[t.nav.courses]]} />
      <h1>{t.nav.courses}</h1>
      <p className="subtitle">{c.sub}</p>
      {rec && (
        <div className="card soft" style={{ marginBottom: 28 }}>
          <div className="muted small" style={{ marginBottom: 14 }}>{c.recommended} · {L(rec.subject_title)} · {t.grade(rec.grade)}</div>
          <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
            <Box sym={rec.sym} size={56} />
            <div className="grow">
              <h2 style={{ margin: "0 0 8px", fontSize: 24 }}>{L(rec.title)}</h2>
              <p className="muted" style={{ margin: "0 0 18px", lineHeight: 1.5 }}>{L(rec.description)}</p>
              <div className="grid g-3" style={{ gap: 12, marginBottom: 20 }}>
                <div><b>{t.min(rec.minutes)}</b><div className="muted small">{c.duration}</div></div>
                <div><b>{rec.lessons.length}</b><div className="muted small">{c.count}</div></div>
                <div><b>{t.level[rec.level]}</b><div className="muted small">{c.level}</div></div>
              </div>
              <div className="row wrap">
                <a href={`#/lesson/${recNext.slug}`} className="btn">{t.continue}: {L(recNext.title)}</a>
                <button className="btn ghost" onClick={() => startTest({ kind: "verification", course: rec.slug })}>{c.check}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="stack">
        {list.map((x) => (
          <div className="card" key={x.slug}>
            <div className="row between wrap" style={{ gap: 16 }}>
              <div className="row"><Box sym={x.sym} /><div><div className="t-strong">{L(x.title)}</div>
                <div className="muted small">{t.lessonsN(x.lessons.length)} · {t.min(x.minutes)} · {t.level[x.level]}</div></div></div>
              <div className="row" style={{ minWidth: 200 }}><div className="grow"><Bar p={x.progress.percent} /></div><b>{x.progress.percent}%</b></div>
            </div>
            <p className="muted small" style={{ margin: "14px 0", lineHeight: 1.5 }}>{L(x.description)}</p>
            <div className="row between wrap" style={{ gap: 14 }}>
              <Chain lessons={x.lessons} />
              <button className="btn ghost sm" onClick={() => startTest({ kind: "verification", course: x.slug })}>{c.check}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
