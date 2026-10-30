import { useState } from "react";
import { api } from "../api.js";
import { Crumb, useApp } from "../ui.jsx";

const GOALS = [20, 40, 60, 100];

// Настройки: одна колонка, в каждом блоке одно действие и короткое пояснение. Профиль и успехи — в личном кабинете.
export default function Settings() {
  const { t, user, setUser, lang, setLang, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const s = t.settings;
  const student = user.role === "student";

  async function patch(body) {
    setBusy(true);
    try { setUser(await api("/auth/me", { method: "PATCH", body })); toast(t.saved); }
    catch { toast(t.error); } finally { setBusy(false); }
  }
  function saveProfile(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    patch(student ? { name: f.name, grade: Number(f.grade) } : { name: f.name });
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
    try { await api("/auth/password", { method: "POST", body: { old: f.old, new: f.new } }); setPwdOpen(false); toast(t.me.pwdChanged); }
    catch (ex) { toast(ex.code === "bad_password" ? t.me.badPwd : t.error); }
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    window.location.hash = "";
  }
  const goals = GOALS.includes(user.weekly_goal) ? GOALS : [...GOALS, user.weekly_goal].sort((a, b) => a - b);

  return (
    <div style={{ maxWidth: 640 }}>
      <Crumb items={[[t.nav.profile, "#/profile"], [t.nav.settings]]} />
      <h1>{t.nav.settings}</h1>
      <p className="subtitle">{s.sub}</p>
      <div className="stack">
        <Section title={s.profile} help={s.profileHelp}>
          <form className="stack" style={{ gap: 12 }} onSubmit={saveProfile}>
            <label className="field">{s.name}<input name="name" defaultValue={user.name} required maxLength={200} /></label>
            {student && (
              <label className="field">{s.gradeL}<select name="grade" defaultValue={user.grade}>
                {[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{t.grade(g)}</option>)}</select></label>
            )}
            <div><button className="btn" disabled={busy}>{t.save}</button></div>
          </form>
        </Section>

        <Section title={s.lang} help={s.langHelp}>
          <div className="tabs">
            {[["kk", "Қазақ тілі"], ["ru", "Русский"]].map(([l, name]) => (
              <button key={l} className={lang === l ? "on" : ""} aria-pressed={lang === l} onClick={() => setLang(l)}>{name}</button>
            ))}
          </div>
        </Section>

        {student && (
          <Section title={s.goal} help={s.goalHelp}>
            <div className="row wrap" style={{ gap: 8 }}>
              {goals.map((n) => (
                <button key={n} disabled={busy} onClick={() => n !== user.weekly_goal && patch({ weekly_goal: n })}
                  className={`btn sm ${n === user.weekly_goal ? "" : "ghost"}`} aria-pressed={n === user.weekly_goal}>
                  {s.levels[n] ? `${s.levels[n]} · ` : ""}{s.tasks(n)}
                </button>
              ))}
            </div>
          </Section>
        )}

        {student && (
          <Section title={t.me.join} help={s.joinHelp}>
            <form className="row" onSubmit={join}>
              <input name="code" required minLength={4} maxLength={12} placeholder={t.me.joinCode} aria-label={t.me.joinCode}
                style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: 11, textTransform: "uppercase", letterSpacing: 2 }} />
              <button className="btn">{t.save}</button>
            </form>
          </Section>
        )}

        <Section title={t.me.password} help={s.pwdHelp}>
          {pwdOpen ? (
            <form className="stack" style={{ gap: 10 }} onSubmit={changePwd}>
              <label className="field">{t.me.oldPwd}<input name="old" type="password" required autoComplete="current-password" /></label>
              <label className="field">{t.me.newPwd}<input name="new" type="password" required minLength={8} autoComplete="new-password" /></label>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn">{t.save}</button>
                <button type="button" className="btn ghost" onClick={() => setPwdOpen(false)}>{s.cancel}</button>
              </div>
            </form>
          ) : <button className="btn ghost" onClick={() => setPwdOpen(true)}>{s.pwdOpen}</button>}
        </Section>

        <Section title={s.logout} help={s.logoutHelp}>
          <button className="btn ghost" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={logout}>{s.logout}</button>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, help, children }) {
  return (
    <div className="card">
      <p className="card-title" style={{ margin: "0 0 2px" }}>{title}</p>
      <p className="muted small" style={{ margin: "0 0 14px" }}>{help}</p>
      {children}
    </div>
  );
}
