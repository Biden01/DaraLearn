import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Ring, useApp } from "../ui.jsx";
import { monthName } from "./Plan.jsx";

const ACH_ICONS = { first_step: "star", diagnostic: "doc", perfect_test: "target", streak5: "fire", five_mastered: "book", all_mastered: "check" };

// Личный кабинет: кто я, мои успехи, цель месяца, классы и достижения. Настройки — отдельная страница.
export default function Profile() {
  const { t, user } = useApp();
  const student = user.role === "student";
  const [d, setD] = useState(null);
  const [goal, setGoal] = useState(null);
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    if (!student) return;
    api("/state/me").then(setD).catch(() => {});
    api("/plan/today").then((p) => setGoal(p.goal || null)).catch(() => {});
    api("/auth/me/classes").then(setClasses).catch(() => {});
  }, [student]);
  const pr = t.profile;
  const sub = student ? [t.grade(user.grade), ...classes.map((c) => c.name)].join(" · ") : t.roles[user.role];

  return (
    <>
      <div className="card" style={{ background: "linear-gradient(135deg, var(--accent) 0%, #4f8bff 100%)", color: "#fff", border: 0, marginBottom: 20, padding: 26 }}>
        <div className="row wrap" style={{ gap: 20 }}>
          <div className="avatar" style={{ width: 76, height: 76, fontSize: 30, background: "#fff", color: "var(--accent)" }}>{(user.name || "?")[0].toUpperCase()}</div>
          <div className="grow" style={{ minWidth: 200 }}>
            <h1 style={{ margin: "0 0 4px", color: "#fff" }}>{user.name}</h1>
            <div style={{ opacity: 0.9 }}>{sub}</div>
            <div className="small" style={{ opacity: 0.75, marginTop: 4 }}>{pr.login}: {user.login || user.email}</div>
          </div>
          <a href="#/settings" className="btn ghost" style={{ background: "rgba(255,255,255,.16)", color: "#fff", borderColor: "rgba(255,255,255,.4)" }}>
            <Icon n="gear" s={16} /> {pr.settings}
          </a>
        </div>
      </div>
      {!student && <p className="muted">{pr.staffSub}</p>}
      {student && d && <StudentPart d={d} goal={goal} classes={classes} />}
    </>
  );
}

function StudentPart({ d, goal, classes }) {
  const { t, L, lang } = useApp();
  const pr = t.profile;
  const pp = t.progress;
  const stats = [["book", "", `${d.progress.mastered}/${d.progress.total}`, pr.stats.mastered],
    ["fire", "orange", d.activity.streak, pr.stats.streak], ["target", "", d.stats.tasks, pr.stats.tasks], ["doc", "", d.stats.tests, pr.stats.tests]];
  const got = Object.values(d.achievements).filter(Boolean).length;
  const pct = goal?.total ? Math.round((100 * goal.done) / goal.total) : 0;
  return (
    <>
      <div className="grid g-4" style={{ marginBottom: 20 }}>
        {stats.map(([icon, c, v, l]) => (
          <div className="card row" key={l}><Box icon={icon} c={c} /><div><div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="muted small">{l}</div></div></div>
        ))}
      </div>
      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <p className="card-title" style={{ marginBottom: 14 }}>{goal ? `${pr.goal}: ${monthName(goal.month, lang)}` : pr.goal}</p>
            {goal ? (
              <>
                <div className="row wrap" style={{ gap: 18, marginBottom: 14 }}>
                  <Ring p={pct} size={72} />
                  <div className="grow" style={{ minWidth: 160 }}>
                    <div className="t-strong" style={{ marginBottom: 8 }}>{t.plan.goalDone(goal.done, goal.total)}</div>
                    <Bar p={pct} />
                  </div>
                </div>
                <a href="#/plan" className="btn">{pr.toPlan} <Icon n="arrow" s={16} /></a>
              </>
            ) : <p className="muted small" style={{ margin: 0 }}>{pr.goalNone}</p>}
          </div>
          <div className="card">
            <p className="card-title" style={{ marginBottom: 8 }}>{t.me.classes}</p>
            {classes.length ? classes.map((c) => (
              <div key={c.id} className="list-item"><Box icon="home" size={36} /><div className="grow"><div className="t-strong">{c.name}</div>
                <div className="muted small">{t.me.teacher}: {c.teacher || "—"}</div></div></div>
            )) : (
              <><p className="muted small" style={{ margin: "0 0 12px" }}>{pr.noClasses}</p><a href="#/settings" className="btn sm ghost">{pr.toSettings}</a></>
            )}
          </div>
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-head"><p className="card-title">{pp.achievements}</p><span className="muted small">{t.of(got, 6)}</span></div>
          <div className="grid g-2" style={{ gap: 12 }}>
            {Object.entries(pp.ach).map(([k, [h, desc]]) => (
              <div key={k} className="row" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, opacity: d.achievements[k] ? 1 : 0.45 }}>
                <Box icon={ACH_ICONS[k]} c={d.achievements[k] ? "orange" : ""} size={36} />
                <div><div className="t-strong small">{L(h)}</div><div className="muted small">{L(desc)}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
