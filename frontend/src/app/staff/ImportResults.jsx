import { useState } from "react";
import { upload } from "../api.js";
import { Crumb, useApp } from "../ui.jsx";

export default function ImportResults() {
  const { t, toast } = useApp();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const p = t.importRes;
  async function onFile(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try { setRes(await upload("/events/import", f)); } catch { toast(t.error); } finally { setBusy(false); }
  }
  return (
    <>
      <Crumb items={[[p.title]]} />
      <h1>{p.title}</h1>
      <p className="subtitle">{p.sub}</p>
      <div className="grid g-main">
        <div className="card">
          <label className="btn" style={{ cursor: "pointer" }}>{busy ? "…" : p.choose}<input type="file" hidden accept=".xlsx,.csv" onChange={onFile} disabled={busy} /></label>
          {res && (
            <div style={{ marginTop: 20 }}>
              <p className="t-strong st-mastered">{p.saved(res.saved, res.students)}</p>
              {res.error_count > 0 && (
                <>
                  <p className="card-title" style={{ margin: "16px 0 8px" }}>{p.errors}: {res.error_count}</p>
                  <table className="heat"><tbody>
                    {res.errors.map((e) => (
                      <tr key={e.row}><td>{p.row} {e.row}</td><td className="st-gap">{p.fields[e.field]}</td><td className="muted small">{e.values.join(" ; ")}</td></tr>
                    ))}
                  </tbody></table>
                </>
              )}
            </div>
          )}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <p className="card-title" style={{ marginBottom: 8 }}>{p.example}</p>
          <pre className="small" style={{ background: "#f6f8fc", padding: 12, borderRadius: 8, overflowX: "auto", margin: 0 }}>{`логин;задание;верно;дата
alikhan.n;sqrt;1;01.10.2026
mariia.i;linear-eq;0;01.10.2026
mariia.i;sqrt-2;да;`}</pre>
        </div>
      </div>
    </>
  );
}
