import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { Bar, Box, Crumb, Dara, Icon, Loading, Ring, useApp } from "../ui.jsx";
import { dateKk } from "../kk.js";

// «Мои достижения»: все тесты (ПҚС/БЖБ, диагностика, проверка знаний) — динамика, где теряются баллы, разбор ошибок.
const KIND_ICON = { pqs: ["doc", "purple"], diagnostic: ["docchk", ""], verification: ["checkc", "green"] };
const level = (p) => (p >= 80 ? "good" : p >= 50 ? "mid" : "low");
const tutorHref = (lesson, task) => `#/tutor?lesson=${lesson}${task ? `&task=${task}` : ""}`;

function useDate() {
  const { lang } = useApp();
  // браузеры часто не знают казахских месяцев — для kk свои таблицы (kk.js)
  return (iso, opts = { day: "numeric", month: "long", year: "numeric" }) => {
    const d = new Date(iso);
    return lang === "kk" ? `${dateKk(d, opts)}${opts.year ? ` ${d.getFullYear()} ж.` : ""}` : d.toLocaleDateString("ru-RU", opts);
  };
}

function TutorBtn({ lesson, task, short, ghost }) {
  const { t } = useApp();
  return (
    <a href={tutorHref(lesson, task)} className={`btn sm ach-tutor ${ghost ? "ghost" : ""}`}>
      <Dara s={16} />{short ? t.ach.toTutorShort : t.ach.toTutor}
    </a>
  );
}

function Delta({ d }) {
  const { t } = useApp();
  if (d == null) return null;
  const cls = d > 0 ? "up" : d < 0 ? "down" : "";
  return <span className={`ach-delta ${cls}`}>{d > 0 ? "▲" : d < 0 ? "▼" : "•"} {t.ach.vsPrev(d)}</span>;
}

export default function Achievements() {
  const { route } = useApp();
  return route.param ? <TestDetail id={route.param} /> : <Overview />;
}

