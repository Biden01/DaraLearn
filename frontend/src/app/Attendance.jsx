import { Icon, useApp } from "./ui.jsx";

// Посещаемость: день засчитан, если ученик выполнил хотя бы один шаг плана дня.
// Статусы дня с бэкенда: present | absent | off (выходной) | today (ещё не занимался) | none (до регистрации).

const dow = (iso) => (new Date(iso + "T00:00:00").getDay() + 6) % 7; // 0 = пн

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

// Календарь по неделям (пн–вс) — личный кабинет и карточка ученика.
export function AttCalendar({ days }) {
  const { t } = useApp();
  const pad = days.length ? dow(days[0].day) : 0;
  return (
    <div className="att-cal">
      {t.att.week.map((w) => <span key={w} className="att-dow">{w}</span>)}
      {Array.from({ length: pad }, (_, i) => <span key={"p" + i} />)}
      {days.map((d) => <Cell key={d.day} d={d} big />)}
    </div>
  );
}

export function AttLegend({ a }) {
  const { t } = useApp();
  const ks = a?.days.some((d) => d.status === "frozen") ? ["present", "frozen", "absent", "off"] : ["present", "absent", "off"];
  return (
    <div className="att-legend muted small">
      {ks.map((k) => <span key={k}><i className={`att-cell ${k}`} />{t.att.status[k]}</span>)}
    </div>
  );
}

export function AttStats({ a }) {
  const { t } = useApp();
  const at = t.att;
  return (
    <div className="att-stats">
      <div><b>{a.rate == null ? "—" : `${Math.round(a.rate * 100)}%`}</b><span className="muted small">{at.days(a.present, a.school_days)}</span></div>
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
