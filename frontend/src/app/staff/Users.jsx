import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";

export default function Users() {
  const { t, toast, user } = useApp();
  const [list, setList] = useState(null);
  const [schools, setSchools] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const a = t.admin;
  const load = () => api(`/school/users?q=${encodeURIComponent(q)}&role=${role}`).then(setList).catch(() => setList([]));
  useEffect(() => { const tm = setTimeout(load, 250); return () => clearTimeout(tm); }, [q, role]);
  useEffect(() => { api("/school/schools").then(setSchools).catch(() => {}); }, []);
  async function patch(id, body) {
    try {
      const r = await api(`/school/users/${id}`, { method: "PATCH", body });
      if (r.password) window.prompt(a.newPassword(""), r.password); else toast(t.saved);
      load();
    } catch { toast(t.error); }
  }
  return (
    <>
      <Crumb items={[[a.usersTitle]]} />
      <h1>{a.usersTitle}</h1>
      <div className="row wrap" style={{ margin: "12px 0 18px" }}>
        <input className="grow" placeholder={a.search} value={q} onChange={(e) => setQ(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 10, minWidth: 200 }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 10 }}>
          <option value="">{t.all}</option>{Object.entries(t.roles).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {!list ? <Loading /> : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="heat"><thead><tr><th>{t.settings.name}</th><th>Email / login</th><th>{a.role}</th><th>{a.school}</th><th /></tr></thead>
            <tbody>{list.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td className="small">{u.email || u.login}</td>
                <td><select value={u.role} disabled={u.id === user.id} onChange={(e) => patch(u.id, { role: e.target.value })}>
                  {Object.entries(t.roles).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td><select value={u.school_id || 0} onChange={(e) => patch(u.id, { school_id: Number(e.target.value) })}>
                  <option value={0}>—</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                <td><button className="link small" onClick={() => patch(u.id, { reset_password: true })}>{a.reset}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
