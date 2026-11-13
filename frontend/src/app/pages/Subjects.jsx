import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Icon, Loading, useApp } from "../ui.jsx";

// Мои предметы: по карточке на предмет — прогресс, счётчики, следующая тема и кнопка «Продолжить».
// Без отдельной панели «подробнее»: при одном предмете она повторяла ту же карточку.
export default function Subjects() {
  const { t, L, user } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api("/content/subjects").then(setList).catch(() => setList([])); }, []);
  if (!list) return <Loading />;

  const sp = t.subjects;
  const shown = list.filter((x) => x.active && x.progress?.total > 0);
  if (!shown.length) return <><Crumb items={[[t.nav.subjects]]} /><h1>{t.nav.subjects}</h1><p className="subtitle">{sp.soonText}</p></>;
  return (
    <>
      <Crumb items={[[t.nav.subjects]]} />
      <h1>{t.nav.subjects}</h1>
      <p className="subtitle">{sp.sub}</p>
      <div className="subj-list">
        {shown.map((x) => (
          <article key={x.slug} className="card subj-card">
            <div className="subj-head">
              <Box sym={x.sym} c={x.color} size={52} />
              <div className="grow">
                <h2 className="subj-title">{L(x.title)}</h2>
                <div className="muted small">{t.grade(user.grade)} · {sp.topics(x.progress.total)}</div>
              </div>
              <b className="subj-pct">{x.progress.percent}%</b>
            </div>
            <Bar p={x.progress.percent} />
            <div className="subj-stats">
              <div><b>{x.progress.mastered}</b><span>{sp.mastered}</span></div>
              <div><b>{x.progress.learning}</b><span>{sp.inprog}</span></div>
              <div><b>{x.progress.left}</b><span>{sp.left}</span></div>
            </div>
            {x.next && (
              <a className="subj-next" href={`#/lesson/${x.next.slug}`}>
                <span className="grow"><span className="muted small">{sp.nextTopic}</span><span className="t-strong">{L(x.next.title)}</span></span>
                <Icon n="chev" s={18} />
              </a>
            )}
            <div className="subj-actions">
              {x.next && <a href={`#/lesson/${x.next.slug}`} className="btn">{sp.cont} <Icon n="arrow" s={16} /></a>}
              <a href="#/courses" className="btn ghost">{sp.go}</a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
