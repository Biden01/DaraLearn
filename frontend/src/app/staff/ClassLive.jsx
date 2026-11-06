import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Crumb, Icon, Loading, useApp } from "../ui.jsx";

const LIVE_MS = 5000;
const BADGE = { called: "red", stuck: "orange", active: "green", idle: "gray", absent: "gray" };

// Живой экран урока (как Mission Control в SchoolAI): кто позвал, кто застрял, кто работает — обновляется сам.
export default function ClassLive() {
  const { t, L, route, user, go } = useApp();
  const v = t.live;
  const [d, setD] = useState(null);
  const busy = useRef(false);
  const id = route.param;

  useEffect(() => {
    const load = async () => {
      if (busy.current || document.hidden) return;
      busy.current = true;
      try { setD(await api(`/state/classes/${id}/live`)); } catch { setD((x) => x ?? false); } finally { busy.current = false; }
    };
    load();
    const timer = setInterval(load, LIVE_MS);
    document.addEventListener("visibilitychange", load);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, [id]);

  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;
  const ago = (iso) => {
    if (!iso) return "—";
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    return m < 1 ? v.now : v.ago(m);
  };
  const c = d.counts;
  return (
    <>
      <Crumb items={[[t.classes.title, "#/" + (user.role === "teacher" ? "" : "classes")], [d.class.name, `#/class/${id}`], [v.title]]} />
      <div className="row between wrap" style={{ gap: 10 }}>
        <h1 style={{ margin: 0 }}>{v.title} · {d.class.name}</h1>
        <span className="muted small row" style={{ gap: 6 }}><span className="live-dot" />{v.auto}</span>
      </div>
      <p className="subtitle">{v.sub}</p>

      <div className="grid g-4" style={{ gap: 12, marginBottom: 16 }}>
        <Tile n={c.called} label={v.st.called} c="red" />
        <Tile n={c.stuck} label={v.st.stuck} c="orange" />
        <Tile n={c.active} label={v.st.active} c="green" />
        <Tile n={d.accuracy == null ? "—" : `${Math.round(d.accuracy * 100)}%`} label={v.accuracy} />
      </div>

      {d.groups.length > 0 && (
        <div className="card soft" style={{ marginBottom: 16 }}>
          <p className="card-title" style={{ margin: "0 0 6px" }}>{v.groups}</p>
          {d.groups.map((g, i) => <div key={i} className="small">{L(g.lesson)}: {g.students.join(", ")}</div>)}
        </div>
      )}

      <div className="card">
        {d.students.length === 0 && <p className="muted">{v.empty}</p>}
        {d.students.map((s) => (
          <div key={s.id} className="list-item wrap" style={{ alignItems: "flex-start" }}>
            <span className={`badge ${BADGE[s.status]}`} style={{ minWidth: 112, textAlign: "center" }}>{v.st[s.status]}</span>
            <div className="grow" style={{ minWidth: 200 }}>
              <a href={`#/student/${s.id}`} className="t-strong">{s.name}</a>
              <div className="muted small">
                {s.lesson ? L(s.lesson) : v.noTopic}
                {s.status === "stuck" && ` · ${v.wrong(s.wrong_streak)}`}
              </div>
              {s.call && <div className="small" style={{ marginTop: 4, color: "var(--red)" }}>
                <Icon n="bell" s={14} /> {v.reason[s.call.reason] || s.call.reason}{s.call.text ? `: «${s.call.text}»` : ""}</div>}
            </div>
            <div className="small muted" style={{ textAlign: "right", minWidth: 150 }}>
              <div>{v.answers(s.correct, s.answers)}</div>
              <div>{s.plan == null ? v.noPlan : v.plan(Math.round(s.plan * 100))} · {ago(s.last_at)}</div>
            </div>
          </div>
        ))}
      </div>
      {d.students.some((s) => s.call) && (
        <p className="muted small" style={{ marginTop: 10 }}>{v.feedHint} <a className="link" onClick={() => go("#/feed")} href="#/feed">{v.toFeed}</a></p>
      )}
    </>
  );
}

function Tile({ n, label, c }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: c ? `var(--${c})` : undefined }}>{n}</div>
      <div className="muted small">{label}</div>
    </div>
  );
}
