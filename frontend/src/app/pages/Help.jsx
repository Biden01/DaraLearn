import { useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, useApp } from "../ui.jsx";

export default function Help() {
  const { t, toast } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const h = t.help;
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try { await api("/school/support", { method: "POST", body: { text } }); setText(""); toast(h.sent); } catch { toast(t.error); } finally { setBusy(false); }
  }
  return (
    <>
      <Crumb items={[[t.nav.help]]} />
      <h1>{h.title}</h1>
      <p className="subtitle">{h.sub}</p>
      <div className="grid g-main">
        <div className="card faq">{h.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <form className="card" style={{ alignSelf: "start" }} onSubmit={send}>
          <Box sym="?" size={40} />
          <p className="card-title" style={{ margin: "16px 0 8px" }}>{h.notFound}</p>
          <p className="muted small" style={{ lineHeight: 1.5 }}>{h.write}</p>
          <label className="field"><textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={h.placeholder} minLength={3} maxLength={3000} required aria-label={h.placeholder} /></label>
          <button className="btn block" style={{ marginTop: 12 }} disabled={busy}>{h.send}</button>
        </form>
      </div>
    </>
  );
}
