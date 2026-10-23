import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Loading, useApp } from "../ui.jsx";

export default function Subjects() {
  const { t, L, user } = useApp();
  const [list, setList] = useState(null);
  const [sel, setSel] = useState("math");
  const [filter, setFilter] = useState("all");
  useEffect(() => { api("/content/subjects").then(setList).catch(() => setList([])); }, []);
  if (!list) return <Loading />;

  const shown = list.filter((s) => filter === "all" || (filter === "active" ? s.active : !s.active));
  const s = list.find((x) => x.slug === sel) || list[0];
  const sp = t.subjects;
  return (
    <>
      <Crumb items={[[t.nav.subjects]]} />
      <h1>{t.nav.subjects}</h1>
      <p className="subtitle">{sp.sub}</p>
      <div className="chips">
        {[["all", t.all], ["active", sp.inprog], ["soon", t.soon]].map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="grid g-main">
        <div className="grid g-3" style={{ alignContent: "start" }}>
          {shown.map((x) => (
            <button key={x.slug} className={`subj-tile ${x.slug === s.slug ? "on" : ""}`} onClick={() => setSel(x.slug)} style={x.active ? undefined : { opacity: 0.7 }}>
              <div className="row between"><Box sym={x.sym} c={x.color} />
                {x.active ? <span className="badge">{x.progress.percent}%</span> : <span className="badge gray">{t.soon}</span>}</div>
              <div><div className="t-strong">{L(x.title)}</div><div className="muted small">{x.active ? sp.topics(x.progress.total) : sp.soonText}</div></div>
              {x.active && <><Bar p={x.progress.percent} /><div className="small muted">{sp.nextTopic}</div>
                <div className="small" style={{ fontWeight: 600 }}>{x.next ? L(x.next.title) : "—"}</div></>}
            </button>
          ))}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="row"><Box sym={s.sym} c={s.color} /><div><div className="card-title">{L(s.title)}</div><div className="muted small">{t.grade(user.grade)}</div></div></div>
          {s.active ? (
            <>
              <div style={{ margin: "22px 0 6px" }} className="muted small">{sp.nextTopic}</div>
              <div className="t-strong">{s.next ? L(s.next.title) : "—"}</div>
              <div className="row between" style={{ margin: "22px 0 10px" }}><span className="muted small">{sp.progressBy} · {sp.topics(s.progress.total)}</span><b>{s.progress.percent}%</b></div>
              <Bar p={s.progress.percent} />
              <div className="grid g-3" style={{ margin: "20px 0", textAlign: "center", gap: 10 }}>
                <div><div style={{ fontSize: 22, fontWeight: 700 }}>{s.progress.mastered}</div><div className="muted small">{sp.mastered}</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 700 }}>{s.progress.learning}</div><div className="muted small">{sp.inprog}</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 700 }}>{s.progress.left}</div><div className="muted small">{sp.left}</div></div>
              </div>
              <a href="#/courses" className="btn block">{sp.go}</a>
            </>
          ) : <p className="muted" style={{ marginTop: 18, lineHeight: 1.5 }}>{sp.soonText}</p>}
        </div>
      </div>
    </>
  );
}
