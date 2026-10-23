import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Icon, Loading, Ring, useApp } from "../ui.jsx";

export default function Progress() {
  const { t, L } = useApp();
  const [d, setD] = useState(null);
  const [range, setRange] = useState("week");
  useEffect(() => { api("/state/me").then(setD).catch(() => setD(false)); }, []);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const pp = t.progress;
  const series = range === "week" ? d.activity.week.map((v, i) => [pp.dow[i], v])
    : range === "month" ? d.activity.month.map((v, i) => [pp.weeks[i], v])
      : d.activity.year.map((x) => [pp.months[x.m - 1], x.v]);
  const max = Math.max(...series.map((x) => x[1]), 1);
  const top = series.findIndex((x) => x[1] === max);
  const acc = d.stats.acc_this_week;
  const delta = acc != null && d.stats.acc_last_week != null ? Math.round(100 * (acc - d.stats.acc_last_week)) : null;
  const stats = [["clip", "", d.stats.tasks, pp.tasks], ["doc", "purple", d.stats.tests, pp.tests],
    ["check", "green", `${d.stats.mastered} / ${d.progress.total}`, pp.mastered],
    ["chart", "orange", acc != null ? `${Math.round(acc * 100)}%${delta != null ? ` (${delta >= 0 ? "+" : ""}${delta})` : ""}` : "—", pp.accuracy]];
  const achIcons = { first_step: "star", diagnostic: "doc", perfect_test: "target", streak5: "fire", five_mastered: "book", all_mastered: "check" };
  const got = Object.values(d.achievements).filter(Boolean).length;
  return (
    <>
      <Crumb items={[[t.nav.progress]]} />
      <div className="page-head">
        <div><h1>{pp.title}</h1><p className="subtitle">{pp.sub}</p></div>
        <div className="tabs">{Object.entries(pp.range).map(([k, l]) => <button key={k} className={range === k ? "on" : ""} onClick={() => setRange(k)}>{l}</button>)}</div>
      </div>
      <div className="grid g-4" style={{ marginBottom: 20 }}>
        {stats.map(([icon, c, v, l]) => (
          <div className="card row" key={l}><Box icon={icon} c={c} /><div><div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="muted small">{l}</div></div></div>
        ))}
      </div>
      <div className="grid g-main" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-head"><p className="card-title">{pp.activity}</p><span className="muted small">{pp.range[range]}</span></div>
          <div className="muted small">{pp.activityUnit}</div>
          <div className="chart" role="img" aria-label={series.map(([l, v]) => `${l}: ${v}`).join(", ")}>
            {series.map(([l, v], i) => (
              <div key={l + i} className={`col ${v && i === top ? "top" : ""}`}><span className="v">{v}</span><i style={{ height: `${Math.max((v / max) * 150, 3)}px` }} /></div>
            ))}
          </div>
          <div className="chart-labels">{series.map(([l], i) => <span key={l + i}>{l}</span>)}</div>
          <div className="note" style={{ marginTop: 18 }}>{max > 1 || series.some((x) => x[1]) ? pp.best(max) : pp.empty}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="card-title" style={{ textAlign: "left", margin: "0 0 20px" }}>{t.home.progress}</p>
          <div style={{ display: "grid", placeItems: "center" }}><Ring p={d.progress.percent} size={130} /></div>
          <div className="t-strong" style={{ marginTop: 18 }}>{t.home.progressText(d.progress.mastered, d.progress.total)}</div>
          <a href="#/" className="btn block" style={{ marginTop: 16 }}>{t.continue} <Icon n="arrow" s={16} /></a>
        </div>
      </div>
      <div className="grid g-2">
        <div className="card">
          <div className="card-head"><p className="card-title">{pp.topics}</p><span className="muted small">{pp.practiceVs}</span></div>
          {d.lessons.map((l) => (
            <a href={`#/lesson/${l.slug}`} className="list-item" key={l.slug}>
              <span className={`dot ${l.status}`} />
              <div className="grow">
                <div className="row between"><span className="t-strong small">{L(l.title)}</span><span className={`small st-${l.status}`}>{t.status[l.status]}</span></div>
                <div style={{ marginTop: 6 }}><Bar p={l.proof * 100} /></div>
              </div>
              <span className="muted small" style={{ width: 70, textAlign: "right" }}>{Math.round(l.practice * 100)} / {Math.round(l.proof * 100)}%</span>
            </a>
          ))}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <div className="card-head"><p className="card-title">{pp.achievements}</p><span className="muted small">{t.of(got, 6)}</span></div>
          <div className="grid g-2" style={{ gap: 12 }}>
            {Object.entries(pp.ach).map(([k, [h, desc]]) => (
              <div key={k} className="row" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, opacity: d.achievements[k] ? 1 : 0.45 }}>
                <Box icon={achIcons[k]} c={d.achievements[k] ? "orange" : ""} size={36} />
                <div><div className="t-strong small">{h}</div><div className="muted small">{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
