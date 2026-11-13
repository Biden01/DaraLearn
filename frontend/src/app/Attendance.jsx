import { useState } from "react";
import { Icon, useApp } from "./ui.jsx";
import { monthName } from "./pages/Plan.jsx";

// Посещаемость: день засчитан, если ученик выполнил хотя бы один шаг плана дня.
// Статусы дня с бэкенда: present | absent | off (выходной) | today (ещё не занимался) | none (до регистрации).


function Cell({ d, big }) {
  const { t } = useApp();
  const label = `${d.day.slice(8)}.${d.day.slice(5, 7)} · ${t.att.status[d.status]}`;
  return (
    <span className={`att-cell ${d.status}${big ? " big" : ""}`} title={label} aria-label={label}>
      {big ? Number(d.day.slice(8)) : null}
    </span>
  );
}

// Полоска из последних дней — главная ученика и таблица класса.
export function AttStrip({ days, n = 14 }) {
  return <div className="att-strip">{days.slice(-n).map((d) => <Cell key={d.day} d={d} />)}</div>;
}

// Календарь месяца (пн–вс) — личный кабинет и карточка ученика. Таблица с линиями; день — кружок с числом,
// дни серии подряд соединены полосой, заморозка — снежинка. Листается по месяцам, где есть данные.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const RUN = new Set(["present", "frozen"]);

// день в серии: занимался/заморожен, или выходной между такими днями
function runDays(days) {
  const inRun = new Set();
  days.forEach((d, i) => {
    if (RUN.has(d.status)) { inRun.add(d.day); return; }
    if (d.status !== "off") return;
    let l = i - 1, r = i + 1;
    while (l >= 0 && days[l].status === "off") l--;
    while (r < days.length && days[r].status === "off") r++;
    if (l >= 0 && r < days.length && RUN.has(days[l].status) && RUN.has(days[r].status)) inRun.add(d.day);
  });
  return inRun;
}

export function AttCalendar({ days }) {
  const { t, lang } = useApp();
  const at = t.att;
  const months = [...new Set(days.map((d) => d.day.slice(0, 7)))];
  const [mi, setMi] = useState(months.length - 1);
  const ym = months[Math.min(mi, months.length - 1)] || iso(new Date()).slice(0, 7);
  const byDay = Object.fromEntries(days.map((d) => [d.day, d]));
  const run = runDays(days);

  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const total = new Date(y, m, 0).getDate();
  const pad = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((pad + total) / 7) * 7 }, (_, i) => {
    const n = i - pad + 1;
    return n >= 1 && n <= total ? iso(new Date(y, m - 1, n)) : null;
  });
  const title = `${monthName(`${ym}-01`, lang)} ${y}`;

  return (
    <div className="att-month">
      <div className="att-mhead">
        <span className="att-mtitle">{title.charAt(0).toUpperCase() + title.slice(1)}</span>
        <div className="att-mnav">
          <button type="button" className="att-nbtn" aria-label={at.prevMonth} disabled={mi <= 0} onClick={() => setMi(mi - 1)}><Icon n="chevl" s={18} /></button>
          <button type="button" className="att-nbtn" aria-label={at.nextMonth} disabled={mi >= months.length - 1} onClick={() => setMi(mi + 1)}><Icon n="chev" s={18} /></button>
        </div>
      </div>
      <div className="att-cal" role="table" aria-label={title}>
        {at.week.map((w) => <span key={w} className="att-dow" role="columnheader">{w}</span>)}
        {cells.map((day, i) => {
          if (!day) return <span key={"p" + i} className="att-td blank" />;
          const d = byDay[day];
          const st = d ? d.status : "none";
          const col = i % 7;
          const prev = col > 0 && cells[i - 1], next = col < 6 && cells[i + 1];
          const inRun = run.has(day);
          const band = inRun && ((prev && run.has(prev)) || (next && run.has(next)));
          const cls = band ? ` band${prev && run.has(prev) ? "" : " b-start"}${next && run.has(next) ? "" : " b-end"}` : "";
          const label = `${day.slice(8)}.${day.slice(5, 7)} · ${at.status[st] || ""}`;
          return (
            <span key={day} className={`att-td${cls}`} title={d ? label : undefined}>
              <span className={`att-day ${st}`} aria-label={d ? label : undefined}>
                {st === "frozen" ? <Icon n="snow" s={16} /> : Number(day.slice(8))}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AttLegend({ a }) {
  const { t } = useApp();
  const at = t.att;
  const frozen = a?.days.some((d) => d.status === "frozen");
  return (
    <div className="att-legend muted small">
      <span><i className="att-dot present" />{at.status.present}</span>
      <span><i className="att-dot absent" />{at.status.absent}</span>
      {frozen && <span><i className="att-dot frozen"><Icon n="snow" s={10} /></i>{at.status.frozen}</span>}
      <span><i className="att-dot today" />{at.status.today}</span>
      <span><i className="att-band" />{at.run}</span>
    </div>
  );
}

export function AttStats({ a }) {
  const { t } = useApp();
  const at = t.att;
  return (
    <div className="att-stats">
      <div><b className="att-rate">{a.rate == null ? "—" : `${Math.round(a.rate * 100)}%`}</b><span className="muted small">{at.days(a.present, a.school_days)}</span></div>
      <div><b><Icon n="fire" s={18} />{a.streak}</b><span className="muted small">{at.streak}</span></div>
      {a.freezes > 0 && (
        <div><b className="att-freezes"><Icon n="snow" s={18} />{a.freezes}</b><span className="muted small" title={at.freezeHelp}>{at.freezes}</span></div>
      )}
    </div>
  );
}

export function AttToday({ a, self }) {
  const { t } = useApp();
  const at = t.att;
  if (a.today) return <p className="att-today yes"><Icon n="check" s={16} />{self ? at.todayYes : at.staffYes}</p>;
  const off = a.days.at(-1)?.status === "off";
  return (
    <p className={`att-today ${off ? "" : "no"}`}><Icon n="clock" s={16} />
      {off ? at.todayOff : self ? at.todayNo : at.staffNo(a.last_present)}</p>
  );
}

// Полная карточка: личный кабинет ученика и карточка ученика у учителя.
export default function AttendanceCard({ a, self = false }) {
  const { t } = useApp();
  if (!a) return null;
  return (
    <div className="card">
      <p className="card-title" style={{ marginBottom: 4 }}>{t.att.title}</p>
      <p className="muted small" style={{ margin: "0 0 12px" }}>{t.att.sub}</p>
      <AttToday a={a} self={self} />
      <AttStats a={a} />
      <AttCalendar days={a.days} />
      <AttLegend a={a} />
    </div>
  );
}
