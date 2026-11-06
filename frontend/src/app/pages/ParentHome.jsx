import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Loading, useApp } from "../ui.jsx";

// Кабинет родителя: дети только на чтение — план на сегодня, серия, освоенные темы. Без рейтингов и сравнения.
export default function ParentHome() {
  const { t, L, toast } = useApp();
  const p = t.parent;
  const [kids, setKids] = useState(null);
  const load = () => api("/parents/children").then(setKids).catch(() => { setKids([]); toast(t.error); });
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    const code = new FormData(e.target).get("code");
    try { await api("/parents/join", { method: "POST", body: { code } }); e.target.reset(); toast(p.added); load(); }
    catch (ex) { toast(p.bad[ex.code] || t.error); }
  }
  async function unlink(k) {
    if (!window.confirm(p.confirmUnlink)) return;
    try { await api(`/parents/links/${k.link_id}`, { method: "DELETE" }); load(); } catch { toast(t.error); }
  }

  if (!kids) return <Loading />;
  return (
    <>
      <h1>{p.title}</h1>
      <p className="subtitle">{p.sub}</p>
      {kids.length === 0 && <div className="card muted" style={{ marginBottom: 16 }}>{p.empty}</div>}
      <div className="stack">
        {kids.map((k) => (
          <div key={k.id} className="card stack" style={{ gap: 14 }}>
            <div className="row between wrap">
              <div><div className="card-title">{k.name}</div><div className="muted small">{p.grade(k.grade)}</div></div>
              <button className="btn sm ghost" onClick={() => unlink(k)}>{p.unlink}</button>
            </div>
            <div className="grid g-3" style={{ gap: 12 }}>
              <Stat label={p.streak} value={k.streak} />
              <Stat label={p.mastered(k.progress.mastered, k.progress.total)} value={`${k.progress.percent}%`} bar={k.progress.percent} />
              <Stat label={p.week(k.goal.done, k.goal.target)} value={`${Math.min(100, Math.round((100 * k.goal.done) / (k.goal.target || 1)))}%`}
                bar={(100 * k.goal.done) / (k.goal.target || 1)} />
            </div>
            <div>
              <div className="t-strong" style={{ marginBottom: 6 }}>{p.today}</div>
              {k.today ? (
                <>
                  <div className="muted small" style={{ marginBottom: 6 }}>{p.minutes(k.today.done_minutes, k.today.total_minutes)}</div>
                  {k.today.items.map((i, n) => (
                    <div key={n} className="row between small" style={{ padding: "4px 0", borderTop: n ? "1px solid var(--line)" : 0 }}>
                      <span>{p.blocks[i.block] || i.block} · {L(i.title)}</span>
                      <span className={`badge ${i.status === "done" ? "green" : "gray"}`}>{i.status === "done" ? p.done : p.todo}</span>
                    </div>
                  ))}
                </>
              ) : <div className="muted small">{p.noPlan}</div>}
            </div>
            {k.checks_due > 0 && <div className="small" style={{ color: "var(--orange)" }}>{p.checks(k.checks_due)}</div>}
            {k.skills.length > 0 && (
              <div>
                <div className="t-strong" style={{ marginBottom: 6 }}>{p.skills}</div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {k.skills.map((s, n) => (
                    <span key={n} className={`badge ${{ mastered: "green", likely: "green", learning: "orange", gap: "red" }[s.status] || "gray"}`}>
                      {L(s.title)} · {t.status[s.status]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        <form className="card row wrap" style={{ gap: 10 }} onSubmit={add}>
          <div className="grow"><div className="card-title">{p.add}</div></div>
          <input name="code" required minLength={4} maxLength={12} placeholder={p.code} aria-label={p.code}
            style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 11, textTransform: "uppercase", letterSpacing: 2 }} />
          <button className="btn">{p.addBtn}</button>
        </form>
      </div>
    </>
  );
}

function Stat({ label, value, bar }) {
  return (
    <div className="card soft" style={{ padding: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div className="muted small" style={{ margin: "2px 0 6px" }}>{label}</div>
      {bar != null && <Bar p={bar} />}
    </div>
  );
}
