import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";

export function Leads() {
  const { t } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api("/admin/leads").then(setList).catch(() => setList([])); }, []);
  if (!list) return <Loading />;
  return (
    <>
      <Crumb items={[[t.admin.leads]]} />
      <h1>{t.admin.leads}</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        {list.length ? (
          <table className="heat"><tbody>{list.map((l) => (
            <tr key={l.id}><td className="small">{new Date(l.created_at).toLocaleString("ru-RU")}</td><td><b>{l.name}</b><div className="muted small">{l.role} · {l.school}</div></td>
              <td className="small"><a href={`mailto:${l.email}`}>{l.email}</a><div>{l.phone}</div></td><td className="small" style={{ maxWidth: 360 }}>{l.message}</td></tr>
          ))}</tbody></table>
        ) : <p className="muted">{t.admin.noLeads}</p>}
      </div>
    </>
  );
}

export function Support() {
  const { t, toast } = useApp();
  const s = t.admin.sup;
  const topics = t.help.topics;
  const [filter, setFilter] = useState("new");
  const [topic, setTopic] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState("new");
  const [q, setQ] = useState("");
  const [d, setD] = useState(null);
  const load = () => {
    const p = new URLSearchParams({ status: filter, sort, q, role });
    if (topic) p.set("topic", topic);
    return api(`/admin/support?${p}`).then(setD).catch(() => setD({ items: [], counts: { new: 0, done: 0, topics: {} } }));
  };
  useEffect(() => { const id = setTimeout(load, q ? 300 : 0); return () => clearTimeout(id); }, [filter, topic, role, sort, q]);
  async function patch(id, body, msg) {
    try { await api(`/admin/support/${id}`, { method: "PATCH", body }); toast(msg); load(); } catch { toast(t.error); }
  }
  if (!d) return <Loading />;
  const field = { border: "1px solid var(--line)", borderRadius: 9, padding: 10 };
  const topicTotal = Object.values(d.counts.topics).reduce((a, b) => a + b, 0);
  return (
    <>
      <Crumb items={[[t.admin.support]]} />
      <h1>{t.admin.support}</h1>
      <div className="row between wrap" style={{ margin: "12px 0 10px" }}>
        <div className="chips" style={{ margin: 0 }}>
          {[["new", s.new, d.counts.new], ["done", s.done, d.counts.done], ["all", t.all, d.counts.new + d.counts.done]].map(([k, label, n]) => (
            <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{label} · {n}</button>
          ))}
        </div>
        <div className="row wrap">
          <input placeholder={s.search} value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, minWidth: 200 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={field}>
            <option value="">{s.allRoles}</option>{Object.entries(t.roles).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={field}>
            <option value="new">{s.newest}</option><option value="old">{s.oldest}</option>
            <option value="topic">{s.byTopic}</option><option value="author">{s.byAuthor}</option>
          </select>
        </div>
      </div>
      <div className="chips" style={{ margin: "0 0 18px" }}>
        <button className={`chip ${!topic ? "on" : ""}`} onClick={() => setTopic("")}>{s.allTopics} · {topicTotal}</button>
        {Object.entries(topics).map(([k, l]) => (
          <button key={k} className={`chip ${topic === k ? "on" : ""}`} onClick={() => setTopic(k)}>{l} · {d.counts.topics[k] || 0}</button>
        ))}
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        {d.items.length ? (
          <table className="heat"><tbody>{d.items.map((m) => (
            <tr key={m.id} style={m.status === "done" ? { opacity: 0.6 } : undefined}>
              <td className="small">{new Date(m.created_at).toLocaleString("ru-RU")}</td>
              <td><b>{m.user.name}</b><div className="muted small">{t.roles[m.user.role] || m.user.role}</div><div className="small"><a href={`mailto:${m.user.email}`}>{m.user.email}</a></div></td>
              <td className="small"><select value={m.topic} onChange={(e) => patch(m.id, { topic: e.target.value }, t.saved)} aria-label={t.help.topic}>
                {Object.entries(topics).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
              <td className="small" style={{ maxWidth: 480, whiteSpace: "pre-wrap" }}>{m.text}</td>
              <td className="small" style={{ whiteSpace: "nowrap" }}>
                {m.status === "new" ? <button className="btn sm" onClick={() => patch(m.id, { status: "done" }, s.marked)}>{s.markDone}</button> : (
                  <><div className="muted">{s.doneBy(m.resolved_by, new Date(m.resolved_at).toLocaleString("ru-RU"))}</div>
                    <button className="link small" onClick={() => patch(m.id, { status: "new" }, s.reopened)}>{s.reopen}</button></>
                )}
              </td></tr>
          ))}</tbody></table>
        ) : <p className="muted">{t.admin.noSupport}</p>}
      </div>
    </>
  );
}

export function Audit() {
  const { t } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api("/admin/audit").then(setList).catch(() => setList([])); }, []);
  if (!list) return <Loading />;
  return (
    <>
      <Crumb items={[[t.admin.audit]]} />
      <h1>{t.admin.audit}</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="heat"><tbody>{list.map((a) => (
          <tr key={a.id}><td className="small">{new Date(a.created_at).toLocaleString("ru-RU")}</td><td>{a.actor}</td><td><code>{a.action}</code></td>
            <td className="muted small">{a.entity} #{a.entity_id} {Object.entries(a.data || {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${v}`).join(", ")}</td></tr>
        ))}</tbody></table>
      </div>
    </>
  );
}
