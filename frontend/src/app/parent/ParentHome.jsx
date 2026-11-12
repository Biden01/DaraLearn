import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Box, Loading, useApp } from "../ui.jsx";

// Ата-ана кабинеті: тек байланыстырылған балалардың тізімі. Рейтинг/салыстыру жоқ (PLAN.md §9).
export default function ParentHome() {
  const { t } = useApp();
  const [kids, setKids] = useState(undefined);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const p = t.parent;

  const load = () => api("/auth/me/children").then(setKids).catch(() => setKids([]));
  useEffect(load, []);

  async function link(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/auth/parent/link", { method: "POST", body: { family_code: code } });
      setCode("");
      load();
    } catch (ex) {
      setErr(ex.code === "bad_family_code" ? t.auth.errors.bad_family_code : t.error);
    } finally {
      setBusy(false);
    }
  }

  if (kids === undefined) return <Loading />;
  return (
    <>
      <h1>{p.title}</h1>
      <p className="subtitle">{p.readOnly}</p>
      <div className="grid g-main">
        <div className="stack">
          {kids.length ? kids.map((k) => (
            <a key={k.id} href={`#/child/${k.id}`} className="card row" style={{ textDecoration: "none" }}>
              <Box icon="user" size={44} />
              <div className="grow"><div className="t-strong">{k.name}</div><div className="muted small">{t.grade(k.grade)}</div></div>
            </a>
          )) : <p className="muted">{p.empty}</p>}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <p className="card-title" style={{ marginBottom: 6 }}>{p.add}</p>
          <p className="muted small" style={{ margin: "0 0 14px" }}>{p.addHelp}</p>
          <form className="row" onSubmit={link}>
            <input value={code} onChange={(e) => setCode(e.target.value)} required minLength={4} maxLength={8}
              placeholder={p.code} aria-label={p.code}
              style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: 11, textTransform: "uppercase", letterSpacing: 2 }} />
            <button className="btn" disabled={busy}>{t.save}</button>
          </form>
          {err && <p className="form-error" role="alert">{err}</p>}
        </div>
      </div>
    </>
  );
}
