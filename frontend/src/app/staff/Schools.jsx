import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Icon, Loading, useApp } from "../ui.jsx";

export default function Schools() {
  const { t, toast } = useApp();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(false);
  const a = t.admin;
  const load = () => api("/school/schools").then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  async function create(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await api("/school/schools", { method: "POST", body: f }); setForm(false); load(); } catch { toast(t.error); }
  }
  async function invite(id, role) {
    try { await api(`/school/schools/${id}/invites`, { method: "POST", body: { role } }); load(); } catch { toast(t.error); }
  }
  if (!list) return <Loading />;
  return (
    <>
      <Crumb items={[[a.schools]]} />
      <div className="page-head"><h1>{a.schools}</h1><button className="btn" onClick={() => setForm(!form)}><Icon n="plus" s={18} /> {a.newSchool}</button></div>
      {form && (
        <form className="card row wrap" style={{ marginBottom: 20, alignItems: "flex-end" }} onSubmit={create}>
          <label className="field grow">{a.schoolName}<input name="name" required minLength={2} maxLength={300} autoFocus /></label>
          <label className="field">{a.city}<input name="city" maxLength={120} /></label>
          <button className="btn">{t.save}</button>
        </form>
      )}
      <div className="stack">
        {list.map((s) => (
          <div className="card" key={s.id}>
            <div className="row between wrap"><div><div className="card-title">{s.name}</div><div className="muted small">{s.city} · {t.snav.classes}: {s.classes} · {t.roles.teacher}/{t.roles.curator}: {s.staff}</div></div>
              <div className="row">{["teacher", "curator"].map((r) => <button key={r} className="btn sm ghost" onClick={() => invite(s.id, r)}>{a.invite}: {a.inviteFor[r]}</button>)}</div></div>
            {s.invites.length > 0 && (
              <table className="heat" style={{ marginTop: 14 }}><tbody>
                {s.invites.map((i) => (
                  <tr key={i.id}><td><b style={{ letterSpacing: 2 }}>{i.code}</b></td><td>{t.roles[i.role]}</td><td className="muted small">{a.uses(i.uses, i.max_uses)}</td>
                    <td className="muted small">{i.expires_at ? `${a.until} ${new Date(i.expires_at).toLocaleDateString()}` : ""}</td></tr>
                ))}
              </tbody></table>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
