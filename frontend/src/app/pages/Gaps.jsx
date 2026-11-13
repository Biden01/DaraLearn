import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Loading, Ring, fox, useApp } from "../ui.jsx";
import { actionHref } from "./actions.js";

export default function Gaps() {
  const { t, L } = useApp();
  const [d, setD] = useState(null);
  const [sort, setSort] = useState("priority");
  const [pos, setPos] = useState({}); // slug урока → место в программе (курс за курсом)
  useEffect(() => { api("/decisions/me").then(setD).catch(() => setD(false)); }, []);
  useEffect(() => {
    api("/content/courses?subject=math").then((cs) => {
      const m = {}; let i = 0;
      cs.forEach((c) => c.lessons.forEach((l) => { m[l.slug] = i++; }));
      setPos(m);
    }).catch(() => {});
  }, []);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const g = t.gaps;
  const main = d.recommendations.filter((r) => r.priority >= 2);
  const verify = d.recommendations.filter((r) => r.priority < 2);
  // «По приоритету» — только слабые темы, самые важные сверху.
  // «По порядку тем» — все темы с рекомендациями в порядке программы: видно, где в курсе проблемы.
  const byOrder = sort === "order";
  const at = (r) => pos[r.lesson] ?? 1e6 + r.order;
  const list = byOrder ? [...main, ...verify].sort((a, b) => at(a) - at(b)) : main;
  const causes = Object.entries(d.causes).filter(([c]) => c !== "not_enough");
  const badge = { 3: "red", 2: "orange", 1: "gray" };
  return (
    <>
      <Crumb items={[[t.nav.gaps]]} />
      <h1>{t.nav.gaps}</h1>
      <p className="subtitle">{g.sub}</p>
      {d.understanding === null ? (
        <div className="card soft row wrap" style={{ gap: 18 }}>
          <Box icon="doc" />
          <p className="grow" style={{ margin: 0 }}>{g.noData}</p>
          <a href="#/diagnostics" className="btn">{t.actions.diagnostic[0]}</a>
        </div>
      ) : (
        <>
          <div className="card soft row wrap" style={{ gap: 24, marginBottom: 20 }}>
            <Ring p={d.understanding} size={96} />
            <div className="grow"><div className="card-title">{g.understanding}</div>
              <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>{g.understandingText(d.understanding)}</p></div>
          </div>
          <div className="grid g-main">
            <div className="stack">
              <div className="card">
                <div className="card-head"><p className="card-title">{byOrder ? g.allTopics : g.weak}</p>
                  <div className="tabs">
                    <button className={sort === "priority" ? "on" : ""} onClick={() => setSort("priority")}>{g.byPriority}</button>
                    <button className={sort === "order" ? "on" : ""} onClick={() => setSort("order")}>{g.bySubject}</button>
                  </div>
                </div>
                {list.length ? list.map((r, i) => (
                  <div className="list-item wrap" key={r.lesson}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f3f6", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{i + 1}</div>
                    <div className="grow" style={{ minWidth: 180 }}>
                      <div className="t-strong">{L(r.title)}</div>
                      <div className="muted small">{t.causes[r.cause]}{r.action === "prereq" ? ` → ${L(r.target_title)}` : ""}</div>
                      {["accepted", "changed"].includes(r.status) && <div className="small st-mastered">{t.rec.byTeacher}{r.comment ? `: ${r.comment}` : ""}</div>}
                      <div style={{ marginTop: 8, maxWidth: 260 }}><Bar p={r.proof * 100} /></div>
                    </div>
                    <b style={{ width: 52, flex: "none", textAlign: "right" }}>{Math.round(r.proof * 100)}%</b>
                    <span className={`badge gap-badge ${r.priority >= 2 ? badge[r.priority] : "gray"}`}>{r.priority >= 2 ? g.priority[r.priority] : g.verifyTitle}</span>
                    <a href={actionHref(r)} className={`btn sm gap-btn ${r.priority === 3 ? "" : "ghost"}`}>{fox(t.actions[r.action][0])}</a>
                  </div>
                )) : <p className="muted">{g.empty}</p>}
              </div>
              {!byOrder && verify.length > 0 && (
                <div className="card">
                  <div className="card-head"><p className="card-title">{g.verifyTitle}</p><span className="muted small">{verify.length}</span></div>
                  <p className="muted small" style={{ marginTop: -8 }}>{t.causeHelp.not_enough}</p>
                  {verify.map((r) => (
                    <div className="list-item" key={r.lesson}>
                      <span className={`dot ${r.skill_status || r.status}`} /><span className="grow t-strong">{L(r.title)}</span>
                      <a href={actionHref(r)} className="btn sm ghost">{fox(t.actions[r.action][0])}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="stack">
              {causes.length > 0 && (
                <div className="card">
                  <div className="card-head"><p className="card-title">{g.why}</p></div>
                  {causes.map(([c, n]) => (
                    <div className="list-item" style={{ alignItems: "flex-start" }} key={c}>
                      <Box sym={n} c="orange" size={32} />
                      <div><div className="t-strong">{t.causes[c]}</div><p className="muted small" style={{ margin: "4px 0 0", lineHeight: 1.5 }}>{t.causeHelp[c]}</p></div>
                    </div>
                  ))}
                </div>
              )}
              {d.chain.length > 0 && (
                <div className="card">
                  <div className="card-head"><p className="card-title">{g.chain}</p></div>
                  <p className="muted small" style={{ marginTop: -8 }}>{g.chainText}</p>
                  <div className="stack" style={{ gap: 8, fontSize: 13 }}>
                    {d.chain.map((l, i) => (
                      <a key={l.slug} href={`#/lesson/${l.slug}`} className="row">
                        <span className={`badge ${l.status === "gap" ? "red" : l.status === "mastered" ? "green" : l.status === "learning" ? "orange" : "gray"}`} style={{ width: 22, textAlign: "center" }}>{i + 1}</span>
                        <span className="grow">{L(l.title)}</span><span className={`small st-${l.status}`}>{t.status[l.status]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

