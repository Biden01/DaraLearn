import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, Icon, useApp } from "../ui.jsx";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const COLOR = { lesson: "", homework: "orange", test: "red", other: "green" };

export default function Calendar() {
  const { t, toast } = useApp();
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState("month");
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(null);
  const c = t.cal;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const start = view === "week" ? weekStart : (() => { const s = new Date(base); s.setDate(1 - ((base.getDay() + 6) % 7)); return s; })();
  const cells = [...Array(view === "week" ? 7 : 42)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const rangeEnd = new Date(Math.max(cells[cells.length - 1], new Date(now.getTime() + 14 * 864e5)));

  const load = () => api(`/school/calendar?start=${iso(cells[0] < now ? cells[0] : now)}&end=${iso(rangeEnd)}`).then(setEvents).catch(() => {});
  useEffect(() => { load(); }, [offset, view]);

  const byDay = (d) => events.filter((e) => e.day === iso(d));
  async function add(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await api("/school/calendar", { method: "POST", body: f }); setForm(null); toast(c.added); load(); } catch { toast(t.error); }
  }
  async function del(id) {
    try { await api(`/school/calendar/${id}`, { method: "DELETE" }); toast(c.deleted); load(); } catch { toast(t.error); }
  }
  const week = [...Array(7)].map((_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const upcoming = events.filter((e) => e.day >= iso(now)).slice(0, 5);
  return (
    <>
      <Crumb items={[[t.nav.calendar]]} />
      <div className="page-head">
        <div><h1>{c.title}</h1><p className="subtitle">{c.sub}</p></div>
        <button className="btn" onClick={() => setForm({ day: iso(now) })}><Icon n="plus" s={18} /> {c.add}</button>
      </div>
      {form && (
        <form className="card" style={{ marginBottom: 20 }} onSubmit={add}>
          <div className="grid g-4" style={{ alignItems: "end" }}>
            <label className="field">{c.form.title}<input name="title" required maxLength={200} autoFocus /></label>
            <label className="field">{c.form.day}<input name="day" type="date" required defaultValue={form.day} /></label>
            <label className="field">{c.form.time}<input name="time" type="time" /></label>
            <label className="field">{c.form.kind}<select name="kind">{Object.entries(c.kinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <div className="row" style={{ marginTop: 14 }}><button className="btn">{t.save}</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>{t.cancel}</button></div>
        </form>
      )}
      <div className="grid g-main">
        <div className="card">
          <div className="card-head wrap">
            <div className="row">
              <button className="btn ghost sm" aria-label="‹" onClick={() => { setView("month"); setOffset(offset - 1); }}>‹</button>
              <p className="card-title" style={{ minWidth: 140, textAlign: "center" }}>{c.months[base.getMonth()]} {base.getFullYear()}</p>
              <button className="btn ghost sm" aria-label="›" onClick={() => { setView("month"); setOffset(offset + 1); }}>›</button>
            </div>
            <div className="row">
              <div className="tabs">
                <button className={view === "month" ? "on" : ""} onClick={() => setView("month")}>{c.month}</button>
                <button className={view === "week" ? "on" : ""} onClick={() => { setView("week"); setOffset(0); }}>{c.week}</button>
              </div>
              <button className="btn ghost sm" onClick={() => { setOffset(0); }}>{c.today}</button>
            </div>
          </div>
          <div className="cal">
            {t.progress.dow.map((d) => <div className="dow" key={d}>{d}</div>)}
            {cells.map((d) => (
              <div key={iso(d)} className={`day ${view === "month" && d.getMonth() !== base.getMonth() ? "out" : ""} ${iso(d) === iso(now) ? "today" : ""}`}
                style={view === "week" ? { minHeight: 220 } : undefined} onDoubleClick={() => setForm({ day: iso(d) })}>
                <span className="n">{d.getDate()}</span>
                {byDay(d).map((e) => <span key={e.id} className={`ev ${COLOR[e.kind]}`}>{e.title}{e.time && <><br />{e.time}</>}</span>)}
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><p className="card-title">{c.weekPlan}</p></div>
            {week.map((d, i) => {
              const evs = byDay(d);
              return (
                <div className="list-item" key={iso(d)}>
                  <div style={{ width: 34, textAlign: "center" }}><div className="muted small">{t.progress.dow[i]}</div><b>{d.getDate()}</b></div>
                  <div className="grow">
                    {evs.length ? evs.map((e) => <div key={e.id} className="t-strong small">{e.title} <span className="muted">{e.time}</span></div>)
                      : <><div className="muted small">{c.free}</div><button className="link small" onClick={() => setForm({ day: iso(d) })}>+ {c.add}</button></>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card">
            <div className="card-head"><p className="card-title">{c.upcoming}</p></div>
            {upcoming.length ? upcoming.map((e) => (
              <div className="list-item" key={e.id}>
                <Box sym="!" c={COLOR[e.kind]} size={34} />
                <div className="grow"><div className="t-strong small">{e.title}</div><div className="muted small">{c.kinds[e.kind]} · {e.day.slice(8)}.{e.day.slice(5, 7)} {e.time}</div></div>
                <button className="link" aria-label={t.del} onClick={() => del(e.id)}><Icon n="trash" s={16} /></button>
              </div>
            )) : <p className="muted small">{c.none}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
