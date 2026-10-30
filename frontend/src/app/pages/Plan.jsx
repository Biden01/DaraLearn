import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Loading, Ring, useApp } from "../ui.jsx";

const ICON = { tutor: "bot", practice: "target", check: "lock" };
export const TOPIC_DOT = { done: "mastered", learning: "learning", todo: "gap" };

const locale = (lang) => (lang === "kk" ? "kk-KZ" : "ru-RU");
export const dayLabel = (iso, lang, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(locale(lang), opts);

export function monthName(iso, lang) {
  const m = new Date(`${iso}T00:00:00`).toLocaleString(locale(lang), { month: "long" });
  return lang === "kk" ? m.charAt(0).toUpperCase() + m.slice(1) : m;
}

// Перейти к следующему невыполненному шагу плана на сегодня.
const goTo = (id) => document.getElementById(id ? `step-${id}` : "today-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function Plan() {
  const { t, L, lang, toast } = useApp();
  const [plan, setPlan] = useState(null);
  const p = t.plan;
  const load = () => api("/plan/today").then(setPlan).catch(() => setPlan(false));
  useEffect(() => { load(); }, []);
  if (plan === null) return <Loading />;
  if (plan === false) return <p className="muted">{p.error}</p>;

  const pct = Math.round((100 * plan.done_minutes) / plan.total_minutes);
  const allDone = plan.items.length > 0 && plan.items.every((i) => i.status === "done");
  const pending = plan.items.filter((i) => i.status !== "done");
  const steps = { done: plan.items.length - pending.length, total: plan.items.length, next: pending[0]?.id };
  return (
    <>
      {plan.goal && <Goal goal={plan.goal} today={plan.items.find((i) => i.block === "tutor")?.lesson} steps={steps} L={L} lang={lang} p={p} />}
      <h1 id="today-plan" style={{ scrollMarginTop: 16 }}>{p.title}</h1>
      <p className="subtitle">{p.sub(plan.total_minutes)}</p>
      <div className="card row wrap" style={{ gap: 22, marginBottom: 20 }}>
        <Ring p={pct} size={84} />
        <div className="grow" style={{ minWidth: 220 }}>
          <div className="t-strong" style={{ marginBottom: 8 }}>{allDone ? p.allDone : p.done(plan.done_minutes, plan.total_minutes)}</div>
          <Bar p={pct} />
        </div>
      </div>
      {plan.items.length === 0 && (
        <div className="card"><p className="muted">{p.empty}</p><a href="#/diagnostics" className="btn">{p.toDiag}</a></div>
      )}
      <div className="stack">
        {plan.items.map((item) => (
          <Block key={item.id} item={item} isNext={item.id === steps.next} after={(pending.find((i) => i.order > item.order) || pending[0])?.id}
            onChange={load} toast={toast} L={L} p={p} t={t} />
        ))}
      </div>
    </>
  );
}

// Цель месяца к ПҚС: ученик видит только её, темы и их состояние — без разбивки по неделям.
function Goal({ goal, today, steps, L, lang, p }) {
  const pct = goal.total ? Math.round((100 * goal.done) / goal.total) : 0;
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="row wrap" style={{ gap: 22, marginBottom: 14 }}>
        <Ring p={pct} size={72} />
        <div className="grow" style={{ minWidth: 220 }}>
          <h2 style={{ margin: "0 0 4px" }}>{p.goal(monthName(goal.month, lang))}</h2>
          <p className="muted small" style={{ margin: "0 0 8px" }}>{p.goalSub}</p>
          <div className="t-strong small">{goal.total && goal.done === goal.total ? p.goalAll : p.goalDone(goal.done, goal.total)}</div>
        </div>
      </div>
      {goal.topics.length === 0 && <p className="muted small" style={{ margin: 0 }}>{p.goalEmpty}</p>}
      {goal.topics.map((x) => (
        <div className="list-item" key={x.lesson}>
          <span className={`dot ${TOPIC_DOT[x.status]}`} />
          <div className="grow small" style={{ fontWeight: 600 }}>{L(x.title)}</div>
          {x.lesson === today && x.status !== "done" && <span className="badge orange">{p.today}</span>}
          <span className={`small st-${TOPIC_DOT[x.status]}`}>{p.topic[x.status]}</span>
        </div>
      ))}
      {goal.days?.length > 0 && <Days goal={goal} steps={steps} L={L} lang={lang} p={p} />}
    </div>
  );
}

const DAY_BADGE = { today: "orange", done: "green", missed: "red" };

