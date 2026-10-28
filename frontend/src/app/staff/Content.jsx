import { useEffect, useState } from "react";
import { api, download, upload } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";

export default function Content() {
  const { t, L, toast } = useApp();
  const [list, setList] = useState(null);
  const a = t.admin;
  const load = () => api("/content/admin/lessons").then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  async function onFile(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try { const r = await upload("/content/admin/tasks/import", f); toast(a.importDone(r.created, r.updated, r.errors.length)); load(); }
    catch { toast(t.error); }
  }
  if (!list) return <Loading />;
  const courses = [];
  list.forEach((l) => {
    const last = courses[courses.length - 1];
    if (last?.slug === l.course) last.lessons.push(l);
    else courses.push({ slug: l.course, title: l.course_title, lessons: [l] });
  });
  return (
    <>
      <Crumb items={[[a.content]]} />
      <div className="page-head">
        <h1>{a.content}</h1>
        <div className="row">
          <button className="btn ghost" onClick={() => download("/content/admin/tasks.xlsx", "daralearn-tasks.xlsx").catch(() => toast(t.error))}>{a.export}</button>
          <label className="btn" style={{ cursor: "pointer" }}>{a.importT}<input type="file" hidden accept=".xlsx" onChange={onFile} /></label>
        </div>
      </div>
      <div className="stack">
        {courses.map((c) => (
          <div className="card" key={c.slug}>
            <p className="card-title" style={{ marginBottom: 6 }}>{L(c.title)}</p>
            {c.lessons.map((l) => (
              <div className="list-item" key={l.slug}>
                <div className="grow"><div className="t-strong">{L(l.title)}</div><div className="muted small">{l.slug} · {a.tasks(l.tasks)}{l.prereqs.length ? ` · ← ${l.prereqs.join(", ")}` : ""}</div></div>
                {l.source === "admin" && <span className="badge orange">admin</span>}
                <a className="btn sm ghost" href={`#/edit/${l.slug}`}>{a.edit}</a>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
