// «План на сегодня»: карточка «Сегодня» (шаги с заданиями), лента недели, цель месяца.
// Все данные — из /plan/today: шаги плана на сегодня (items) и цель месяца с расписанием тем по дням (goal.days).
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Icon, Loading, Ring, fox, useApp } from "../ui.jsx";
import { dateKk, dateLongKk, monthKk } from "../kk.js";

export const TOPIC_DOT = { done: "mastered", learning: "learning", todo: "gap" };

export const dayLabel = (iso, lang, opts = { weekday: "short", day: "numeric", month: "short" }) => {
  const d = new Date(`${iso}T00:00:00`);
  return lang === "kk" ? dateKk(d, opts) : d.toLocaleDateString("ru-RU", opts);
};

export function monthName(iso, lang) {
  const d = new Date(`${iso}T00:00:00`);
  if (lang !== "kk") return d.toLocaleString("ru-RU", { month: "long" });
  const m = monthKk(d);
  return m.charAt(0).toUpperCase() + m.slice(1);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const longDay = (iso, lang) => {
  const d = new Date(`${iso}T00:00:00`);
  return lang === "kk" ? dateLongKk(d) : cap(d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }));
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const monday = (s) => { const d = new Date(`${s}T00:00:00`); return addDays(s, -((d.getDay() + 6) % 7)); };

// статус темы для ученика → класс цвета (Впереди серый, В работе янтарный, Закрыто зелёный)
const PS = { todo: "todo", learning: "learning", done: "done" };

