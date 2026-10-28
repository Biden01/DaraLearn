import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";
import RecItem from "./RecItem.jsx";
import { feedView } from "./feedView.js";

export default function Feed() {
  const { t } = useApp();
  const [d, setD] = useState(null);
  const [closed, setClosed] = useState(false);
  const [filter, setFilter] = useState("important");
  const load = () => api(`/decisions/feed?include_closed=${closed}`).then(setD).catch(() => setD({ items: [], counts: {} }));
  useEffect(() => { load(); }, [closed]);
  if (!d) return <Loading />;
  const statuses = closed ? ["accepted", "changed", "done", "rejected"] : ["accepted", "changed"];
  const view = feedView(d.items);
  const items = filter === "important" ? view.important.filter((x) => ["new", "accepted", "changed"].includes(x.status))
    : filter === "low" ? view.low : d.items.filter((x) => x.status === filter);
  return (
    <>
      <Crumb items={[[t.snav.feed]]} />
      <h1>Teacher Action Feed</h1>
      <p className="subtitle">{t.snav.feed}</p>
      <div className="row between wrap" style={{ marginBottom: 16 }}>
        <div className="chips" style={{ margin: 0 }}>
          {[["important", t.rec.important, view.important.filter((x) => ["new", "accepted", "changed"].includes(x.status)).length],
            ["low", t.rec.low, view.low.length], ...statuses.map((k) => [k, t.rec[k], d.counts[k] || 0])].map(([k, label, n]) => (
            <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{label} · {n}</button>
          ))}
        </div>
        <label className="row small"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> {t.rec.showClosed}</label>
      </div>
      <div className="card">{items.length ? items.map((r) => <RecItem key={r.id} r={r} onChange={load} covered={view.covered.get(r.id) || 0} />) : <p className="muted">{t.rec.empty}</p>}</div>
    </>
  );
}
