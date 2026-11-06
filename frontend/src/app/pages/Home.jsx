// Главная ученика: следующий шаг, план на сегодня, посещаемость, прогресс и быстрые ссылки.
// Все цифры — с бэкенда: /state/me, /plan/today, /plan/attendance, /content/subjects, /content/courses,
// /verification/checks, /auth/me/classes; счётчик олқылықтар — из /decisions/me (общий с меню и колокольчиком).
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Loading, Ring, useApp } from "../ui.jsx";
import { actionHref } from "./actions.js";
import { AttToday } from "../Attendance.jsx";
import { dateLongKk } from "../kk.js";
import SurveyCard from "../Survey.jsx";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function todayLabel(lang) {
  const d = new Date();
  return lang === "kk" ? dateLongKk(d) : cap(d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }));
}

export default function Home() {
  const { t, L, lang, user, startTest, alerts } = useApp();
  const [d, setD] = useState(null);
  const [checks, setChecks] = useState([]);
  const [classes, setClasses] = useState([]);
  const [plan, setPlan] = useState(null);
  const [att, setAtt] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [lessonMin, setLessonMin] = useState({}); // slug → минуты урока (для «≈ N минут»)
  useEffect(() => {
    api("/plan/attendance").then(setAtt).catch(() => {});
    api("/plan/today").then(setPlan).catch(() => {});
    api("/state/me").then(setD).catch(() => setD(false));
    api("/verification/checks").then((c) => setChecks(c.filter((x) => x.due))).catch(() => {});
    api("/auth/me/classes").then(setClasses).catch(() => {});
    api("/content/subjects").then(setSubjects).catch(() => {});
    api("/content/courses?subject=math").then((cs) => {
      const m = {};
      cs.forEach((c) => c.lessons.forEach((l) => { m[l.slug] = l.minutes; }));
      setLessonMin(m);
    }).catch(() => {});
  }, []);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const h = t.home;
  return (
    <div className="home">
      <p className="home-date">{todayLabel(lang)}</p>
      <h1>{t.greet(new Date().getHours())}, {user.name}</h1>
      <p className="subtitle">{h.sub}</p>

      {checks.length > 0 && (
        <div className="quiet-row amber">
          <Box icon="clock" c="orange" size={36} />
          <p className="grow"><b>{t.me.checksTitle}</b> · {t.me.checksText} · {checks.map((c) => L(c.lesson.title)).join(", ")}</p>
          <button className="tlink" onClick={() => startTest({ kind: "verification", check_id: checks[0].id })}>{h.checkGo}</button>
        </div>
      )}
      <SurveyCard quiet />

      <div className="home-grid top">
        <NextStep n={d.next} subject={subjects.find((s) => s.slug === "math") || subjects[0]} lessonMin={lessonMin} />
        <PlanCard plan={plan} />
      </div>

      <div className="home-grid">
        {att && <AttendanceCard att={att} />}
        <ProgressCard d={d} subjects={subjects} />
      </div>

      <div className="quick">
        <Quick href="#/tutor" icon="bot" c="purple" title={h.quick.tutor[0]} sub={h.quick.tutor[1]} />
        <Quick href="#/gaps" icon="target" c="red" title={h.quick.gaps[0]} sub={h.quick.gaps[1](alerts?.length || 0)} />
        <Quick href="#/diagnostics" icon="docchk" c="green" title={h.quick.diagnostics[0]} sub={h.quick.diagnostics[1]} />
      </div>

      <section className="hcard">
        <div className="hcard-head"><h2>{h.recs}</h2><a href="#/gaps" className="tlink">{h.allGaps} <Icon n="chev" s={16} /></a></div>
        {d.recommendations.length ? d.recommendations.slice(0, 4).map((r) => (
          <div className="list-item" key={r.lesson + r.action}>
            <span className={`dot ${r.skill_status || r.status}`} />
            <div className="grow"><div className="t-strong">{L(r.title)}</div>
              <div className="muted small">{t.actions[r.action][0]}{["accepted", "changed"].includes(r.status) ? ` · ${t.rec.byTeacher}` : ""}</div></div>
            <a className="tlink" href={actionHref(r)}>{t.open} <Icon n="chev" s={16} /></a>
          </div>
        )) : <p className="muted">{h.noRecs}</p>}
      </section>

      {classes.length > 0 && (
        <p className="home-classes muted">
          <b>{t.me.classes}:</b>{" "}
          {classes.map((c) => `${c.name} · ${t.me.teacher}: ${c.teacher || "—"}`).join("; ")}
        </p>
      )}
    </div>
  );
}

// «Келесі қадам» — главная карточка; единственная заливная кнопка на экране.
function NextStep({ n, subject, lessonMin }) {
  const { t, L, user } = useApp();
  const h = t.home;
  const [title, text] = t.actions[n.action] || t.actions.done;
  const lessonTitle = n.action === "prereq" ? L(n.target_title) : L(n.title);
  // длительность знаем только для урока (lesson / prereq); для теста, тьютора и т. п. — не показываем
  const slug = n.action === "prereq" ? n.target : n.action === "lesson" ? n.lesson : null;
  const minutes = slug ? lessonMin[slug] : null;
  return (
    <section className="hcard next">
      <p className="next-eyebrow"><b>{h.nextTitle}</b>{subject && <> · {L(subject.title)}</>} · {t.grade(user.grade)}</p>
      <h2 className="next-title">{title}</h2>
      {lessonTitle && <div className="topic-pill"><span className="topic-sym">{subject?.sym || "√x"}</span>{lessonTitle}</div>}
      <p className="next-text">{text}</p>
      {n.comment && n.status && n.status !== "new" && (
        <p className="why green"><Icon n="user" s={18} /><span><b>{t.rec.teacherNote}</b> {n.comment}</span></p>
      )}
      {n.cause && t.causeHelp[n.cause] && (
        <p className="why"><Icon n="info" s={18} /><span><b>{h.why}</b> {t.causeHelp[n.cause]}</span></p>
      )}
      {n.action !== "done" && (
        <div className="next-cta">
          <a href={actionHref(n)} className="btn primary">{t.start} <Icon n="arrow" s={18} /></a>
          {minutes > 0 && <span className="muted row" style={{ gap: 6 }}><Icon n="clock" s={16} />{h.minutes(minutes)}</span>}
        </div>
      )}
    </section>
  );
}

