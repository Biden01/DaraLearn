import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Loading, Ring, useApp } from "../ui.jsx";
import { actionHref } from "./actions.js";

export default function Home() {
  const { t, L, user } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api("/state/me").then(setD).catch(() => setD(false)); }, []);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const n = d.next;
  const [title, text] = t.actions[n.action] || t.actions.done;
  const lessonTitle = n.action === "prereq" ? L(n.target_title) : L(n.title);
  const p = d.progress;
  return (
    <>
      <h1>{t.greet(new Date().getHours())}, {user.name}!</h1>
      <p className="subtitle">{t.home.sub}</p>
      <div className="grid g-main">
        <div className="stack">
          <div className="card soft continue">
            <div className="card-head"><p className="card-title">{t.home.nextTitle}</p><span className="muted">{t.grade(user.grade)}</span></div>
            <div className="row"><Box sym="√x" /><span className="muted">{lessonTitle || "Математика"}</span></div>
            <h2>{title}</h2>
            <p className="muted" style={{ margin: "0 0 22px", lineHeight: 1.5 }}>{text}</p>
            {n.cause && t.causeHelp[n.cause] && (
              <p className="note" style={{ margin: "0 0 22px" }}><b>{t.home.why}</b> {t.causeHelp[n.cause]}</p>
            )}
            {n.action !== "done" && <a href={actionHref(n)} className="btn">{t.start} <Icon n="arrow" s={16} /></a>}
          </div>
          <div className="card">
            <div className="card-head"><p className="card-title">{t.home.recs}</p><a href="#/gaps" className="link">{t.home.allGaps}</a></div>
            {d.recommendations.length ? d.recommendations.slice(0, 4).map((r) => (
              <div className="list-item" key={r.lesson + r.action}>
                <span className={`dot ${r.status}`} />
                <div className="grow"><div className="t-strong">{L(r.title)}</div><div className="muted small">{t.actions[r.action][0]}</div></div>
                <a className="btn sm ghost" href={actionHref(r)}>{t.open}</a>
              </div>
            )) : <p className="muted">{t.home.noRecs}</p>}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><p className="card-title">{t.home.progress}</p><a href="#/progress" className="link"><Icon n="arrow" s={16} /></a></div>
            <div className="row" style={{ gap: 22 }}>
              <Ring p={p.percent} />
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{t.of(p.mastered, p.total)}</div><div className="muted">{t.home.progressText(p.mastered, p.total)}</div></div>
            </div>
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 22, paddingTop: 18 }}>
              <div className="row between small" style={{ marginBottom: 8 }}><span>{t.home.week}</span><b>{Math.min(100, Math.round(100 * d.goal.done / d.goal.target))}%</b></div>
              <Bar p={100 * d.goal.done / d.goal.target} />
              <div className="row between muted small" style={{ marginTop: 8 }}>
                <span>{t.home.weekText(d.goal.done, d.goal.target)}</span>
                {d.activity.streak > 0 && <span className="row" style={{ gap: 4, color: "var(--orange)" }}><Icon n="fire" s={14} />{t.home.streak(d.activity.streak)}</span>}
              </div>
            </div>
          </div>
          <div className="card">
            <Box icon="bot" size={40} />
            <p className="card-title" style={{ margin: "16px 0 8px" }}>{t.home.tutorTitle}</p>
            <p className="muted" style={{ lineHeight: 1.5, margin: "0 0 16px" }}>{t.home.tutorText}</p>
            <a href="#/tutor" className="btn ghost block">{t.home.tutorBtn}</a>
          </div>
        </div>
      </div>
    </>
  );
}
