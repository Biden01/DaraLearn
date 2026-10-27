import { useState } from "react";
import { api } from "../api.js";
import { Crumb, useApp } from "../ui.jsx";

export default function Settings() {
  const { t, user, setUser, setLang, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const s = t.settings;
  async function save(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setBusy(true);
    try {
      const u = await api("/auth/me", { method: "PATCH", body: { name: f.name, grade: Number(f.grade), lang: f.lang, weekly_goal: Number(f.goal) } });
      setUser(u);
      setLang(u.lang);
      toast(t.saved);
    } catch { toast(t.error); } finally { setBusy(false); }
  }
  async function join(e) {
    e.preventDefault();
    const code = new FormData(e.target).get("code");
    try { setUser(await api("/auth/join", { method: "POST", body: { code } })); e.target.reset(); toast(t.me.joined); }
    catch (ex) { toast(ex.code === "invalid_code" ? t.me.badCode : t.error); }
  }
  async function changePwd(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await api("/auth/password", { method: "POST", body: { old: f.old, new: f.new } }); e.target.reset(); toast(t.me.pwdChanged); }
    catch (ex) { toast(ex.code === "bad_password" ? t.me.badPwd : t.error); }
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    window.location.hash = "";
  }
  return (
    <>
      <Crumb items={[[t.nav.settings]]} />
      <h1>{t.nav.settings}</h1>
      <p className="subtitle">{s.sub}</p>
      <div className="grid g-2">
        <form className="card" onSubmit={save}>
          <p className="card-title" style={{ margin: "0 0 18px" }}>{s.profile}</p>
          <div className="row" style={{ marginBottom: 20 }}><div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{user.name[0].toUpperCase()}</div>
            <div><div className="t-strong">{user.name}</div><div className="muted small">{t.grade(user.grade)}</div></div></div>
          <div className="stack" style={{ gap: 14 }}>
            <label className="field">{s.name}<input name="name" defaultValue={user.name} required maxLength={200} /></label>
            <label className="field">{s.gradeL}<select name="grade" defaultValue={user.grade}>{[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{t.grade(g)}</option>)}</select></label>
            <label className="field">{s.lang}<select name="lang" defaultValue={user.lang}><option value="kk">Қазақ тілі</option><option value="ru">Русский</option></select></label>
            <label className="field">{s.goal}<input name="goal" type="number" min={5} max={300} defaultValue={user.weekly_goal} required /><span className="small">{s.goalHelp}</span></label>
            <button className="btn" disabled={busy}>{t.save}</button>
          </div>
        </form>
        <div className="stack">
        {user.role === "student" && (
          <form className="card" onSubmit={join}>
            <p className="card-title" style={{ margin: "0 0 14px" }}>{t.me.join}</p>
            <div className="row"><input name="code" required minLength={4} maxLength={12} placeholder={t.me.joinCode} aria-label={t.me.joinCode}
              style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: 11, textTransform: "uppercase", letterSpacing: 2 }} />
              <button className="btn">{t.save}</button></div>
          </form>
        )}
        <form className="card" onSubmit={changePwd}>
          <p className="card-title" style={{ margin: "0 0 14px" }}>{t.me.password}</p>
          <div className="stack" style={{ gap: 10 }}>
            <label className="field">{t.me.oldPwd}<input name="old" type="password" required autoComplete="current-password" /></label>
            <label className="field">{t.me.newPwd}<input name="new" type="password" required minLength={8} autoComplete="new-password" /></label>
            <button className="btn ghost">{t.save}</button>
          </div>
        </form>
        <div className="card" style={{ alignSelf: "start" }}>
          <p className="card-title" style={{ margin: "0 0 14px" }}>{s.account}</p>
          <div className="row between"><span className="muted">{s.email}</span><b>{user.email || user.login}</b></div>
          <div className="row between" style={{ marginTop: 8 }}><span className="muted">{t.admin.role}</span><b>{t.roles[user.role]}</b></div>
          <button className="btn ghost block" style={{ marginTop: 20 }} onClick={logout}>{s.logout}</button>
        </div>
        </div>
      </div>
    </>
  );
}
