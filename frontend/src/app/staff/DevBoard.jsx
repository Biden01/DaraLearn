import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Crumb, Icon, Loading, useApp } from "../ui.jsx";

const LABELS = ["", "feature", "bug", "design", "content", "infra"];
const POINTS = [0, 1, 2, 3, 5, 8, 13];
const byPos = (a, b) => a.position - b.position || a.id - b.id;
const DRAG_THRESHOLD = 6; // px до начала переноса — отличает перенос от тапа/клика

// Scrum-доска команды как в Trello: колонки, перетаскивание карточек, исполнители, story points.
export default function DevBoard() {
  const { t, toast } = useApp();
  const d = t.dev;
  const [board, setBoard] = useState(null);
  const [who, setWho] = useState("");
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null); // {column, before} — куда упадёт карточка
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(null);
  const [sprints, setSprints] = useState([]);
  // перенос через Pointer Events — одна логика для мыши, тача и пера
  const pointerRef = useRef(null); // {id, column, pointerId, startX, startY, dragging}
  const justDraggedRef = useRef(false); // гасит click сразу после переноса

  const load = () => {
    api("/dev/board").then(setBoard).catch(() => toast(t.error));
    api("/dev/sprints").then(setSprints).catch(() => {});
  };
  useEffect(load, []);
  if (!board) return <Loading />;

  const tasks = board.tasks;
  const setTasks = (fn) => setBoard((b) => ({ ...b, tasks: fn(b.tasks) }));
  const inCol = (c) => tasks.filter((x) => x.column === c).sort(byPos);

  const save = async (id, patch) => {
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try { await api(`/dev/tasks/${id}`, { method: "PATCH", body: patch }); } catch { toast(t.error); load(); }
  };

  // новая позиция — середина между соседями, остальные карточки не трогаем
  const drop = (column, beforeId) => {
    const task = tasks.find((x) => x.id === drag);
    setDrag(null); setOver(null);
    if (!task || (task.column === column && task.id === beforeId)) return;
    const col = inCol(column).filter((x) => x.id !== task.id);
    const i = beforeId == null ? col.length : col.findIndex((x) => x.id === beforeId);
    const prev = col[i - 1]?.position, next = col[i]?.position;
    const position = prev == null && next == null ? 1 : prev == null ? next - 1 : next == null ? prev + 1 : (prev + next) / 2;
    save(task.id, { column, position });
  };

  // Pointer Events вместо HTML5 drag-and-drop: на тач-экранах draggable/dragstart не работают,
  // а pointerdown/move/up одинаково приходят от мыши, тача и пера.
  const onCardPointerDown = (e, task, column) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    justDraggedRef.current = false; // новый жест — старый флаг подавления клика больше не действует
    pointerRef.current = { id: task.id, column, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dragging: false };
  };

  const onCardPointerMove = (e) => {
    const p = pointerRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD) return;
      p.dragging = true;
      setDrag(p.id);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* перенос продолжится и без захвата */ }
    }
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cardEl = el?.closest("[data-task-id]");
    const colEl = el?.closest("[data-column]");
    if (cardEl && Number(cardEl.dataset.taskId) !== p.id) {
      setOver({ column: cardEl.dataset.column, before: Number(cardEl.dataset.taskId) });
    } else if (colEl) {
      setOver({ column: colEl.dataset.column, before: null });
    }
  };

  const onCardPointerUp = (e) => {
    const p = pointerRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    pointerRef.current = null;
    if (p.dragging) {
      justDraggedRef.current = true;
      drop(over?.column ?? p.column, over?.column ? over.before : null);
    }
  };

  const onCardPointerCancel = (e) => {
    const p = pointerRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    pointerRef.current = null;
    if (p.dragging) { justDraggedRef.current = true; setDrag(null); setOver(null); }
  };

  const onCardClick = (task) => {
    if (justDraggedRef.current) { justDraggedRef.current = false; return; }
    setEdit(task);
  };

  const create = async (column, title) => {
    try {
      const x = await api("/dev/tasks", { method: "POST", body: { title, column, assignee: who } });
      setTasks((ts) => [...ts, x]);
    } catch { toast(t.error); }
  };

  const remove = async (id) => {
    if (!window.confirm(d.confirmDelete)) return;
    setEdit(null);
    setTasks((ts) => ts.filter((x) => x.id !== id));
    try { await api(`/dev/tasks/${id}`, { method: "DELETE" }); } catch { toast(t.error); load(); }
  };

  const closeSprint = async () => {
    if (!window.confirm(d.confirmClose(inCol("done").length))) return;
    try {
      const r = await api("/dev/sprint/close", { method: "POST" });
      toast(d.closed(r.sprint, r.closed, r.points));
      load();
    } catch { toast(t.error); }
  };

  const sprintTasks = tasks.filter((x) => x.column !== "backlog");
  const pts = (list) => list.reduce((s, x) => s + x.points, 0);
  const donePts = pts(inCol("done"));
  const allPts = pts(sprintTasks);

  return (
    <>
      <Crumb items={[[d.title]]} />
      <div className="row between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0 }}>{d.title} · {d.sprint(board.sprint)}</h1>
          <div className="muted small">{d.progress(donePts, allPts)}</div>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button className={`chip ${who === "" ? "on" : ""}`} onClick={() => setWho("")}>{d.all}</button>
          {board.team.map((m) => (
            <button key={m} className={`chip ${who === m ? "on" : ""}`} onClick={() => setWho(who === m ? "" : m)}>
              <span className={`dev-ava m-${m}`}>{m[0].toUpperCase()}</span> {m}
              <span className="muted"> {sprintTasks.filter((x) => x.assignee === m && x.column !== "done").length}</span>
            </button>
          ))}
          <button className="btn sm" onClick={closeSprint} disabled={!inCol("done").length}>{d.closeSprint}</button>
        </div>
      </div>
      {allPts > 0 && <div className="bar" style={{ marginBottom: 16 }}><span style={{ width: `${(donePts / allPts) * 100}%` }} /></div>}

      <div className="dev-board">
        {board.columns.map((c) => {
          const list = inCol(c);
          const shown = list.filter((x) => !who || x.assignee === who);
          return (
            <section key={c} data-column={c} className={`dev-col ${c === "backlog" ? "backlog" : ""} ${over?.column === c ? "over" : ""}`}>
              <header className="dev-col-head">
                <b>{d.cols[c]}</b>
                <span className="muted small">{list.length} · {pts(list)} {d.pt}</span>
              </header>
              <div className="dev-cards">
                {shown.map((x) => (
                  <article key={x.id} data-task-id={x.id} data-column={c}
                    className={`dev-card ${drag === x.id ? "dragging" : ""} ${over?.before === x.id ? "drop-before" : ""}`}
                    onPointerDown={(e) => onCardPointerDown(e, x, c)} onPointerMove={onCardPointerMove}
                    onPointerUp={onCardPointerUp} onPointerCancel={onCardPointerCancel}
                    onClick={() => onCardClick(x)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEdit(x)}>
                    {x.label && <span className={`dev-label l-${x.label}`}>{d.labels[x.label]}</span>}
                    <div className="dev-card-title">{x.title}</div>
                    <div className="row between" style={{ marginTop: 8 }}>
                      <span className="muted small">#{x.id}{x.description ? " · ≡" : ""}</span>
                      <span className="row" style={{ gap: 6 }}>
                        {x.points > 0 && <span className="badge gray">{x.points}</span>}
                        {x.assignee && <span className={`dev-ava m-${x.assignee}`} title={x.assignee}>{x.assignee[0].toUpperCase()}</span>}
                      </span>
                    </div>
                  </article>
                ))}
                {over?.column === c && over.before == null && drag && <div className="dev-drop" />}
              </div>
              {adding === c ? (
                <AddCard onAdd={(title) => create(c, title)} onClose={() => setAdding(null)} />
              ) : (
                <button className="dev-add" onClick={() => setAdding(c)}><Icon n="plus" s={16} /> {d.add}</button>
              )}
            </section>
          );
        })}
      </div>

      {sprints.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>{d.history}</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {sprints.map((s) => <span key={s.sprint} className="badge gray">{d.sprint(s.sprint)}: {s.tasks} · {s.points} {d.pt}</span>)}
          </div>
        </div>
      )}

      {edit && <EditCard task={edit} team={board.team} columns={board.columns} onClose={() => setEdit(null)}
        onSave={(patch) => { save(edit.id, patch); setEdit(null); }} onDelete={() => remove(edit.id)} />}
    </>
  );
}

