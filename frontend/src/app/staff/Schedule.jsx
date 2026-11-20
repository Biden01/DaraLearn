// Расписание учителя: недельная сетка уроков его классов, итог уроков и часов в неделю, добавление и удаление уроков.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, Icon, Loading, useApp } from "../ui.jsx";

const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const fromMin = (x) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
const hours = (min) => Math.round((min / 60) * 10) / 10;

export default function Schedule() {
  const { t, toast } = useApp();
  const s = t.sched;
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const load = () => api("/school/schedule").then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
    api("/school/classes").then(setClasses).catch(() => setClasses([]));
  }, []);
  if (rows === null) return <Loading />;

  const now = new Date();
  const today = (now.getDay() + 6) % 7; // 0 — понедельник
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const totalMin = rows.reduce((a, x) => a + x.minutes, 0);
  const todayRows = rows.filter((x) => x.weekday === today);
  const next = todayRows.find((x) => toMin(x.start) + x.minutes > nowMin);
  const byClass = Object.values(rows.reduce((acc, x) => {
    const k = acc[x.class_id] || (acc[x.class_id] = { name: x.class_name, n: 0, min: 0 });
    k.n += 1; k.min += x.minutes;
    return acc;
  }, {})).sort((a, b) => b.min - a.min);

  async function add(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const body = { class_id: Number(f.class_id), weekday: Number(f.weekday), start: f.start, minutes: Number(f.minutes) || 45, room: f.room || "" };
    try {
      await api("/school/schedule", { method: "POST", body });
      toast(s.added);
      e.target.querySelector("[name=start]").value = "";
      e.target.querySelector("[name=room]").value = "";
      load();
    } catch (ex) { toast(ex.code === "overlap" ? s.overlap : t.error); }
  }
  async function remove(id) {
    try { await api(`/school/schedule/${id}`, { method: "DELETE" }); load(); } catch { toast(t.error); }
  }

  const stats = [["clip", "", rows.length, s.stats.lessons], ["clock", "orange", s.hours(hours(totalMin)), s.stats.hours],
    ["home", "purple", byClass.length, s.stats.classes],
    ["cal", "green", todayRows.length, s.stats.today, todayRows.length ? (next ? s.nextAt(next.start) : "") : s.noneToday]];

  return (
    <div className="sched-page">
      <Crumb items={[[s.title]]} />
      <h1>{s.title}</h1>
      <p className="subtitle">{s.sub}</p>

      <div className="grid g-4 stats" style={{ marginBottom: 20 }}>
        {stats.map(([icon, c, v, l, hint]) => (
          <div className="card row" key={l}><Box icon={icon} c={c} />
            <div><div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="muted small">{l}</div>
              {hint && <div className="muted small">{hint}</div>}</div></div>
        ))}
      </div>

      {!classes.length && !rows.length ? <p className="note">{s.noClasses}</p> : (
        <>
          <div className="sched-week">
            {s.days.map((day, d) => {
              const list = rows.filter((x) => x.weekday === d);
              const dayMin = list.reduce((a, x) => a + x.minutes, 0);
              return (
                <section key={d} className={`sched-day ${d === today ? "today" : ""}`} aria-label={day}>
                  <header>
                    <b><span className="hide-sm">{day}</span><span className="show-sm">{s.short[d]}</span></b>
                    {list.length > 0 && <span className="muted small">{s.lessonsN(list.length)} · {s.hours(hours(dayMin))}</span>}
                  </header>
                  {list.length ? list.map((x) => {
                    const live = d === today && toMin(x.start) <= nowMin && nowMin < toMin(x.start) + x.minutes;
                    return (
                      <div key={x.id} className={`sched-lesson ${live ? "live" : ""}`}>
                        <div className="sched-time">{x.start}–{fromMin(toMin(x.start) + x.minutes)}</div>
                        <div className="sched-class">{x.class_name}</div>
                        <div className="muted small">{[t.plan.min(x.minutes), x.room && s.roomShort(x.room)].filter(Boolean).join(" · ")}</div>
                        <button className="sched-x" onClick={() => remove(x.id)} aria-label={`${s.remove}: ${x.class_name} ${x.start}`} title={s.remove}>
                          <Icon n="x" s={14} />
                        </button>
                      </div>
                    );
                  }) : <p className="muted small sched-empty">{s.empty}</p>}
                </section>
              );
            })}
          </div>
          {!rows.length && <p className="muted" style={{ margin: "0 0 20px" }}>{s.noLessons}</p>}

          <div className="grid g-main">
            {classes.length > 0 && (
              <form className="card sched-form" onSubmit={add}>
                <p className="card-title" style={{ marginBottom: 14 }}>{s.add}</p>
                <div className="sched-fields">
                  <label className="field">{s.klass}
                    <select name="class_id" required>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label className="field">{s.day}
                    <select name="weekday" defaultValue={Math.min(today, 5)}>{s.days.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>
                  <label className="field">{s.start}<input name="start" type="time" required min="07:00" max="21:00" /></label>
                  <label className="field">{s.minutes}<input name="minutes" type="number" min={20} max={120} defaultValue={45} /></label>
                  <label className="field">{s.room}<input name="room" maxLength={30} /></label>
                </div>
                <button className="btn" type="submit"><Icon n="plus" s={18} /> {s.save}</button>
              </form>
            )}
            <div className="card" style={{ alignSelf: "start" }}>
              <p className="card-title" style={{ marginBottom: 8 }}>{s.byClass}</p>
              {byClass.map((k) => (
                <div key={k.name} className="row between sched-sum"><span>{k.name}</span>
                  <span className="muted">{s.lessonsN(k.n)} · <b>{s.hours(hours(k.min))}</b></span></div>
              ))}
              <div className="row between sched-sum total"><b>{s.total}</b>
                <span>{s.lessonsN(rows.length)} · <b>{s.hours(hours(totalMin))}</b></span></div>
              <p className="muted small" style={{ margin: "10px 0 0" }}>{s.hourHelp}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
