import { useState } from "react";
import { api } from "../api.js";
import { useApp } from "../ui.jsx";

export default function Auth() {
  const { t, lang, setLang, setUser } = useApp();
  const [mode, setMode] = useState(window.location.hash.includes("register") ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const a = t.auth;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const f = Object.fromEntries(new FormData(e.target));
    const body = mode === "login" ? { login: f.email, password: f.password }
      : { email: f.email, password: f.password, name: f.name, grade: Number(f.grade), lang, code: f.code || "" };
    try {
      const u = await api(`/auth/${mode}`, { method: "POST", body });
      setUser(u);
      setLang(u.lang);
      window.location.hash = mode === "register" && u.role === "student" ? "#/diagnostics" : "#/";
    } catch (ex) {
      setErr(ex.code === "invalid_code" ? t.me.badCode : a.errors[ex.code] || (ex.status === 422 ? a.errors.invalid : t.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-side">
        <a href="/" className="brand"><img src="/logo.png" alt="" style={{ width: 34, filter: "brightness(0) invert(1)" }} /> DaraLearn</a>
        <div>
          <h2>{a.side}</h2>
          <p>{a.sideText}</p>
        </div>
        <a href="/" className="small" style={{ color: "#d5e3ff" }}>{a.toSite}</a>
      </div>
      <div className="auth-form">
        <form onSubmit={submit}>
          <div className="row between">
            <h1 style={{ margin: 0 }}>{mode === "login" ? a.login : a.register}</h1>
            <div className="lang" role="group" style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 9, padding: 3 }}>
              {["kk", "ru"].map((l) => <button type="button" key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l === "kk" ? "ҚАЗ" : "РУС"}</button>)}
            </div>
          </div>
          {mode === "register" && (
            <div className="row" style={{ alignItems: "flex-end" }}>
              <label className="field grow">{a.name}<input name="name" required maxLength={200} autoComplete="given-name" /></label>
              <label className="field" style={{ width: 110 }}>{a.gradeL}
                <select name="grade" defaultValue="8">{[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{g}</option>)}</select>
              </label>
            </div>
          )}
          <label className="field">{mode === "login" ? t.me.loginOrEmail : a.email}
            <input name="email" type={mode === "login" ? "text" : "email"} required autoComplete={mode === "login" ? "username" : "email"} /></label>
          <label className="field">{a.password}
            <input name="password" type="password" required minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {mode === "register" && <span className="small">{a.min8}</span>}
          </label>
          {mode === "register" && (
            <label className="field">{t.me.codeOpt}
              <input name="code" maxLength={12} defaultValue={new URLSearchParams(window.location.hash.split("?")[1] || "").get("code") || ""}
                style={{ textTransform: "uppercase", letterSpacing: 2 }} /></label>
          )}
          {err && <p className="form-error" role="alert">{err}</p>}
          <button className="btn block" disabled={busy}>{mode === "login" ? a.login : a.register}</button>
          <p className="muted" style={{ textAlign: "center" }}>
            {mode === "login" ? a.noAccount : a.haveAccount}{" "}
            <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
              {mode === "login" ? a.register : a.login}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
