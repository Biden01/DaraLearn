import { useEffect, useState } from "react";
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
    try {
      const u = await api("/auth/join", { method: "POST", body: { code } });
      setUser(u); e.target.reset(); toast(u.role === "teacher" ? t.me.joinedTeacher : t.me.joined);
    }
    catch (ex) {
      if (ex.code === "invalid_code") {
        // может быть кодом ребёнка: аккаунт без класса становится родительским
        try {
          await api("/parents/join", { method: "POST", body: { code } });
          setUser(await api("/auth/me")); window.location.hash = "#/"; toast(t.parent.added); return;
        } catch { /* не код ребёнка — покажем обычную ошибку */ }
      }
      const msg = { invalid_code: t.me.badCode, class_has_teacher: t.me.classHasTeacher, teacher_other_school: t.me.otherSchool }[ex.code];
      toast(msg || t.error);
    }
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

        {(student || user.role === "teacher") && (
          <Section title={student ? t.me.join : t.me.joinTeacher} help={student ? s.joinHelp : t.me.joinTeacherHelp}>
            <form className="row" onSubmit={join}>
              <input name="code" required minLength={4} maxLength={12} placeholder={t.me.joinCode} aria-label={t.me.joinCode}
                style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 9, padding: 11, textTransform: "uppercase", letterSpacing: 2 }} />
              <button className="btn">{t.save}</button>
            </form>
          </Section>
        )}

        {student && <ParentsSection />}

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

// Ученик даёт родителю одноразовый код и видит, кто подключён; отключить может в любой момент.
function ParentsSection() {
  const { t, toast } = useApp();
  const p = t.parents;
  const [d, setD] = useState(null);
  const load = () => api("/parents/mine").then(setD).catch(() => setD({ code: null, parents: [] }));
  useEffect(() => { load(); }, []);
  async function make() {
    try { const r = await api("/parents/code", { method: "POST" }); setD((x) => ({ ...x, code: r.code })); } catch { toast(t.error); }
  }
  async function unlink(id) {
    if (!window.confirm(p.confirmUnlink)) return;
    try { await api(`/parents/links/${id}`, { method: "DELETE" }); load(); } catch { toast(t.error); }
  }
  if (!d) return null;
  return (
    <Section title={p.title} help={p.help}>
      <div className="stack" style={{ gap: 10 }}>
        {d.code && <div>{p.yourCode} <b style={{ fontSize: 20, letterSpacing: 3 }}>{d.code}</b></div>}
        <div><button className="btn sm ghost" onClick={make}>{d.code ? p.again : p.make}</button></div>
        <div className="small">
          {d.parents.length ? (
            <>{p.linked}{d.parents.map((x) => (
              <div key={x.id} className="row between" style={{ padding: "6px 0" }}>
                <span>{x.name}</span><button className="btn sm ghost" onClick={() => unlink(x.id)}>{p.unlink}</button>
              </div>
            ))}</>
          ) : <span className="muted">{p.none}</span>}
        </div>
      </div>
    </Section>
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
