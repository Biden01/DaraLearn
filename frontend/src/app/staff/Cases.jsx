import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";

const BADGE = { open: "red", watching: "orange", closed: "gray" };

function Case({ c, onSaved }) {
  const { t, toast } = useApp();
  const [next, setNext] = useState(c.next_step);
  const [until, setUntil] = useState(c.watch_until || "");
  const k = t.cases;
  async function save(status) {
    try { onSaved(await api(`/verification/adviser/${c.id}`, { method: "PATCH", body: { status, next_step: next, watch_until: until || null } })); toast(t.saved); }
    catch { toast(t.error); }
  }
  return (
    <div className="card">
      <div className="row between wrap">
        <a href={`#/student/${c.student.id}`} className="card-title">{c.student.name} <span className="muted small">{c.student.class}</span></a>
        <span className={`badge ${BADGE[c.status]}`}>{k.status[c.status]}</span>
      </div>
      <p className="muted small">{k.plan}: <b className="st-gap">{Math.round(c.plan_rate * 100)}%</b> · {new Date(c.created_at).toLocaleDateString()}</p>
      <div className="grid g-2" style={{ gap: 12 }}>
        <label className="field">{k.nextStep}<textarea rows={2} value={next} onChange={(e) => setNext(e.target.value)} maxLength={2000} /></label>
        <label className="field">{k.watchUntil}<input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      </div>
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className="btn sm" onClick={() => save(c.status)}>{k.save}</button>
        {c.status !== "watching" && <button className="btn sm ghost" onClick={() => save("watching")}>{k.watch}</button>}
        {c.status !== "closed" && <button className="btn sm ghost" onClick={() => save("closed")}>{k.close}</button>}
      </div>
    </div>
  );
}

export default function Cases() {
  const { t } = useApp();
  const [list, setList] = useState(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => { api(`/verification/adviser?include_closed=${closed}`).then(setList).catch(() => setList([])); }, [closed]);
  if (!list) return <Loading />;
  const k = t.cases;
  return (
    <>
      <Crumb items={[[k.title]]} />
      <div className="page-head">
        <div><h1>{k.title}</h1><p className="subtitle">{k.sub}</p></div>
        <label className="row small"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> {k.showClosed}</label>
      </div>
      {list.length ? <div className="stack">{list.map((c) => <Case key={c.id} c={c} onSaved={(x) => setList((l) => l.map((y) => (y.id === x.id ? x : y)))} />)}</div>
        : <div className="card empty muted">{k.empty}</div>}
    </>
  );
}