// Темы по дням: с сегодняшнего дня до конца месяца; прошедшие дни — по кнопке.
function Days({ goal, steps, L, lang, p }) {
  const [past, setPast] = useState(false);
  const title = Object.fromEntries(goal.topics.map((x) => [x.lesson, x.title]));
  const status = Object.fromEntries(goal.topics.map((x) => [x.lesson, x.status]));
  const nPast = goal.days.filter((d) => d.state === "done" || d.state === "missed").length;
  const shown = past ? goal.days : goal.days.slice(nPast);
  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 14 }}>
      <div className="row between wrap" style={{ gap: 8, marginBottom: 6 }}>
        <p className="card-title" style={{ margin: 0 }}>{p.byDay}</p>
        {nPast > 0 && <button className="link small" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setPast(!past)}>{past ? p.hidePast : p.showPast(nPast)}</button>}
      </div>
      {shown.map((d) => (
        <div className="list-item" key={d.day} style={d.state === "today" ? { background: "var(--amber-soft)", borderRadius: 8 } : undefined}>
          <span className="small muted" style={{ width: 110, flex: "none" }}>{dayLabel(d.day, lang)}</span>
          <div className="grow small" style={{ fontWeight: d.state === "today" ? 700 : 500 }}>
            {d.topics.length ? d.topics.map((s) => (
              <span key={s} className="row" style={{ gap: 6, display: "inline-flex", marginRight: 12 }}>
                <span className={`dot ${TOPIC_DOT[status[s]]}`} />{L(title[s])}
              </span>
            )) : <span className="muted">{p.review}</span>}
          </div>
          {d.state === "today" && steps.total > 0 ? <Today steps={steps} p={p} />
            : DAY_BADGE[d.state] && <span className={`badge ${DAY_BADGE[d.state]}`}>{p.day[d.state]}</span>}
        </div>
      ))}
    </div>
  );
}

// Сегодняшний день в расписании: сколько шагов сделано и кнопка к следующему.
function Today({ steps, p }) {
  if (steps.done === steps.total) return <span className="badge green"><Icon n="check" s={12} /> {p.day.done}</span>;
  return (
    <div className="row" style={{ gap: 10, flex: "none" }}>
      <span className="muted small">{p.steps(steps.done, steps.total)}</span>
      <button className="btn sm" onClick={() => goTo(steps.next)}>{steps.done ? p.cont : p.go} <Icon n="arrow" s={14} /></button>
    </div>
  );
}

function Block({ item, isNext, after, onChange, toast, L, p, t }) {
  const [picked, setPicked] = useState({});    // task_id -> выбранный вариант
  const [shown, setShown] = useState({});      // task_id -> {correct, answer, explanation} (только практика)
  const done = item.status === "done";

  async function choose(task, j) {
    if (item.answered.includes(task.id) || picked[task.id] !== undefined) return;
    setPicked((x) => ({ ...x, [task.id]: j }));
    try {
      const r = await api(`/plan/items/${item.id}/answer`, { method: "POST", body: { task_id: task.id, choice: j } });
      if (r.correct !== null) setShown((x) => ({ ...x, [task.id]: r }));
      if (r.item_status === "done") onChange();
    } catch (e) {
      setPicked((x) => { const { [task.id]: _, ...rest } = x; return rest; });
      toast(e.status === 409 ? p.answered : t.error);
    }
  }

  return (
    <div className="card" id={`step-${item.id}`}
      style={{ scrollMarginTop: 16, ...(done ? { opacity: 0.85 } : isNext ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : {}) }}>
      <div className="row between wrap" style={{ gap: 12, marginBottom: 6 }}>
        <div className="row" style={{ gap: 12 }}>
          <Box icon={ICON[item.block]} />
          <div>
            <div className="card-title" style={{ margin: 0 }}>{p.blocks[item.block]}</div>
            <div className="muted small">{L(item.title)} · {p.min(item.minutes)}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {isNext && <span className="badge orange">{p.next}</span>}
          {item.reason !== "current" && <span className="badge orange">{p.reason[item.reason]}</span>}
          <span className={`badge ${done ? "green" : "gray"}`}>{done && <Icon n="check" s={12} />} {p.status[item.status]}</span>
        </div>
      </div>
      <p className="muted small" style={{ margin: "4px 0 14px" }}>{p.hint[item.block]}</p>
      {item.block === "tutor" ? (
        !done && <a href={`#/tutor?lesson=${item.lesson}`} className="btn">{p.open} <Icon n="arrow" s={16} /></a>
      ) : (
        item.tasks.map((task, i) => {
          const was = item.answered.includes(task.id);
          const mine = picked[task.id];
          const res = shown[task.id];
          return (
            <div className="task" key={task.id}>
              <div className="q">{i + 1}. {L(task.question)}</div>
              <div className="opts">
                {task.options.map((o, j) => (
                  <button key={j} disabled={was || mine !== undefined}
                    className={res ? (j === res.answer ? "right" : j === mine ? "wrong" : "") : mine === j ? "right" : ""}
                    onClick={() => choose(task, j)}>{L(o)}</button>
                ))}
              </div>
              {res && !res.correct && <div className="feedback">{L(res.explanation)}</div>}
              {was && mine === undefined && <div className="muted small" style={{ marginTop: 8 }}>{p.answered}</div>}
            </div>
          );
        })
      )}
      {item.block === "check" && done && <p className="note" style={{ margin: "8px 0 0" }}>{p.checkSaved}</p>}
      {done && after && <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => goTo(after)}>{p.onward} <Icon n="arrow" s={14} /></button>}
    </div>
  );
}
