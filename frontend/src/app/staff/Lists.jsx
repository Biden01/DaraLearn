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
            <tr key={l.id}><td className="small">{new Date(l.created_at).toLocaleString()}</td><td><b>{l.name}</b><div className="muted small">{l.role} · {l.school}</div></td>
              <td className="small"><a href={`mailto:${l.email}`}>{l.email}</a><div>{l.phone}</div></td><td className="small" style={{ maxWidth: 360 }}>{l.message}</td></tr>
          ))}</tbody></table>
        ) : <p className="muted">{t.admin.noLeads}</p>}
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
          <tr key={a.id}><td className="small">{new Date(a.created_at).toLocaleString()}</td><td>{a.actor}</td><td><code>{a.action}</code></td>
            <td className="muted small">{a.entity} #{a.entity_id} {Object.entries(a.data || {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${v}`).join(", ")}</td></tr>
        ))}</tbody></table>
      </div>
    </>
  );
}