function AddCard({ onAdd, onClose }) {
  const { t } = useApp();
  const [title, setTitle] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (title.trim()) onAdd(title.trim());
    setTitle("");
  };
  return (
    <form onSubmit={submit} className="dev-new">
      <textarea autoFocus rows={2} value={title} placeholder={t.dev.newTitle} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) submit(e);
          if (e.key === "Escape") onClose();
        }} />
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sm" type="submit">{t.dev.add}</button>
        <button className="btn sm ghost" type="button" onClick={onClose} aria-label={t.dev.cancel}><Icon n="x" s={14} /></button>
      </div>
    </form>
  );
}

function EditCard({ task, team, columns, onClose, onSave, onDelete }) {
  const { t } = useApp();
  const d = t.dev;
  const [f, setF] = useState(task);
  const set = (k) => (e) => setF({ ...f, [k]: k === "points" ? Number(e.target.value) : e.target.value });
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    const { title, description, column, assignee, points, label } = f;
    onSave({ title: title.trim(), description, column, assignee, points, label });
  };
  return (
    <div className="dev-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card dev-dialog stack" role="dialog" aria-label={task.title} onSubmit={submit}>
        <div className="row between">
          <span className="muted small">#{task.id}</span>
          <button type="button" className="btn sm ghost" onClick={onClose} aria-label={d.cancel}><Icon n="x" s={14} /></button>
        </div>
        <label className="field">{d.name}<input value={f.title} onChange={set("title")} maxLength={300} required /></label>
        <label className="field">{d.description}<textarea rows={5} value={f.description} onChange={set("description")} maxLength={5000} /></label>
        <div className="dev-grid">
          <label className="field">{d.column}<select value={f.column} onChange={set("column")}>
            {columns.map((c) => <option key={c} value={c}>{d.cols[c]}</option>)}</select></label>
          <label className="field">{d.assignee}<select value={f.assignee} onChange={set("assignee")}>
            <option value="">—</option>{team.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          <label className="field">{d.points}<select value={f.points} onChange={set("points")}>
            {POINTS.map((p) => <option key={p} value={p}>{p || "—"}</option>)}</select></label>
          <label className="field">{d.label}<select value={f.label} onChange={set("label")}>
            {LABELS.map((l) => <option key={l} value={l}>{l ? d.labels[l] : "—"}</option>)}</select></label>
        </div>
        <div className="row between">
          <button type="button" className="btn sm ghost" onClick={onDelete}><Icon n="trash" s={14} /> {d.delete}</button>
          <button className="btn sm" type="submit">{d.save}</button>
        </div>
      </form>
    </div>
  );
}
