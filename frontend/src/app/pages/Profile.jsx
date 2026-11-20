import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Ring, useApp } from "../ui.jsx";
import { monthName } from "./Plan.jsx";
import AttendanceCard from "../Attendance.jsx";
import FamilyCode from "./FamilyCode.jsx";

const ACH_ICONS = { first_step: "star", diagnostic: "doc", perfect_test: "target", streak5: "fire", five_mastered: "book", all_mastered: "check" };

// Личный кабинет: кто я, мои успехи, цель месяца, классы и достижения. Настройки — отдельная страница.
export default function Profile() {
  const { t, user } = useApp();
  const student = user.role === "student";
  const staff = user.role === "teacher" || user.role === "curator";
  const [d, setD] = useState(null);
  const [goal, setGoal] = useState(null);
  const [classes, setClasses] = useState([]);
  const [att, setAtt] = useState(null);
  useEffect(() => {
    if (!student) return;
    api("/plan/attendance").then(setAtt).catch(() => {});
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
      {staff && <TeacherPart />}
      {!student && !staff && <p className="muted">{pr.staffSub}</p>}
      {student && d && <StudentPart d={d} goal={goal} classes={classes} att={att} />}
    </>
  );
}

function StudentPart({ d, goal, classes, att }) {
  const { t, L, lang } = useApp();
  const pr = t.profile;
  const pp = t.progress;
  const stats = [["book", "", `${d.progress.mastered}/${d.progress.total}`, pr.stats.mastered],
    ["fire", "orange", d.activity.streak, pr.stats.streak], ["target", "", d.stats.tasks, pr.stats.tasks], ["doc", "", d.stats.tests, pr.stats.tests]];
  const got = Object.values(d.achievements).filter(Boolean).length;
  const pct = goal?.total ? Math.round((100 * goal.done) / goal.total) : 0;
  return (
    <>
      <div className="grid g-4 stats" style={{ marginBottom: 20 }}>
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
          <AttendanceCard a={att} self />
          <FamilyCode />
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
          <div className="ach-grid">
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

// Кабинет учителя (и куратора): сводка, мои классы с посещаемостью и кодами, время на проверку, быстрые действия.
function TeacherPart() {
  const { t, user } = useApp();
  const tp = t.profile.teacher;
  const isTeacher = user.role === "teacher";
  const [classes, setClasses] = useState(null);
  const [att, setAtt] = useState({});
  const [waiting, setWaiting] = useState(null);
  const [time, setTime] = useState(null);
  useEffect(() => {
    api("/school/classes").then(setClasses).catch(() => setClasses([]));
    api("/plan/attendance/overview").then((r) => setAtt(Object.fromEntries(r.map((x) => [x.class_id, x])))).catch(() => {});
    api("/decisions/feed").then((d) => setWaiting(d.counts?.new || 0)).catch(() => setWaiting(0));
    if (isTeacher) api("/analytics/time").then((r) => setTime(r.items[0] || false)).catch(() => setTime(false));
  }, [isTeacher]);
  if (classes === null) return <div className="skeleton" style={{ height: 160 }} />;

  const students = classes.reduce((a, c) => a + c.students, 0);
  const ov = Object.values(att);
  const present = ov.reduce((a, x) => a + x.present, 0), total = ov.reduce((a, x) => a + x.total, 0);
  const stats = [["home", "", classes.length, tp.stats.classes], ["user", "purple", students, tp.stats.students],
    ["target", waiting ? "red" : "green", waiting ?? "…", tp.stats.waiting], ["checkc", "green", total ? `${present}/${total}` : "—", tp.stats.today]];
  const week = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  const quick = [["#/feed", "target", "red", tp.feed, waiting ? tp.waitingN(waiting) : tp.feed[1]],
    ...(isTeacher ? [["#/import", "doc", "", tp.import, tp.import[1]]] : []), ["#/pilot", "chart", "purple", tp.pilot, tp.pilot[1]]];

  return (
    <>
      <div className="grid g-4 stats" style={{ marginBottom: 20 }}>
        {stats.map(([icon, c, v, l]) => (
          <div className="card row" key={l}><Box icon={icon} c={c} /><div><div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="muted small">{l}</div></div></div>
        ))}
      </div>
      <div className="grid g-main">
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-head"><p className="card-title">{tp.classes}</p>{classes.length > 0 && <a href={isTeacher ? "#/" : "#/classes"} className="tlink">{tp.allClasses} <Icon n="chev" s={16} /></a>}</div>
          {classes.length ? classes.map((c) => {
            const a = att[c.id];
            return (
              <div key={c.id} className="list-item tc-class">
                <Box icon="home" size={40} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-strong">{c.name}</div>
                  <div className="muted small">{[c.grade ? tp.grade(c.grade) : null, c.subject, tp.students(c.students)].filter(Boolean).join(" · ")}</div>
                  {a && a.total > 0 && (
                    <div className="tc-att">
                      <span className="muted small">{tp.today(a.present, a.total)}</span>
                      <Bar p={(100 * a.present) / a.total} />
                      {a.rate != null && <span className="muted small">{tp.rate}: {Math.round(a.rate * 100)}%</span>}
                    </div>
                  )}
                  {isTeacher && c.code && <div className="muted small" style={{ marginTop: 6 }}>{tp.code}: <b className="tc-code">{c.code}</b></div>}
                </div>
                <a className="btn sm ghost" href={`#/class/${c.id}`}>{tp.open}</a>
              </div>
            );
          }) : (
            <><p className="muted small" style={{ margin: "0 0 12px" }}>{tp.noClasses}</p>{isTeacher && <a href="#/" className="btn sm">{tp.toClasses}</a>}</>
          )}
        </div>
        <div className="stack">
          {isTeacher && (
            <div className="card">
              <p className="card-title" style={{ marginBottom: 10 }}>{tp.time}</p>
              {time === null ? <div className="skeleton" style={{ height: 20 }} />
                : <p className="muted small" style={{ margin: "0 0 14px" }}>{time ? tp.timeLast(time.total, week(time.week)) : tp.timeNone}</p>}
              <a href="#/time" className="btn sm ghost"><Icon n="clock" s={16} /> {tp.timeGo}</a>
            </div>
          )}
          <div className="card">
            <p className="card-title" style={{ marginBottom: 6 }}>{tp.quick}</p>
            {quick.map(([href, icon, c, [title], sub]) => (
              <a key={href} href={href} className="list-item tc-quick">
                <Box icon={icon} c={c} size={36} />
                <div className="grow"><div className="t-strong">{title}</div><div className="muted small">{sub}</div></div>
                <Icon n="chev" s={18} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
