import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useApp } from "../ui.jsx";

// Код ученика, по которому родитель привязывает свой аккаунт (см. /auth/register-parent и /auth/parent/link).
export default function FamilyCode() {
  const { t, toast } = useApp();
  const [code, setCode] = useState(null);
  useEffect(() => { api("/auth/family-code").then((r) => setCode(r.code)).catch(() => {}); }, []);
  if (!code) return null;
  async function copy() {
    try { await navigator.clipboard.writeText(code); toast(t.me.copied); } catch { /* */ }
  }
  return (
    <div className="card">
      <p className="card-title" style={{ marginBottom: 6 }}>{t.me.familyCode}</p>
      <p className="muted small" style={{ margin: "0 0 12px" }}>{t.me.familyCodeHelp}</p>
      <div className="row" style={{ gap: 10 }}>
        <span className="t-strong" style={{ fontSize: 22, letterSpacing: 3 }}>{code}</span>
        <button type="button" className="btn sm ghost" onClick={copy}>{t.me.copy}</button>
      </div>
    </div>
  );
}
