// Учитель: минуты в неделю на проверку работ и разбор ошибок — до DaraLearn и с ним. Плюс опрос удобства.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";
import SurveyCard from "../Survey.jsx";

const dm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monday = (iso) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
const weekLabel = (w) => `${dm(w)}–${dm(addDays(w, 6))}`;
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export default function TeacherTime() {
  const { t, toast } = useApp();
  const k = t.time;
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const blank = (week, phase) => ({ week, phase, check_minutes: "", review_minutes: "", note: "" });
  const fromItem = (x) => ({ week: x.week, phase: x.phase, check_minutes: x.check_minutes, review_minutes: x.review_minutes, note: x.note });
  const load = () => api("/analytics/time").then((r) => {
    setD(r);
    setF((cur) => cur || (r.items.find((x) => x.week === r.week) ? fromItem(r.items.find((x) => x.week === r.week)) : blank(r.week, r.suggested_phase)));
  }).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  // выбрали неделю, за которую уже есть запись, — подставляем её, чтобы исправить, а не ввести заново
  const pickWeek = (v) => {
    const old = v && d.items.find((x) => x.week === monday(v));
    setF((x) => (old ? { ...fromItem(old), week: v } : { ...x, week: v }));
  };
  const week = f.week ? monday(f.week) : "";
  const exists = d.items.some((x) => x.week === week);
  async function save(e) {
    e.preventDefault();
    const body = { ...f, week, check_minutes: Number(f.check_minutes), review_minutes: Number(f.review_minutes) };
    try {
      await api("/analytics/time", { method: "PUT", body });
      toast(k.saved);
      load();
    } catch (ex) { toast(ex.code === "future_week" ? k.future : t.error); }
  }
  async function del(x) {
    if (!window.confirm(k.confirmDel)) return;
    try { await api(`/analytics/time/${x.id}`, { method: "DELETE" }); load(); } catch { toast(t.error); }
  }
  const edit = (x) => { setF(fromItem(x)); window.scrollTo(0, 0); };
  const avg = (phase) => mean(d.items.filter((x) => x.phase === phase).map((x) => x.total));

  return (
    <>
      <Crumb items={[[k.title]]} />
      <h1>{k.title}</h1>
      <p className="subtitle">{k.sub}</p>
      <form className="card" style={{ marginBottom: 20 }} onSubmit={save}>
        <p className="note" style={{ marginTop: 0 }}>{k.how(dm(d.pilot_start))}</p>
        <div className="grid g-2" style={{ gap: 14 }}>
          <label className="field">{k.week}{week ? ` · ${weekLabel(week)}` : ""}
            <input type="date" required value={f.week} max={addDays(d.week, 6)} onChange={(e) => pickWeek(e.target.value)} /></label>
          <label className="field">{k.phase}
            <select value={f.phase} onChange={(e) => set({ phase: e.target.value })}>
              {["before", "after"].map((p) => <option key={p} value={p}>{k.phases[p]}</option>)}
            </select></label>
          <label className="field">{k.check}
            <input type="number" inputMode="numeric" min={0} max={3000} required value={f.check_minutes} onChange={(e) => set({ check_minutes: e.target.value })} />
            <span className="small">{k.checkHelp}</span></label>
          <label className="field">{k.review}
            <input type="number" inputMode="numeric" min={0} max={3000} required value={f.review_minutes} onChange={(e) => set({ review_minutes: e.target.value })} />
            <span className="small">{k.reviewHelp}</span></label>
        </div>
        <label className="field" style={{ marginTop: 14 }}>{k.note}<textarea rows={2} maxLength={1000} value={f.note} onChange={(e) => set({ note: e.target.value })} /></label>
        {exists && <p className="muted small">{k.exists}</p>}
        <button className="btn" style={{ marginTop: 14 }}>{k.save}</button>
      </form>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <p className="card-title">{k.history}</p>
          {d.items.length > 0 && <span className="muted small">{k.avg}: {["before", "after"].map((p) =>
            `${k.phases[p]} — ${avg(p) == null ? "—" : k.min(avg(p))}`).join(" · ")}</span>}
        </div>
        {d.items.length ? d.items.map((x) => (
          <div className="row wrap between" key={x.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <div className="grow">
              <b>{weekLabel(x.week)}</b> <span className={`badge ${x.phase === "before" ? "gray" : "green"}`}>{k.phases[x.phase]}</span>
              <div className="muted small">{t.fb.check}: {k.min(x.check_minutes)} · {t.fb.review}: {k.min(x.review_minutes)}{x.note ? ` · ${x.note}` : ""}</div>
            </div>
            <b>{k.min(x.total)}</b>
            <button className="btn sm ghost" onClick={() => edit(x)}>{k.edit}</button>
            <button className="btn sm ghost" onClick={() => del(x)}>{k.del}</button>
          </div>
        )) : <p className="muted">{k.empty}</p>}
      </div>
      <SurveyCard always />
    </>
  );
}
