import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, Ring, useApp } from "../ui.jsx";
import RecItem from "./RecItem.jsx";
import { feedView } from "./feedView.js";

const ORDER = ["mastered", "likely", "learning", "gap", "unknown"];

export default function ClassMap() {
  const { t, L, route, toast, user } = useApp();
  const [d, setD] = useState(null);
  const [feed, setFeed] = useState(null);
  const [assign, setAssign] = useState("");
  const m = t.map;
  const id = route.param;
  const load = () => {
    api(`/state/classes/${id}`).then(setD).catch(() => setD(false));
    api(`/decisions/feed?class_id=${id}`).then(setFeed).catch(() => setFeed({ items: [] }));
  };
  useEffect(load, [id]);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const n = d.students.length || 1;
  const avg = Math.round(d.students.reduce((s, x) => s + x.percent, 0) / n);
  const dist = d.lessons.map((l, i) => {
    const c = Object.fromEntries(ORDER.map((k) => [k, 0]));
    d.students.forEach((s) => { c[s.cells[i].status] += 1; });
    return c;
  });
  async function doAssign() {
    try { const r = await api(`/verification/classes/${id}/assign`, { method: "POST", body: { lesson: assign } }); toast(m.assigned(r.assigned)); }
    catch { toast(t.error); }
  }
  const o = d.outcomes;
  return (
    <>
      <Crumb items={[[t.classes.title, "#/" + (user.role === "teacher" ? "" : "classes")], [d.class.name]]} />
      <h1>{d.class.name}</h1>
      <p className="subtitle">{t.classes.students(d.students.length)} · Математика · {t.grade(d.class.grade)}</p>
      <div className="grid g-main" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="row wrap" style={{ gap: 24, alignItems: "flex-start" }}>
            <div style={{ textAlign: "center" }}><Ring p={avg} size={110} /><div className="muted small" style={{ marginTop: 6 }}>{m.avg}</div></div>
            <div className="grow" style={{ minWidth: 260 }}>
              <p className="card-title" style={{ marginBottom: 10 }}>{m.skills}</p>
              {d.lessons.map((l, i) => (
                <div key={l.slug} className="row" style={{ gap: 10, marginBottom: 6 }}>
                  <span className="small" style={{ width: 190, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={L(l.title)}>{i + 1}. {L(l.title)}</span>
                  <div className="dist grow" aria-label={`${L(l.title)}: ${m.gaps(l.gaps)}`}>
                    {ORDER.map((k) => dist[i][k] > 0 && <span key={k} className={`d-${k}`} style={{ flex: dist[i][k] }}>{dist[i][k]}</span>)}
                  </div>
                </div>
              ))}
              <div className="row wrap small muted" style={{ gap: 12, marginTop: 10 }}>
                {ORDER.map((k) => <span key={k} className="row" style={{ gap: 5 }}><span className={`dot ${k}`} />{t.status[k]}</span>)}
              </div>
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <p className="card-title" style={{ marginBottom: 8 }}>{m.assign}</p>
            <p className="muted small" style={{ marginTop: 0 }}>{m.assignHelp}</p>
            <div className="row">
              <select className="grow" value={assign} onChange={(e) => setAssign(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 10 }}>
                <option value="">—</option>
                {d.lessons.map((l) => <option key={l.slug} value={l.slug}>{L(l.title)}</option>)}
              </select>
              <button className="btn sm" disabled={!assign || user.role === "curator"} onClick={doAssign}>{t.start}</button>
            </div>
          </div>
          <div className="card">
            <p className="card-title" style={{ marginBottom: 8 }}>{m.outcomes}</p>
            <p className="muted small" style={{ margin: 0 }}>{o.total ? m.helped(o.helped, o.total) : "—"}</p>
          </div>
        </div>
      </div>
      <div className="grid g-main">
        <div className="card" style={{ overflowX: "auto" }}>
          <p className="card-title" style={{ marginBottom: 12 }}>{m.students}</p>
          {d.students.length ? (
            <table className="heat">
              <thead><tr><th />{d.lessons.map((l, i) => <th key={l.slug} title={L(l.title)}>{i + 1}</th>)}<th>%</th></tr></thead>
              <tbody>
                {d.students.map((s) => (
                  <tr key={s.id}>
                    <td><a href={`#/student/${s.id}`}>{s.name}</a></td>
                    {s.cells.map((c, i) => <td key={i}><span className={`cell ${c.status}`} title={`${L(d.lessons[i].title)}: ${t.status[c.status]} ${Math.round(c.proof * 100)}%`} /></td>)}
                    <td><b>{s.percent}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">{m.noStudents}</p>}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-head"><p className="card-title">{t.snav.feed}</p><a className="link" href="#/feed">{t.all}</a></div>
          {feed ? (() => {
            const v = feedView(feed.items);
            const top = v.important.filter((x) => x.status === "new").slice(0, 5);
            return top.length ? top.map((r) => <RecItem key={r.id} r={r} onChange={load} covered={v.covered.get(r.id) || 0} />)
              : <p className="muted small">{t.rec.empty}</p>;
          })() : <Loading />}
        </div>
      </div>
    </>
  );
}