export default function Plan() {
  const { t, lang } = useApp();
  const [plan, setPlan] = useState(null);
  const [sel, setSel] = useState(null);      // выбранный день в ленте недели
  const p = t.plan;
  const load = () => api("/plan/today").then(setPlan).catch(() => setPlan(false));
  useEffect(() => { load(); }, []);
  if (plan === null) return <Loading />;
  if (plan === false) return <p className="muted">{p.error}</p>;

  const goal = plan.goal;
  const tutor = plan.items.find((i) => i.block === "tutor");
  const pickDay = (d) => { setSel(d); setTimeout(() => document.getElementById("pl-week")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };
  return (
    <div className="home plan-page">
      <p className="home-date">{longDay(plan.day, lang)}</p>
      <h1>{p.title}</h1>
      <p className="subtitle">{fox(p.sub(plan.total_minutes))}</p>

      {plan.items.length === 0 ? (
        <section className="hcard">
          <p className="muted" style={{ marginTop: 0 }}>{p.empty}</p>
          <a href="#/diagnostics" className="btn primary">{p.toDiag} <Icon n="arrow" s={18} /></a>
        </section>
      ) : <TodayCard plan={plan} goal={goal} onChange={load} onTomorrow={pickDay} />}

      {goal?.days?.length > 0 && <Week plan={plan} goal={goal} sel={sel || plan.day} setSel={setSel} />}
      {goal && <GoalCard goal={goal} todayLesson={tutor?.lesson} />}
    </div>
  );
}

// ---------- 1. Сегодня: тема дня, прогресс, шаги чек-листом; единственная заливная кнопка ----------
function TodayCard({ plan, goal, onChange, onTomorrow }) {
  const { t, L } = useApp();
  const p = t.plan;
  const items = plan.items;
  const pending = items.filter((i) => i.status !== "done");
  const next = pending[0];
  const [open, setOpen] = useState(null);    // id раскрытого шага
  const allDone = pending.length === 0;
  const tutor = items.find((i) => i.block === "tutor") || items[0];
  const topicStatus = goal?.topics.find((x) => x.lesson === tutor.lesson)?.status;
  const nDone = items.length - pending.length;
  const leftMin = pending.reduce((s, i) => s + i.minutes, 0);
  const tomorrow = goal?.days?.find((d) => d.day === addDays(plan.day, 1));
  const titles = Object.fromEntries((goal?.topics || []).map((x) => [x.lesson, x.title]));

  const show = (id) => {
    setOpen(id);
    setTimeout(() => document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const go = () => {
    if (!next) return;
    if (next.block === "tutor") { location.hash = `#/tutor?lesson=${next.lesson}`; return; }
    show(next.id);
  };

  return (
    <section className="hcard pl-today" aria-labelledby="pl-today-h">
      <p className="next-eyebrow"><b>{p.today}</b> · {p.topicOfDay}</p>
      <div className="pl-topic">
        <h2 id="pl-today-h" className="next-title">{L(tutor.title)}</h2>
        <div className="pl-pills">
          {topicStatus && <span className={`pill ${PS[topicStatus]}`}>{p.topic[topicStatus]}</span>}
          {tutor.reason !== "current" && <span className="pill info"><Icon n="info" s={13} /> {p.reason[tutor.reason]}</span>}
        </div>
      </div>

      {allDone ? (
        <div className="pl-done">
          <span className="pl-done-ico"><Icon n="check" s={22} /></span>
          <div className="grow">
            <b>{p.doneTitle}</b>
            <span className="muted">{p.doneSub}</span>
          </div>
          {tomorrow && (
            <button className="tlink" onClick={() => onTomorrow(tomorrow.day)}>
              {p.tomorrow}: {tomorrow.topics.length ? tomorrow.topics.map((s) => L(titles[s])).join(", ") : p.review} <Icon n="chev" s={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="pl-prog">
          <div className="pl-prog-row">
            <span><b>{p.steps(nDone, items.length)}</b></span>
            <span className="muted">{p.done(plan.done_minutes, plan.total_minutes)}</span>
          </div>
          <Bar p={Math.round((100 * nDone) / items.length)} />
        </div>
      )}

      <ul className="pl-steps">
        {items.map((it) => {
          const done = it.status === "done";
          const cur = it.id === next?.id;
          const isOpen = open === it.id;
          return (
            <li key={it.id} id={`step-${it.id}`} className={`${done ? "done" : ""} ${cur ? "cur" : ""} ${isOpen ? "open" : ""}`}>
              <button className="pl-step" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : it.id)}>
                <span className="step-mark">{done && <Icon n="check" s={13} />}</span>
                <span className="grow pl-step-text">
                  <span className="step-title">{fox(p.blocks[it.block])}</span>
                  <span className="pl-step-sub">{L(it.title)}{cur && <> · <em>{p.next}</em></>}</span>
                </span>
                <span className="pl-min">{p.min(it.minutes)}</span>
                <Icon n="chev" s={16} />
              </button>
              {isOpen && <StepBody item={it} after={pending.find((i) => i.order > it.order) || pending[0]}
                onChange={onChange} onAfter={(a) => (a.block === "tutor" ? (location.hash = `#/tutor?lesson=${a.lesson}`) : show(a.id))} />}
            </li>
          );
        })}
      </ul>

      {!allDone && (
        <div className="next-cta">
          <button className="btn primary" onClick={go}>{nDone ? p.contPlan : p.start} <Icon n="arrow" s={18} /></button>
          <span className="muted row" style={{ gap: 6 }}><Icon n="clock" s={16} />{p.approx(leftMin)}</span>
        </div>
      )}
    </section>
  );
}

// Содержимое шага: занятие с Tutor — ссылка; закрепление и проверка — задания с ответами прямо здесь.
function StepBody({ item, after, onChange, onAfter }) {
  const { t, L, toast } = useApp();
  const p = t.plan;
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
    <div className="pl-body">
      <p className="muted" style={{ margin: "0 0 12px" }}>{p.hint[item.block]}</p>
      {item.block === "tutor" ? (
        !done && <a href={`#/tutor?lesson=${item.lesson}`} className="btn ghost sm">{p.open} <Icon n="arrow" s={16} /></a>
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
      {done && after && <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => onAfter(after)}>{p.onward} <Icon n="arrow" s={14} /></button>}
    </div>
  );
}

// ---------- 2. Эта неделя: лента из 7 дней, клик раскрывает день; стрелками — другие недели месяца ----------
function Week({ plan, goal, sel, setSel }) {
  const { t, L, lang } = useApp();
  const p = t.plan;
  const [start, setStart] = useState(() => monday(sel));
  const [past, setPast] = useState(false);
  useEffect(() => { setStart(monday(sel)); }, [sel]);
  const byDay = Object.fromEntries(goal.days.map((d) => [d.day, d]));
  const status = Object.fromEntries(goal.topics.map((x) => [x.lesson, x.status]));
  const title = Object.fromEntries(goal.topics.map((x) => [x.lesson, x.title]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const first = goal.days[0].day, last = goal.days[goal.days.length - 1].day;
  const pastDays = goal.days.filter((d) => d.state === "done" || d.state === "missed");
  const d = byDay[sel];

  const topics = (x) => x.topics.length ? x.topics.map((s) => (
    <span key={s} className="pl-tp"><span className={`pdot ${PS[status[s]]}`} />{L(title[s])}</span>
  )) : <span className="muted">{p.review}</span>;

  return (
    <section className="hcard pl-week" id="pl-week" aria-labelledby="pl-week-h">
      <div className="hcard-head">
        <h2 id="pl-week-h">{start <= plan.day && plan.day <= addDays(start, 6) ? p.thisWeek : `${dayLabel(start, lang, { day: "numeric", month: "short" })} – ${dayLabel(addDays(start, 6), lang, { day: "numeric", month: "short" })}`}</h2>
        <div className="row" style={{ gap: 4 }}>
          {pastDays.length > 0 && <button className="tlink" aria-expanded={past} onClick={() => setPast(!past)}>{past ? p.hidePast : p.pastDays(pastDays.length)}</button>}
          <button className="pl-arrow" aria-label={p.prevWeek} disabled={start <= monday(first)} onClick={() => setStart(addDays(start, -7))}><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon n="chev" s={16} /></span></button>
          <button className="pl-arrow" aria-label={p.nextWeek} disabled={addDays(start, 7) > last} onClick={() => setStart(addDays(start, 7))}><Icon n="chev" s={16} /></button>
        </div>
      </div>

      <div className="pl-strip" role="listbox" aria-label={p.thisWeek}>
        {week.map((day, i) => {
          const x = byDay[day];
          const dot = x?.topics.length ? PS[status[x.topics[0]]] : null;
          const cls = ["pl-day", day === plan.day && "today", day < plan.day && "past", x?.state === "done" && "ok",
            x?.state === "missed" && "missed", day === sel && "sel", !x && "nodata"].filter(Boolean).join(" ");
          return (
            <button key={day} role="option" aria-selected={day === sel} className={cls} onClick={() => setSel(day)}>
              <span className="pl-dow">{t.att.week[i]}</span>
              <span className="pl-num">{Number(day.slice(8))}</span>
              <span className="pl-mark">
                {x?.state === "done" ? <Icon n="check" s={12} /> : x?.state === "missed" ? <span className="pdot missed" />
                  : dot ? <span className={`pdot ${dot}`} /> : x ? <span className="pdot review" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pl-daybox">
        <div className="row between wrap" style={{ gap: 8, marginBottom: 10 }}>
          <b>{longDay(sel, lang)}</b>
          {d && <span className={`pill ${d.state === "today" ? "today" : d.state === "done" ? "done" : d.state === "missed" ? "missed" : "todo"}`}>
            {d.state === "upcoming" ? p.upcoming : p.day[d.state]}</span>}
        </div>
        {!d ? <p className="muted" style={{ margin: 0 }}>{p.noData}</p> : (
          <>
            <div className="pl-tps">{topics(d)}</div>
            {d.state === "today" ? (
              <ul className="pl-mini">
                {plan.items.map((it) => (
                  <li key={it.id} className={it.status === "done" ? "done" : ""}>
                    <span className="step-mark">{it.status === "done" && <Icon n="check" s={11} />}</span>
                    <span className="grow">{fox(p.blocks[it.block])} · {L(it.title)}</span><span className="pl-min">{p.min(it.minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted small" style={{ margin: "10px 0 0" }}>{d.state === "upcoming" ? p.futureSteps : p.pastSteps}</p>}
          </>
        )}
      </div>

      {past && (
        <div className="pl-past">
          {pastDays.map((x) => (
            <button key={x.day} className="pl-row" onClick={() => setSel(x.day)}>
              <span className="pl-row-date">{dayLabel(x.day, lang)}</span>
              <span className="grow pl-tps">{topics(x)}</span>
              <span className={`pill ${x.state === "done" ? "done" : "missed"}`}>{p.day[x.state]}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- 3. Цель на месяц: компактно, первые 4 темы ----------
function GoalCard({ goal, todayLesson }) {
  const { t, L, lang } = useApp();
  const p = t.plan;
  const [all, setAll] = useState(false);
  const pct = goal.total ? Math.round((100 * goal.done) / goal.total) : 0;
  const shown = all ? goal.topics : goal.topics.slice(0, 4);
  return (
    <section className="hcard pl-goal" aria-labelledby="pl-goal-h">
      <div className="pl-goal-head">
        <Ring p={pct} size={64} />
        <div className="grow" style={{ minWidth: 0 }}>
          <h2 id="pl-goal-h">{p.goal(monthName(goal.month, lang))}</h2>
          <div className="pl-goal-count">{goal.total && goal.done === goal.total ? p.goalAll : p.goalDone(goal.done, goal.total)}</div>
          <p className="muted" style={{ margin: "2px 0 0" }}>{p.goalSub}</p>
        </div>
      </div>
      {goal.topics.length === 0 && <p className="muted" style={{ margin: 0 }}>{p.goalEmpty}</p>}
      <div className="pl-list">
        {shown.map((x) => (
          <div className="pl-row static" key={x.lesson}>
            <span className={`pdot ${PS[x.status]}`} />
            <span className="grow pl-name">{L(x.title)}</span>
            {x.lesson === todayLesson && x.status !== "done" && <span className="pill today">{p.today}</span>}
            <span className={`pl-st ${PS[x.status]}`}>{p.topic[x.status]}</span>
          </div>
        ))}
      </div>
      {goal.topics.length > 4 && (
        <button className="tlink pl-more" aria-expanded={all} onClick={() => setAll(!all)}>{all ? p.collapse : p.showAll(goal.topics.length)}</button>
      )}
    </section>
  );
}
