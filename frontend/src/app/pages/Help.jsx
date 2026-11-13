import { useState } from "react";
import { api } from "../api.js";
import { Box, Crumb, fox, useApp } from "../ui.jsx";

export default function Help() {
  const { t, toast } = useApp();
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const h = t.help;
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try { await api("/school/support", { method: "POST", body: { text, topic } }); setText(""); setTopic(""); toast(h.sent); } catch { toast(t.error); } finally { setBusy(false); }
  }
  return (
    <>
      <Crumb items={[[t.nav.help]]} />
      <h1>{h.title}</h1>
      <p className="subtitle">{h.sub}</p>
      <div className="grid g-main">
        <div className="card faq">{h.faq.map(([q, a]) => <details key={q}><summary>{fox(q)}</summary><p>{fox(a)}</p></details>)}</div>
        <form className="card" style={{ alignSelf: "start" }} onSubmit={send}>
          <Box sym="?" size={40} />
          <p className="card-title" style={{ margin: "16px 0 8px" }}>{h.notFound}</p>
          <p className="muted small" style={{ lineHeight: 1.5 }}>{h.write}</p>
          <label className="field"><select value={topic} onChange={(e) => setTopic(e.target.value)} required aria-label={h.topic}>
            <option value="" disabled>{h.topic}</option>
            {Object.entries(h.topics).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
          <label className="field"><textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={h.placeholder} minLength={3} maxLength={3000} required aria-label={h.placeholder} /></label>
          <button className="btn block" style={{ marginTop: 12 }} disabled={busy}>{h.send}</button>
        </form>
      </div>
    </>
  );
}
