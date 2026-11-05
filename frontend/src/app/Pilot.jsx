// Метрики пилота, которые вводят люди (docs/PLAN.md, раздел 7):
// Workload — минуты учителя на проверку и разбор ошибок за день; Survey — короткий еженедельный опрос удобства.
import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Box, useApp } from "./ui.jsx";

const fmtDay = (iso) => iso.slice(8, 10) + "." + iso.slice(5, 7);
const mins = (x) => (x == null ? "—" : Math.round(x));

export function Workload() {
  const { t, toast } = useApp();
  const p = t.pilot;
  const [d, setD] = useState(null);
  const [day, setDay] = useState("");
  const [form, setForm] = useState({ checking_min: "", errors_min: "" });
  const [busy, setBusy] = useState(false);
  const load = () => api("/analytics/workload/me").then((r) => { setD(r); setDay((x) => x || r.today); }).catch(() => setD(false));
  useEffect(() => { load(); }, []);
  // при выборе дня подставляем уже внесённые минуты
  useEffect(() => {
    if (!d) return;
    const e = d.entries.find((x) => x.day === day);
    setForm({ checking_min: e ? String(e.checking_min) : "", errors_min: e ? String(e.errors_min) : "" });
  }, [day, d]);
  if (!d) return null;

  async function save(ev) {
    ev.preventDefault();
    setBusy(true);
    try {
      await api(`/analytics/workload/${day}`, { method: "PUT",
        body: { checking_min: Number(form.checking_min) || 0, errors_min: Number(form.errors_min) || 0 } });
      toast(p.saved);
      load();
    } catch { toast(t.error); } finally { setBusy(false); }
  }
  const s = d.stats;
  const change = s.change == null ? "—" : `${s.change > 0 ? "+" : ""}${Math.round(s.change * 100)}%`;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}><Box icon="clock" c="purple" size={40} />
        <div><p className="card-title">{p.wTitle}</p><div className="muted small">{p.wHelp(fmtDay(s.pilot_start))}</div></div></div>
      <form className="row wrap" style={{ alignItems: "flex-end" }} onSubmit={save}>
        <label className="field" style={{ width: 150 }}>{p.day}
          <input type="date" value={day} min={d.min_day} max={d.today} required onChange={(e) => setDay(e.target.value)} /></label>
        <label className="field" style={{ width: 120 }}>{p.checking}
          <input type="number" min={0} max={720} inputMode="numeric" value={form.checking_min} onChange={set("checking_min")} required /></label>
        <label className="field" style={{ width: 120 }}>{p.errors}
          <input type="number" min={0} max={720} inputMode="numeric" value={form.errors_min} onChange={set("errors_min")} required /></label>
        <button className="btn" disabled={busy}>{t.save}</button>
      </form>
      <div className="grid g-3" style={{ marginTop: 16, gap: 12 }}>
        {[[p.before, s.before], [p.after, s.after]].map(([l, x]) => (
          <div key={l}><div className="muted small">{l}</div><b style={{ fontSize: 20 }}>{mins(x.total)}</b>
            <span className="muted small"> {p.perDay} · {p.days(x.days)}</span></div>
        ))}
        <div><div className="muted small">{p.change}</div><b style={{ fontSize: 20 }}>{change}</b></div>
      </div>
      {d.entries.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 10 }}>
          {d.entries.slice(0, 5).map((e) => (
            <button type="button" key={e.day} className="row between small link" style={{ width: "100%", padding: "3px 0", color: "inherit" }} onClick={() => setDay(e.day)}>
              <span>{fmtDay(e.day)} · {e.phase === "before" ? p.before : p.after}</span>
              <span className="muted">{p.entry(e.checking_min, e.errors_min)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const HIDE_KEY = "dl_survey_later";

export function Survey() {
  const { t, user, toast } = useApp();
  const p = t.pilot;
  const [d, setD] = useState(null);
  const [ans, setAns] = useState({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(() => { try { return sessionStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } });
  useEffect(() => { api("/analytics/survey/me").then(setD).catch(() => {}); }, []);
  if (!d || !d.due || later) return null;

  const qs = user.role === "teacher" ? p.qTeacher : p.qStudent;
  const keys = ["ease", "useful", "recommend"];
  const ready = keys.every((k) => ans[k]);
  async function send() {
    setBusy(true);
    try {
      await api("/analytics/survey", { method: "PUT", body: { ...ans, comment } });
      setD({ ...d, due: false });
      toast(p.thanks);
    } catch { toast(t.error); } finally { setBusy(false); }
  }
  const hide = () => { try { sessionStorage.setItem(HIDE_KEY, "1"); } catch { /* */ } setLater(true); };
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <p className="card-title">{p.sTitle}</p>
        <button className="link small" onClick={hide}>{p.later}</button>
      </div>
      <p className="muted small" style={{ margin: "0 0 12px" }}>{p.sHelp}</p>
      {keys.map((k, i) => (
        <div key={k} style={{ marginBottom: 12 }}>
          <div className="small" style={{ marginBottom: 6 }}>{qs[i]}</div>
          <div className="row" style={{ gap: 6 }} role="radiogroup" aria-label={qs[i]}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} type="button" role="radio" aria-checked={ans[k] === v} className={`chip ${ans[k] === v ? "on" : ""}`}
                style={{ minWidth: 40 }} onClick={() => setAns({ ...ans, [k]: v })}>{v}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="muted small" style={{ marginBottom: 10 }}>{p.scale}</div>
      <label className="field" style={{ marginBottom: 12 }}>{p.comment}
        <textarea rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      <button className="btn block" disabled={!ready || busy} onClick={send}>{p.send}</button>
    </div>
  );
}