function PlanCard({ plan }) {
  const { t, L } = useApp();
  const h = t.home;
  const head = (
    <div className="hcard-head"><h2>{t.plan.title}</h2><a href="#/plan" className="tlink">{h.planOpen} <Icon n="chev" s={16} /></a></div>
  );
  if (!plan) return <section className="hcard">{head}<div className="skeleton" style={{ height: 120 }} /></section>;
  if (!plan.items.length) {
    return (
      <section className="hcard">{head}
        <p className="muted">{t.plan.empty}</p>
        <a href="#/diagnostics" className="tlink">{t.plan.toDiag} <Icon n="chev" s={16} /></a>
      </section>
    );
  }
  const cur = plan.items.findIndex((i) => i.status !== "done");
  return (
    <section className="hcard">
      {head}
      <p className="plan-big"><b>{plan.done_minutes}</b> <span>{h.planDone(plan.total_minutes)}</span></p>
      <Bar p={plan.total_minutes ? (100 * plan.done_minutes) / plan.total_minutes : 0} />
      {plan.goal?.total > 0 && <p className="muted small" style={{ margin: "10px 0 0" }}>{t.plan.goalDone(plan.goal.done, plan.goal.total)}</p>}
      <ul className="steps">
        {plan.items.map((i, k) => (
          <li key={i.id} className={i.status === "done" ? "done" : k === cur ? "cur" : ""}>
            <span className="step-mark" aria-hidden="true">{i.status === "done" && <Icon n="check" s={14} />}</span>
            <div className="grow">
              <div className="step-title">{t.plan.blocks[i.block] || i.block}</div>
              <div className="muted small">{L(i.title)}</div>
            </div>
            <span className="muted small">{t.plan.min(i.minutes)}</span>
            <span className="sr-only">{t.plan.status[i.status === "done" ? "done" : "pending"]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AttendanceCard({ att }) {
  const { t } = useApp();
  const h = t.home;
  const days = att.days.slice(-14);
  return (
    <section className="hcard">
      <div className="hcard-head"><h2>{t.att.title}</h2><a href="#/profile" className="tlink">{h.attMore} <Icon n="chev" s={16} /></a></div>
      <p className="att-big"><b>{att.rate == null ? "—" : `${Math.round(att.rate * 100)}%`}</b> <span>· {t.att.days(att.present, att.school_days)}</span></p>
      <div className="att-row-big">
        {days.map((x) => {
          const label = `${x.day.slice(8)}.${x.day.slice(5, 7)} · ${t.att.status[x.status]}`;
          return <span key={x.day} className={`att-sq ${x.status}`} title={label} aria-label={label} />;
        })}
      </div>
      <div className="att-legend2">
        {["present", "absent", "today"].map((k) => <span key={k}><i className={`lg ${k}`} />{h.legend[k]}</span>)}
      </div>
      <AttToday a={att} self />
    </section>
  );
}

function ProgressCard({ d, subjects }) {
  const { t, L } = useApp();
  const h = t.home;
  const p = d.progress;
  const wk = d.goal.target ? Math.min(100, Math.round((100 * d.goal.done) / d.goal.target)) : 0;
  return (
    <section className="hcard">
      <div className="hcard-head"><h2>{h.progress}</h2><a href="#/progress" className="tlink">{h.toProgress} <Icon n="chev" s={16} /></a></div>
      <div className="prog">
        <Ring p={p.percent} size={120} />
        <div className="grow prog-list">
          <div className="prog-row"><span>{h.masteredTopics}</span><b>{p.mastered} / {p.total}</b></div>
          {subjects.map((s) => (
            <div key={s.slug}>
              <div className="prog-row"><span>{L(s.title)}</span><b>{s.progress.percent}%</b></div>
              <Bar p={s.progress.percent} />
            </div>
          ))}
        </div>
      </div>
      <div className="prog-week">
        <div className="prog-row"><span>{h.week}</span><b>{wk}%</b></div>
        <Bar p={wk} />
        <div className="row between muted small" style={{ marginTop: 8 }}>
          <span>{h.weekText(d.goal.done, d.goal.target)}</span>
          {d.activity.streak > 0 && <span className="row" style={{ gap: 4, color: "var(--orange)" }}><Icon n="fire" s={14} />{h.streak(d.activity.streak)}</span>}
        </div>
      </div>
    </section>
  );
}

function Quick({ href, icon, c, title, sub }) {
  return (
    <a href={href} className="quick-link">
      <Box icon={icon} c={c} size={40} />
      <span className="grow"><b>{title}</b><span className="muted">{sub}</span></span>
      <Icon n="chev" s={18} />
    </a>
  );
}
