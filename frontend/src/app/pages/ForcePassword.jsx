import { useState } from "react";
import { api } from "../api.js";
import { useApp } from "../ui.jsx";

// Ученик из импортированного списка: сначала меняет временный пароль.
export default function ForcePassword() {
  const { t, user, setUser, toast } = useApp();
  const [err, setErr] = useState("");
  const m = t.me;
  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      await api("/auth/password", { method: "POST", body: { old: f.old, new: f.new } });
      setUser({ ...user, must_change_password: false });
      toast(m.pwdChanged);
    } catch (ex) { setErr(ex.code === "bad_password" ? m.badPwd : t.auth.errors.invalid); }
  }
  return (
    <div className="auth-form" style={{ minHeight: "100vh" }}>
      <form onSubmit={submit}>
        <img src="/logo.png" alt="" style={{ width: 44 }} />
        <h1 style={{ margin: 0 }}>{m.password}</h1>
        <p className="muted" style={{ margin: 0 }}>{user.name} · {user.login}</p>
        <p className="note" style={{ margin: 0 }}>{m.mustChange}</p>
        <label className="field">{m.oldPwd}<input name="old" type="password" required autoComplete="current-password" /></label>
        <label className="field">{m.newPwd}<input name="new" type="password" required minLength={8} autoComplete="new-password" /></label>
        {err && <p className="form-error" role="alert">{err}</p>}
        <button className="btn block">{t.save}</button>
      </form>
    </div>
  );
}
