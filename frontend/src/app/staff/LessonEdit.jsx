import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";

const lines = (s) => s.split("\n").map((x) => x.trimEnd()).filter((x) => x.trim());
const optText = (o) => (typeof o === "string" ? o : `${o.kk} || ${o.ru}`);
const optParse = (s) => (s.includes("||") ? { kk: s.split("||")[0].trim(), ru: s.split("||")[1].trim() } : s.trim());

function TaskForm({ task, lesson, onSaved }) {
  const { t, toast } = useApp();
  const a = t.admin;
  const [f, setF] = useState(() => ({
    purpose: task?.purpose || "practice", qkk: task?.question.kk || "", qru: task?.question.ru || "",
    options: (task?.options || ["", "", "", ""]).map(optText).join("\n"), answer: (task?.answer ?? 0) + 1,
    ekk: task?.explanation.kk || "", eru: task?.explanation.ru || "",
  }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const body = { lesson, purpose: f.purpose, question: { kk: f.qkk, ru: f.qru }, options: lines(f.options).map(optParse),
      answer: Number(f.answer) - 1, explanation: { kk: f.ekk, ru: f.eru || f.ekk } };
    try {
      await api(task ? `/content/admin/tasks/${task.id}` : "/content/admin/tasks", { method: task ? "PUT" : "POST", body });
      toast(t.saved); onSaved();
    } catch { toast(t.error); }
  }
  async function archive() {
    try { await api(`/content/admin/tasks/${task.id}`, { method: "DELETE" }); onSaved(); } catch { toast(t.error); }
  }
  return (
    <form className="task stack" style={{ gap: 10 }} onSubmit={save}>
      <div className="row wrap">
        <label className="field">{a.taskEdit}<select value={f.purpose} onChange={set("purpose")}>{Object.entries(a.purpose).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field" style={{ width: 130 }}>{a.answer}<input type="number" min={1} max={6} value={f.answer} onChange={set("answer")} /></label>
        {task && <span className="muted small" style={{ alignSelf: "flex-end" }}>#{task.id} · {task.source}</span>}
      </div>
      <div className="grid g-2" style={{ gap: 10 }}>
        <label className="field">{a.qKk}<textarea rows={2} value={f.qkk} onChange={set("qkk")} required /></label>
        <label className="field">{a.qRu}<textarea rows={2} value={f.qru} onChange={set("qru")} required /></label>
      </div>
      <label className="field">{a.options}<textarea rows={4} value={f.options} onChange={set("options")} required /></label>
      <div className="grid g-2" style={{ gap: 10 }}>
        <label className="field">{a.exKk}<textarea rows={2} value={f.ekk} onChange={set("ekk")} /></label>
        <label className="field">{a.exRu}<textarea rows={2} value={f.eru} onChange={set("eru")} /></label>
      </div>
      <div className="row"><button className="btn sm">{t.save}</button>{task && task.purpose !== "archived" && <button type="button" className="btn sm ghost" onClick={archive}>{a.archive}</button>}</div>
    </form>
  );
}

export default function LessonEdit() {
  const { t, route, toast } = useApp();
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [adding, setAdding] = useState(false);
  const a = t.admin;
  const load = () => api(`/content/admin/lessons/${route.param}`).then((x) => {
    setD(x);
    setF({ tkk: x.title.kk, tru: x.title.ru, minutes: x.minutes, thkk: x.theory.kk.join("\n"), thru: x.theory.ru.join("\n"), prereqs: x.prereqs.join(", ") });
  }).catch(() => setD(false));
  useEffect(() => { load(); }, [route.param]);
  if (d === null || !f) return d === false ? <p className="muted">{t.error}</p> : <Loading />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const body = { title: { kk: f.tkk, ru: f.tru }, minutes: Number(f.minutes), theory: { kk: lines(f.thkk), ru: lines(f.thru) },
      examples: d.examples, prereqs: f.prereqs.split(",").map((x) => x.trim()).filter(Boolean) };
    try { await api(`/content/admin/lessons/${d.slug}`, { method: "PUT", body }); toast(t.saved); }
    catch (ex) { toast(ex.code?.startsWith("bad_prereqs") ? `${a.prereqs}: ${ex.code.split(":")[1]}` : t.error); }
  }
  return (
    <>
      <Crumb items={[[a.content, "#/content"], [d.slug]]} />
      <h1>{a.lessonEdit}</h1>
      <form className="card stack" style={{ gap: 12, marginBottom: 20 }} onSubmit={save}>
        <div className="grid g-2" style={{ gap: 12 }}>
          <label className="field">{a.titleKk}<input value={f.tkk} onChange={set("tkk")} required /></label>
          <label className="field">{a.titleRu}<input value={f.tru} onChange={set("tru")} required /></label>
        </div>
        <div className="grid g-2" style={{ gap: 12 }}>
          <label className="field">{a.minutes}<input type="number" min={1} max={180} value={f.minutes} onChange={set("minutes")} /></label>
          <label className="field">{a.prereqs}<input value={f.prereqs} onChange={set("prereqs")} placeholder="brackets, sqrt" /></label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>{a.theoryHelp}</p>
        <div className="grid g-2" style={{ gap: 12 }}>
          <label className="field">{a.theoryKk}<textarea rows={10} value={f.thkk} onChange={set("thkk")} /></label>
          <label className="field">{a.theoryRu}<textarea rows={10} value={f.thru} onChange={set("thru")} /></label>
        </div>
        <div><button className="btn">{t.save}</button></div>
      </form>
      <div className="card">
        <div className="card-head"><p className="card-title">{a.tasks(d.tasks.length)}</p><button className="btn sm" onClick={() => setAdding(!adding)}>{a.addTask}</button></div>
        {adding && <TaskForm lesson={d.slug} onSaved={() => { setAdding(false); load(); }} />}
        {d.tasks.map((task) => <TaskForm key={task.id + task.purpose} task={task} lesson={d.slug} onSaved={load} />)}
      </div>
    </>
  );
}
