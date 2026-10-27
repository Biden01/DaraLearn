import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Loading, Ring, useApp } from "../ui.jsx";
import { actionHref } from "./actions.js";

export default function Home() {
  const { t, L, user, startTest } = useApp();
  const [d, setD] = useState(null);
  const [checks, setChecks] = useState([]);
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    api("/state/me").then(setD).catch(() => setD(false));
    api("/verification/checks").then((c) => setChecks(c.filter((x) => x.due))).catch(() => {});
    api("/auth/me/classes").then(setClasses).catch(() => {});
  }, []);
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
      {checks.length > 0 && (
        <div className="card row wrap" style={{ marginBottom: 20, borderColor: "var(--amber)", background: "var(--amber-soft)", gap: 16 }}>
          <Box icon="clock" c="orange" />
          <div className="grow"><div className="card-title">{t.me.checksTitle}</div>
            <div className="muted small">{t.me.checksText} · {checks.map((c) => L(c.lesson.title)).join(", ")}</div></div>
          <button className="btn" onClick={() => startTest({ kind: "verification", check_id: checks[0].id })}>{t.me.checkBtn}</button>
        </div>
      )}
      <div className="grid g-main">
        <div className="stack">
          <div className="card soft continue">
            <div className="card-head"><p className="card-title">{t.home.nextTitle}</p><span className="muted">{t.grade(user.grade)}</span></div>
            <div className="row"><Box sym="√x" /><span className="muted">{lessonTitle || "Математика"}</span></div>
            <h2>{title}</h2>
            <p className="muted" style={{ margin: "0 0 22px", lineHeight: 1.5 }}>{text}</p>
            {n.comment && n.status && n.status !== "new" && (
              <p className="note" style={{ margin: "0 0 14px", borderColor: "var(--green)", background: "#e7f6ef" }}><b>{t.rec.teacherNote}</b> {n.comment}</p>
            )}
            {n.cause && t.causeHelp[n.cause] && (
              <p className="note" style={{ margin: "0 0 22px" }}><b>{t.home.why}</b> {t.causeHelp[n.cause]}</p>
            )}
            {n.action !== "done" && <a href={actionHref(n)} className="btn">{t.start} <Icon n="arrow" s={16} /></a>}
          </div>
          <div className="card">
            <div className="card-head"><p className="card-title">{t.home.recs}</p><a href="#/gaps" className="link">{t.home.allGaps}</a></div>
            {d.recommendations.length ? d.recommendations.slice(0, 4).map((r) => (
              <div className="list-item" key={r.lesson + r.action}>
                <span className={`dot ${r.skill_status || r.status}`} />
                <div className="grow"><div className="t-strong">{L(r.title)}</div>
                  <div className="muted small">{t.actions[r.action][0]}{["accepted", "changed"].includes(r.status) ? ` · ${t.rec.byTeacher}` : ""}</div></div>
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
          {classes.length > 0 && (
            <div className="card">
              <p className="card-title" style={{ marginBottom: 8 }}>{t.me.classes}</p>
              {classes.map((c) => <div key={c.id} className="row between small" style={{ padding: "4px 0" }}><b>{c.name}</b><span className="muted">{t.me.teacher}: {c.teacher || "—"}</span></div>)}
            </div>
          )}
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
