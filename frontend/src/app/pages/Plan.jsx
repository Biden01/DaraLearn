import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Icon, Loading, Ring, useApp } from "../ui.jsx";

const ICON = { tutor: "bot", practice: "target", check: "lock" };
export const TOPIC_DOT = { done: "mastered", learning: "learning", todo: "gap" };

export function monthName(iso, lang) {
  const m = new Date(`${iso}T00:00:00`).toLocaleString(lang === "kk" ? "kk-KZ" : "ru-RU", { month: "long" });
  return lang === "kk" ? m.charAt(0).toUpperCase() + m.slice(1) : m;
}

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
  return (
    <>
      {plan.goal && <Goal goal={plan.goal} today={plan.items.find((i) => i.block === "tutor")?.lesson} L={L} lang={lang} p={p} />}
      <h1>{p.title}</h1>
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
        {plan.items.map((item) => <Block key={item.id} item={item} onChange={load} toast={toast} L={L} p={p} t={t} />)}
      </div>
    </>
  );
}

// Цель месяца к ПҚС: ученик видит только её, темы и их состояние — без разбивки по неделям.
function Goal({ goal, today, L, lang, p }) {
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
    </div>
  );
}

function Block({ item, onChange, toast, L, p, t }) {
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
    <div className="card" style={done ? { opacity: 0.85 } : undefined}>
      <div className="row between wrap" style={{ gap: 12, marginBottom: 6 }}>
        <div className="row" style={{ gap: 12 }}>
          <Box icon={ICON[item.block]} />
          <div>
            <div className="card-title" style={{ margin: 0 }}>{p.blocks[item.block]}</div>
            <div className="muted small">{L(item.title)} · {p.min(item.minutes)}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
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
    </div>
  );
}
