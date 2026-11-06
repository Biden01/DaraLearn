import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";

const lines = (s) => s.split("\n").map((x) => x.trimEnd()).filter((x) => x.trim());
const optText = (o) => (typeof o === "string" ? o : `${o.kk} || ${o.ru}`);
const optParse = (s) => (s.includes("||") ? { kk: s.split("||")[0].trim(), ru: s.split("||")[1].trim() } : s.trim());

function TaskForm({ task, draft, lesson, onSaved, onDiscard }) {
  const { t, toast } = useApp();
  const a = t.admin;
  const src = task || draft; // draft — ИИ-черновик: форма заполнена, но это новое задание
  const [f, setF] = useState(() => ({
    purpose: src?.purpose || "practice", qkk: src?.question.kk || "", qru: src?.question.ru || "",
    options: (src?.options || ["", "", "", ""]).map(optText).join("\n"), answer: (src?.answer ?? 0) + 1,
    ekk: src?.explanation.kk || "", eru: src?.explanation.ru || "", errors: src?.option_errors || [],
  }));
  const optCount = lines(f.options).length;
  const setErr = (i) => (e) => { const errors = [...f.errors]; errors[i] = e.target.value; setF({ ...f, errors }); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const body = { lesson, purpose: f.purpose, question: { kk: f.qkk, ru: f.qru }, options: lines(f.options).map(optParse),
      answer: Number(f.answer) - 1, explanation: { kk: f.ekk, ru: f.eru || f.ekk }, ...(draft ? { ai: true } : {}),
      option_errors: Array.from({ length: optCount }, (_, i) => (i === Number(f.answer) - 1 ? "" : f.errors[i] || "")) };
    try {
      await api(task ? `/content/admin/tasks/${task.id}` : "/content/admin/tasks", { method: task ? "PUT" : "POST", body });
      toast(t.saved); onSaved();
    } catch { toast(t.error); }
  }
  async function archive() {
    try { await api(`/content/admin/tasks/${task.id}`, { method: "DELETE" }); onSaved(); } catch { toast(t.error); }
  }
  return (
    <form className={`task stack ${draft ? "task-draft" : ""}`} style={{ gap: 10 }} onSubmit={save}>
      {draft && <p className="small" style={{ margin: 0, color: "var(--orange)" }}>{a.gen.check}</p>}
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
      {optCount > 0 && (
        <div className="row wrap" style={{ gap: 8 }} title={t.errHelp}>
          {Array.from({ length: optCount }, (_, i) => (
            <label key={i} className="field" style={{ width: 120 }}>{i + 1}
              {i === Number(f.answer) - 1
                ? <input value="✓" disabled />
                : <select value={f.errors[i] || ""} onChange={setErr(i)}>
                    {Object.entries(t.errKinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
            </label>
          ))}
        </div>
      )}
      <div className="grid g-2" style={{ gap: 10 }}>
        <label className="field">{a.exKk}<textarea rows={2} value={f.ekk} onChange={set("ekk")} /></label>
        <label className="field">{a.exRu}<textarea rows={2} value={f.eru} onChange={set("eru")} /></label>
      </div>
      <div className="row">
        <button className="btn sm">{draft ? a.gen.accept : t.save}</button>
        {draft && <button type="button" className="btn sm ghost" onClick={onDiscard}>{a.gen.discard}</button>}
        {task && task.purpose !== "archived" && <button type="button" className="btn sm ghost" onClick={archive}>{a.archive}</button>}
      </div>
    </form>
  );
}

export default function LessonEdit() {
  const { t, route, toast } = useApp();
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState([]); // [{key, ...draft}]
  const [gen, setGen] = useState({ purpose: "practice", count: 3, busy: false });
  const a = t.admin;
  const load = () => api(`/content/admin/lessons/${route.param}`).then((x) => {
    setD(x);
    setF({ tkk: x.title.kk, tru: x.title.ru, minutes: x.minutes, thkk: x.theory.kk.join("\n"), thru: x.theory.ru.join("\n"), prereqs: x.prereqs.join(", ") });
  }).catch(() => setD(false));
  useEffect(() => { load(); }, [route.param]);
  if (d === null || !f) return d === false ? <p className="muted">{t.error}</p> : <Loading />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function generate() {
    setGen((g) => ({ ...g, busy: true }));
    try {
      const r = await api(`/content/admin/lessons/${d.slug}/generate`, { method: "POST", body: { purpose: gen.purpose, count: Number(gen.count) } });
      setDrafts((ds) => [...r.drafts.map((x) => ({ ...x, key: `${Date.now()}-${Math.random()}` })), ...ds]);
    } catch (ex) {
      toast(a.gen.errors[ex.code] || a.gen.errors.fail);
    } finally { setGen((g) => ({ ...g, busy: false })); }
  }
  const dropDraft = (key) => setDrafts((ds) => ds.filter((x) => x.key !== key));
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
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><p className="card-title">{a.gen.title}</p></div>
        <p className="muted small" style={{ marginTop: 0 }}>{a.gen.help}</p>
        <div className="row wrap" style={{ gap: 10, alignItems: "flex-end" }}>
          <label className="field">{a.taskEdit}<select value={gen.purpose} onChange={(e) => setGen({ ...gen, purpose: e.target.value })}>
            {["diagnostic", "practice", "verification"].map((k) => <option key={k} value={k}>{a.purpose[k]}</option>)}</select></label>
          <label className="field" style={{ width: 110 }}>{a.gen.count}<select value={gen.count} onChange={(e) => setGen({ ...gen, count: e.target.value })}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <button type="button" className="btn sm" onClick={generate} disabled={gen.busy}>{gen.busy ? a.gen.running : a.gen.run}</button>
        </div>
        {drafts.map((x) => (
          <TaskForm key={x.key} draft={x} lesson={d.slug} onDiscard={() => dropDraft(x.key)} onSaved={() => { dropDraft(x.key); load(); }} />
        ))}
      </div>
      <div className="card">
        <div className="card-head"><p className="card-title">{a.tasks(d.tasks.length)}</p><button className="btn sm" onClick={() => setAdding(!adding)}>{a.addTask}</button></div>
        {adding && <TaskForm lesson={d.slug} onSaved={() => { setAdding(false); load(); }} />}
        {d.tasks.map((task) => <TaskForm key={task.id + task.purpose} task={task} lesson={d.slug} onSaved={load} />)}
      </div>
    </>
  );
}
