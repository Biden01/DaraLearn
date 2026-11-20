// Анализ и трек прогресса учеников учителя: освоение тем, активность и точность за 6 недель, последние тесты,
// кому нужно внимание и почему. Данные — /state/progress.
import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Icon, Loading, useApp } from "../ui.jsx";

const DAY = 86400000;

// почему ученику нужно внимание (пустой список — всё в порядке)
export function reasons(r, today) {
  const out = [];
  const idle = r.last_active ? Math.round((Date.parse(today) - Date.parse(r.last_active)) / DAY) : Infinity;
  if (idle >= 7) out.push("idle");
  if (r.percent < 30 && r.gaps >= 2) out.push("low");
  const acc = r.weeks.map((w) => w.accuracy).filter((x) => x != null);
  if (acc.length >= 2 && acc[acc.length - 1] <= acc[acc.length - 2] - 0.15) out.push("drop");
  const last = r.tests[r.tests.length - 1];
  if (last && last.pct < 50) out.push("test");
  return out;
}

// мини-график: столбики — ответов за неделю, линия — точность
function Spark({ weeks }) {
  const W = 132, H = 36, n = weeks.length, bw = W / n;
  const max = Math.max(1, ...weeks.map((w) => w.answers));
  const pts = weeks.map((w, i) => (w.accuracy == null ? null : [i * bw + bw / 2, 4 + (1 - w.accuracy) * (H - 8)]));
  const line = pts.filter(Boolean);
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {weeks.map((w, i) => {
        const h = w.answers ? Math.max(3, (w.answers / max) * (H - 4)) : 2;
        return <rect key={i} x={i * bw + 3} y={H - h} width={bw - 6} height={h} rx="2" className={w.answers ? "sp-bar" : "sp-bar none"} />;
      })}
      {line.length > 1 && <polyline points={line.map((p) => p.join(",")).join(" ")} className="sp-line" />}
      {line.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" className="sp-dot" />)}
    </svg>
  );
}

export default function StudentsProgress() {
  const { t } = useApp();
  const p = t.prog;
  const [d, setD] = useState(null);
  const [cls, setCls] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("attention");
  const [only, setOnly] = useState(false);
  useEffect(() => { api("/state/progress").then(setD).catch(() => setD(false)); }, []);

  const rows = useMemo(() => (d ? d.students.map((r) => ({ ...r, why: reasons(r, d.today) })) : []), [d]);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const scope = rows.filter((r) => !cls || String(r.class_id) === cls);
  const list = scope
    .filter((r) => (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (!only || r.why.length))
    .sort({
      attention: (a, b) => b.why.length - a.why.length || a.percent - b.percent,
      low: (a, b) => a.percent - b.percent, high: (a, b) => b.percent - a.percent,
      active: (a, b) => b.active_days_14 - a.active_days_14, name: (a, b) => a.name.localeCompare(b.name),
    }[sort]);

  const avg = scope.length ? Math.round(scope.reduce((a, r) => a + r.percent, 0) / scope.length) : 0;
  const thisWeek = scope.filter((r) => r.weeks[r.weeks.length - 1].answers > 0).length;
  const att = scope.filter((r) => r.why.length).length;
  const wk = scope.map((r) => r.weeks[r.weeks.length - 1]).filter((w) => w.accuracy != null);
  const acc = wk.length ? Math.round((100 * wk.reduce((a, w) => a + w.accuracy, 0)) / wk.length) : null;
  const ago = (iso) => {
    if (!iso) return p.never;
    const n = Math.round((Date.parse(d.today) - Date.parse(iso)) / DAY);
    return n <= 0 ? p.today : n === 1 ? p.yesterday : p.daysAgo(n);
  };

  const stats = [["trend", "", `${avg}%`, p.stats.avg], ["user", "green", `${thisWeek}/${scope.length}`, p.stats.active],
    ["info", att ? "red" : "green", att, p.stats.attention], ["target", "purple", acc == null ? "—" : `${acc}%`, p.stats.acc]];

  return (
    <div className="prog-page">
      <Crumb items={[[p.title]]} />
      <h1>{p.title}</h1>
      <p className="subtitle">{p.sub}</p>

      <div className="grid g-4 stats" style={{ marginBottom: 20 }}>
        {stats.map(([icon, c, v, l]) => (
          <div className="card row" key={l}><Box icon={icon} c={c} /><div><div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div><div className="muted small">{l}</div></div></div>
        ))}
      </div>

      {!rows.length ? <div className="card empty muted">{p.empty}</div> : (
        <div className="card">
          <div className="prog-filters">
            {d.classes.length > 1 && (
              <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label={t.sched.klass}>
                <option value="">{p.all}</option>{d.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <label className="search prog-search"><Icon n="search" s={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.search} aria-label={p.search} /></label>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="sort">
              {Object.entries(p.sort).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label className="row prog-only"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />{p.onlyAttention}</label>
          </div>

          <div className="prog-head hide-sm" aria-hidden="true">
            <span>{p.cols.student}</span><span>{p.cols.progress}</span><span>{p.cols.activity}</span><span>{p.cols.tests}</span><span>{p.cols.last}</span>
          </div>
          {list.length ? list.map((r) => {
            const last = r.tests[r.tests.length - 1], prev = r.tests[r.tests.length - 2];
            const w = r.weeks[r.weeks.length - 1];
            return (
              <a key={`${r.id}-${r.class_id}`} href={`#/student/${r.id}`} className={`prog-row ${r.why.length ? "warn" : ""}`}>
                <div className="prog-who">
                  <b>{r.name}</b>
                  <span className="muted small">{r.class_name}</span>
                  {r.why.length > 0 && <span className="prog-why">{r.why.map((k) => <em key={k}>{p.why[k]}</em>)}</span>}
                </div>
                <div className="prog-mastery">
                  <div className="row between small"><b>{r.percent}%</b><span className="muted">{p.topics(r.mastered, r.total)}</span></div>
                  <Bar p={r.percent} />
                  {r.gaps > 0 && <span className="small prog-gaps">{p.gaps(r.gaps)}</span>}
                </div>
                <div className="prog-act">
                  <Spark weeks={r.weeks} />
                  <span className="muted small">{p.days14(r.active_days_14)}{w.accuracy != null ? ` · ${p.accWeek(Math.round(w.accuracy * 100))}` : ""}</span>
                </div>
                <div className="prog-test">
                  {last ? (
                    <>
                      <b className={last.pct >= 80 ? "good" : last.pct >= 50 ? "mid" : "low"}>{last.pct}%</b>
                      {prev && last.pct !== prev.pct && (
                        <span className={`small ${last.pct > prev.pct ? "up" : "down"}`}>{last.pct > prev.pct ? "▲" : "▼"} {Math.abs(last.pct - prev.pct)}</span>
                      )}
                      <span className="muted small">{last.day.slice(8, 10)}.{last.day.slice(5, 7)}</span>
                    </>
                  ) : <span className="muted small">{p.noTests}</span>}
                </div>
                <div className="prog-last muted small">{ago(r.last_active)}<Icon n="chev" s={16} /></div>
              </a>
            );
          }) : <p className="muted" style={{ padding: "16px 0 0" }}>{p.nothing}</p>}
          <p className="muted small" style={{ margin: "14px 0 0" }}>{p.legend}</p>
        </div>
      )}
    </div>
  );
}