function Overview() {
  const { t, L } = useApp();
  const a = t.ach;
  const fmt = useDate();
  const [d, setD] = useState(null);
  const [kind, setKind] = useState("all");
  useEffect(() => { api("/results/me").then(setD).catch(() => setD(false)); }, []);
  const tests = useMemo(() => (d ? d.tests.filter((x) => kind === "all" || x.kind === kind) : []), [d, kind]);
  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;

  const kinds = ["all", ...["pqs", "diagnostic", "verification"].filter((k) => d.tests.some((x) => x.kind === k))];
  const last = tests[0];
  const best = tests.reduce((m, x) => (m == null || x.pct > m.pct ? x : m), null);
  const head = (
    <>
      <Crumb items={[[t.nav.results]]} />
      <div className="page-head">
        <div><h1>{a.title}</h1><p className="subtitle">{a.sub}</p></div>
        {kinds.length > 2 && (
          <div className="tabs ach-tabs" role="tablist">
            {kinds.map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                {k === "all" ? t.all : a.kinds[k]}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (!d.tests.length) {
    return (
      <>
        {head}
        <div className="card ach-empty">
          <span className="ach-empty-ico"><Icon n="trophy" s={30} /></span>
          <h2>{a.empty}</h2>
          <p className="muted">{a.emptySub}</p>
          <a href="#/diagnostics" className="btn">{a.emptyBtn} <Icon n="arrow" s={16} /></a>
        </div>
      </>
    );
  }

  const stats = [
    ["doc", "purple", tests.length, a.stats.tests],
    ["chart", "", last ? `${last.pct}%` : "—", a.stats.last, last && last.prev_pct != null ? last.pct - last.prev_pct : null],
    ["trophy", "orange", best ? `${best.pct}%` : "—", a.stats.best],
    ["gaps", "red", last ? last.total - last.score : "—", a.stats.lost],
  ];
  return (
    <>
      {head}
      <div className="grid g-4 stats" style={{ marginBottom: 20 }}>
        {stats.map(([icon, c, v, l, delta]) => (
          <div className="card row" key={l}>
            <Box icon={icon} c={c} />
            <div><div className="ach-stat-v">{v}{delta != null && <Delta d={delta} />}</div><div className="muted small">{l}</div></div>
          </div>
        ))}
      </div>

      <div className="grid g-main" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-head"><p className="card-title">{a.trend}</p><span className="muted small">{a.trendSub}</span></div>
          <TrendChart tests={[...tests].reverse()} />
        </div>
        <div className="card">
          <div className="card-head" style={{ marginBottom: 8 }}><p className="card-title">{a.lostTitle}</p><span className="muted small">{a.lostSub}</span></div>
          {d.topics.length ? d.topics.slice(0, 6).map((tp) => (
            <div className="ach-topic" key={tp.lesson}>
              <div className="ach-topic-top">
                <span className="t-strong small">{L(tp.title)}</span>
                <b className="ach-lost">−{tp.lost}</b>
              </div>
              <Bar p={(100 * (tp.total - tp.lost)) / tp.total} />
              <div className="ach-topic-foot">
                <span className="muted small">{a.lostOf(tp.lost, tp.total)}</span>
                {tp.status === "mastered"
                  ? <span className="ach-fixed"><Icon n="check" s={14} />{a.fixed}</span>
                  : <TutorBtn lesson={tp.lesson} short ghost />}
              </div>
            </div>
          )) : <p className="muted small">{a.noneLost}</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><p className="card-title">{a.history}</p><span className="muted small">{a.historySub}</span></div>
        {tests.length ? (
          <div className="ach-list">
            {tests.map((x) => {
              const [ic, c] = KIND_ICON[x.kind] || ["doc", ""];
              const lost = x.skills.filter((s) => s.lost);
              return (
                <a href={`#/results/${x.id}`} className="ach-row" key={x.id}>
                  <Box icon={ic} c={c} size={40} />
                  <div className="ach-row-main">
                    <div className="ach-row-title">
                      <span className={`ach-kind k-${x.kind}`}>{a.kinds[x.kind]}</span>
                      {x.title && <span className="t-strong">{L(x.title)}</span>}
                    </div>
                    <div className="muted small ach-row-sub">
                      {fmt(x.date)}
                      {lost.length ? <> · {a.lostIn} {lost.slice(0, 2).map((s) => `${L(s.title)} −${s.lost}`).join(", ")}{lost.length > 2 ? ` ${a.andMore(lost.length - 2)}` : ""}</> : <> · {a.noneLost}</>}
                    </div>
                  </div>
                  <div className="ach-row-score">
                    <span className={`ach-pct ${level(x.pct)}`}>{x.pct}%</span>
                    <span className="muted small">{a.points(x.score, x.total)}</span>
                    {x.prev_pct != null && <Delta d={x.pct - x.prev_pct} />}
                  </div>
                  <span className="ach-chev"><Icon n="chev" s={18} /></span>
                </a>
              );
            })}
          </div>
        ) : <p className="muted small">{a.filterEmpty}</p>}
      </div>
    </>
  );
}

// Линия «% верных» по тестам: одна серия, тонкая линия, точки с подсказкой, скрытая таблица для скринридеров.
function TrendChart({ tests }) {
  const { t, L } = useApp();
  const a = t.ach;
  const fmt = useDate();
  const [hover, setHover] = useState(null);
  const W = 640, H = 220, P = { l: 36, r: 16, t: 16, b: 28 };
  const n = tests.length;
  const x = (i) => (n === 1 ? (W + P.l - P.r) / 2 : P.l + (i * (W - P.l - P.r)) / (n - 1));
  const y = (p) => P.t + ((100 - p) * (H - P.t - P.b)) / 100;
  const pts = tests.map((tst, i) => [x(i), y(tst.pct)]);
  const path = pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
  const area = n > 1 ? `${path} L${pts[n - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z` : "";
  const h = hover != null ? tests[hover] : null;
  // подпись дня — под первым тестом этого дня; не больше 6 подписей
  const firsts = tests.map((x, i) => i).filter((i) => !i || tests[i].date.slice(0, 10) !== tests[i - 1].date.slice(0, 10));
  const step = Math.max(1, Math.ceil(firsts.length / 6));
  const labeled = new Set(firsts.filter((_, k) => k % step === 0 || k === firsts.length - 1));
  return (
    <div className="ach-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={a.trend} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="achFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".14" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={P.l} x2={W - P.r} y1={y(g)} y2={y(g)} className="ach-grid" />
            <text x={P.l - 8} y={y(g) + 4} textAnchor="end" className="ach-axis">{g}%</text>
          </g>
        ))}
        {area && <path d={area} fill="url(#achFill)" />}
        {n > 1 && <path d={path} className="ach-line" />}
        {h && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={P.t} y2={y(0)} className="ach-cross" />}
        {pts.map(([px, py], i) => (
          <g key={tests[i].id}>
            <circle cx={px} cy={py} r={hover === i ? 6 : 4.5} className="ach-dot" />
            <circle cx={px} cy={py} r={16} fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              tabIndex={0} aria-label={`${fmt(tests[i].date)}: ${tests[i].pct}%`}
              onClick={() => { window.location.hash = `#/results/${tests[i].id}`; }} />
            {labeled.has(i) && (
              <text x={px} y={H - 8} textAnchor="middle" className="ach-axis">{fmt(tests[i].date, { day: "numeric", month: "short" })}</text>
            )}
          </g>
        ))}
        {n > 0 && hover == null && (
          <text x={pts[n - 1][0]} y={pts[n - 1][1] - 12} textAnchor={n > 1 ? "end" : "middle"} className="ach-last">{tests[n - 1].pct}%</text>
        )}
      </svg>
      {h && (
        <div className="ach-tip" style={{ left: `${(100 * pts[hover][0]) / W}%`, top: `${(100 * pts[hover][1]) / H}%` }}>
          <b>{h.pct}%</b> · {a.points(h.score, h.total)}
          <div className="muted">{a.kinds[h.kind]}{h.title ? ` · ${L(h.title)}` : ""}</div>
          <div className="muted">{fmt(h.date)}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>{a.trend}</caption>
        <tbody>{tests.map((tst) => <tr key={tst.id}><td>{fmt(tst.date)}</td><td>{a.kinds[tst.kind]}</td><td>{tst.pct}%</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function TestDetail({ id }) {
  const { t, L } = useApp();
  const a = t.ach;
  const fmt = useDate();
  const [x, setX] = useState(null);
  useEffect(() => { api(`/results/me/${id}`).then(setX).catch(() => setX(false)); }, [id]);
  if (x === null) return <Loading />;
  if (x === false) return <p className="muted">{t.error}</p>;

  const lost = x.total - x.score;
  const name = `${a.kinds[x.kind]}${x.title ? ` · ${L(x.title)}` : ""}`;
  const lostSkills = x.skills.filter((s) => s.lost);
  return (
    <>
      <Crumb items={[[t.nav.results, "#/results"], [a.kinds[x.kind]]]} />
      <div className="card ach-hero">
        <Ring p={x.pct} size={112} />
        <div className="ach-hero-main">
          {x.title && <span className={`ach-kind k-${x.kind}`}>{a.kinds[x.kind]}</span>}
          <h1>{x.title ? L(x.title) : a.kinds[x.kind]}</h1>
          <p className="muted">{fmt(x.date)}</p>
          <div className="ach-hero-facts">
            <span><b>{a.points(x.score, x.total)}</b></span>
            <span className={lost ? "ach-lost" : "ach-fixed"}>{lost ? a.lostPts(lost) : a.noneLost}</span>
            {x.prev_pct != null && <Delta d={x.pct - x.prev_pct} />}
          </div>
        </div>
      </div>

      <div className="grid g-main" style={{ marginTop: 20 }}>
        <div className="stack">
          <div className="card">
            <div className="card-head"><p className="card-title">{a.review}</p>
              {x.mistakes.length > 0 && <span className="muted small">{a.mistakesN(x.mistakes.length)}</span>}</div>
            {x.kind === "pqs" ? (
              <>
                <p className="ach-note"><Icon n="info" s={18} /><span>{a.pqsNote}</span></p>
                {lostSkills.map((s) => (
                  <div className="ach-mistake" key={s.lesson}>
                    <div className="ach-m-top"><span className="ach-topic-chip">{L(s.title)}</span><b className="ach-lost">−{s.lost}</b></div>
                    <p className="small" style={{ margin: "6px 0 10px" }}>{a.pqsLine(s.correct, s.total)}</p>
                    <TutorBtn lesson={s.lesson} />
                  </div>
                ))}
                {!lostSkills.length && <p className="muted">{a.noMistakes}</p>}
              </>
            ) : x.mistakes.length ? x.mistakes.map((m, k) => (
              <div className="ach-mistake" key={m.task_id}>
                <div className="ach-m-top">
                  <span className="ach-m-n">{k + 1}</span>
                  <span className="ach-topic-chip">{L(m.lesson_title)}</span>
                  {m.error && <span className="ach-err">{a.errKinds[m.error]}</span>}
                </div>
                <p className="ach-q">{L(m.question)}</p>
                <div className="ach-answers">
                  <div className="ach-ans bad"><span>{a.your}</span><b>{m.choice != null ? L(m.options[m.choice]) : a.noAnswer}</b></div>
                  <div className="ach-ans good"><span>{a.right}</span><b>{L(m.options[m.answer])}</b></div>
                </div>
                {m.explanation && L(m.explanation) && <p className="ach-ex">{L(m.explanation)}</p>}
                <TutorBtn lesson={m.lesson} task={m.task_id} />
              </div>
            )) : <p className="muted">{a.noMistakes}</p>}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <p className="card-title" style={{ marginBottom: 14 }}>{a.bySkills}</p>
            {x.skills.map((s) => (
              <div className="ach-topic" key={s.lesson}>
                <div className="ach-topic-top">
                  <span className="t-strong small">{L(s.title)}</span>
                  <span className="small">{s.correct}/{s.total}</span>
                </div>
                <Bar p={(100 * s.correct) / s.total} />
                {s.lost > 0 && <div className="ach-topic-foot"><span className="ach-lost small">−{s.lost}</span><TutorBtn lesson={s.lesson} short ghost /></div>}
              </div>
            ))}
          </div>
          {x.attempt && <a href={`#/result/${x.attempt}`} className="btn ghost block">{a.fullResult}</a>}
          <a href="#/results" className="btn ghost block"><Icon n="left" s={16} /> {a.back}</a>
        </div>
      </div>
    </>
  );
}
