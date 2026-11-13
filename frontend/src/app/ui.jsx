import { createContext, useContext, useId } from "react";

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Текст из пары {kk, ru} или строка как есть.
export const pick = (v, lang) => (v == null ? "" : typeof v === "string" ? v : v[lang] ?? v.kk ?? "");

// Иконки 24×24 в стиле Lucide (ISC): одна толщина линии, скруглённые концы. Класс «d» — мягкая заливка
// основной формы в цвет иконки (duotone); её плотность задаёт --ico-fill (в активном пункте меню ярче).
const P = {
  home: <><path className="d" d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /></>,
  book: <><path className="d" d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /><path d="M12 7v14" /></>,
  case: <><path className="d" d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z" /><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></>,
  doc: <><path className="d" d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8" /></>,
  plan: <><path className="d" d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle className="d" cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  bot: <><path d="M12 8V4H8" /><rect className="d" x="4" y="8" width="16" height="12" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" /></>,
  clip: <><path className="d" d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" /></>,
  chart: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><rect className="d" x="7" y="13" width="3" height="5" rx="1" /><rect className="d" x="12" y="6" width="3" height="12" rx="1" /><rect className="d" x="17" y="9" width="3" height="9" rx="1" /></>,
  trend: <><path d="M22 7 13.5 15.5l-5-5L2 17" /><path d="M16 7h6v6" /></>,
  cal: <><path d="M8 2v4M16 2v4" /><rect className="d" x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /></>,
  gear: <><path className="d" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  help: <><circle className="d" cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></>,
  arrow: <path d="M5 12h14M12 5l7 7-7 7" />,
  left: <path d="M19 12H5M12 19l-7-7 7-7" />,
  clock: <><circle className="d" cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  send: <><path className="d" d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.63l-19 6.5a.5.5 0 0 0-.02.93l7.93 3.18a2 2 0 0 1 1.11 1.11z" /><path d="m21.85 2.15-10.94 10.94" /></>,
  star: <path className="d" d="M11.53 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .29-.91l5.17-.75a2.12 2.12 0 0 0 1.6-1.16z" />,
  fire: <path className="d" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  plus: <path d="M5 12h14M12 5v14" />,
  lock: <><rect className="d" x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  bulb: <><path className="d" d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5z" /><path d="M9 18h6M10 22h4" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  bell: <><path className="d" d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" /><path d="M10.27 21a2 2 0 0 0 3.46 0" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  user: <><circle className="d" cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" /></>,
  board: <><rect className="d" x="3" y="3" width="18" height="18" rx="2" /><path d="M8 7v7M12 7v4M16 7v9" /></>,
  trash: <><path d="M3 6h18M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><path className="d" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M10 11v6M14 11v6" /></>,
  snow: <path d="M2 12h20M12 2v20m8-6-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  spark: <><path className="d" d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" /><path d="M20 3v4M22 5h-4M4 17v2M5 18H3" /></>,
  info: <><circle className="d" cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
  chev: <path d="m9 18 6-6-6-6" />,
  chevl: <path d="m15 18-6-6 6-6" />,
  // деталь пазла: пробел = недостающая деталь; покачивается при наведении (.piece в app.css)
  gaps: <g className="piece"><path className="d" d="M19.44 7.85c-.05.32.06.65.29.88l1.57 1.57c.47.47.7 1.09.7 1.7s-.23 1.24-.7 1.71l-1.61 1.61a.98.98 0 0 1-.84.27c-.47-.07-.8-.48-.97-.92a2.5 2.5 0 1 0-3.21 3.21c.44.17.85.5.92.97a.98.98 0 0 1-.27.84l-1.61 1.61a2.4 2.4 0 0 1-1.7.7 2.4 2.4 0 0 1-1.71-.7l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.47-.18.9-.53.97-1.02a1.03 1.03 0 0 0-.29-.88L2.7 13.7A2.4 2.4 0 0 1 2 12c0-.62.24-1.23.7-1.7l1.53-1.53c.24-.24.58-.35.92-.3.51.08.88.53 1.07 1.01a2.5 2.5 0 1 0 3.26-3.26c-.48-.19-.93-.56-1.01-1.07-.05-.34.06-.68.3-.92L10.3 2.7A2.4 2.4 0 0 1 12 2c.62 0 1.23.24 1.7.7l1.57 1.57c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.9.53-.97 1.02z" /></g>,
  eye: <><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49M14.08 14.16a3 3 0 0 1-4.24-4.24M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14M2 2l20 20" />,
  // предметы и курсы (символ с бэкенда → иконка, см. SYM ниже)
  s_math: <><circle className="d" cx="7" cy="7" r="4" /><path className="d" d="M17 3l4 7h-8z" /><rect className="d" x="3" y="14" width="7" height="7" rx="1.5" /><path d="M17.5 14v7M14 17.5h7" /></>,
  s_alg: <><path className="d" d="M9.5 8.5h5v7h-5z" stroke="none" /><path d="M8 21s-4-3-4-9 4-9 4-9M16 3s4 3 4 9-4 9-4 9M15 9l-6 6M9 9l6 6" /></>,
  s_lin: <><path d="M3 3v18h18" /><path d="m7 17 11-10" /><circle className="d" cx="12.5" cy="12" r="2.2" /></>,
  s_quad: <><path d="M3 3v18h18" /><path className="d" d="M6 5c1.5 8 3.5 11 6.5 11S17.5 13 19 5" /><circle cx="12.5" cy="16" r="1.3" fill="currentColor" /></>,
  s_phys: <><circle cx="12" cy="12" r="1.2" fill="currentColor" /><path className="d" d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z" /><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z" /></>,
  s_chem: <><path className="d" d="M6.45 15h11.1l2.2 4.04A2 2 0 0 1 18 22H6a2 2 0 0 1-1.76-2.96z" stroke="none" /><path d="M14 2v6a2 2 0 0 0 .25.96l5.5 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.76-2.96l5.51-10.08A2 2 0 0 0 10 8V2M6.45 15h11.1M8.5 2h7" /></>,
  s_eng: <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1m14 20-5-10-5 10m2-4h6" />,
  s_kaz: <><path className="d" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M12 13.5V11c-1-1.6-2.6-2.4-3.8-1.7-1 .6-.9 2 .1 2.3.7.2 1.2-.3 1-.9M12 11c1-1.6 2.6-2.4 3.8-1.7 1 .6.9 2-.1 2.3-.7.2-1.2-.3-1-.9" /></>,
  s_bio: <><path className="d" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  s_hist: <><path className="d" d="M19 17V5a2 2 0 0 0-2-2H4a2 2 0 0 1 2 2v14a2 2 0 1 0 4 0v-1a1 1 0 0 1 1-1z" stroke="none" /><path d="M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3M10 8h5M10 12h5" /></>,
  s_it: <><rect className="d" x="2" y="4" width="20" height="16" rx="2.5" stroke="none" /><path d="m15.5 9 3 3-3 3M8.5 9l-3 3 3 3M13 7.5l-2 9" /></>,
  // диагностика: сканирование с лупой
  docchk: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><circle className="d" cx="11.5" cy="11.5" r="3.5" /><path d="m17 17-3-3" /></>,
  // проверка знаний: значок с галочкой
  checkc: <><path className="d" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z" /><path d="m9 12 2 2 4-4" /></>,
};

// Dara — персонаж AI Tutor: крутой рыжий лисёнок в синей тюбетейке с жёлтым орнаментом.
// Объёмный стиль (градиенты + блики); id градиентов уникальны на каждый экземпляр.
const EYE_L = "M13.4 27.8Q17.3 26.4 21.2 27.8Q20.8 31.8 17.3 31.8Q13.8 31.8 13.4 27.8Z";
const EYE_R = "M26.8 27.8Q30.7 26.4 34.6 27.8Q34.2 31.8 30.7 31.8Q27.2 31.8 26.8 27.8Z";
// «AI Tutor» в тексте → лисёнок Dara перед названием. Строка без «AI Tutor» возвращается как есть,
// поэтому fox() безопасно оборачивать вокруг любого текста. Только для видимого текста — не для title/alt/option.
export function fox(s) {
  if (typeof s !== "string" || !s.includes("AI Tutor")) return s;
  // одним <span>: внутри flex-контейнера (summary, кнопки) куски строки иначе разъезжаются как отдельные элементы
  return <span>{s.split(/(AI Tutor)/).map((p, i) => (p === "AI Tutor"
    ? <span key={i} className="ai-tutor"><Dara s="1.2em" />AI Tutor</span> : p))}</span>;
}

export function Dara({ s = 24, title }) {
  const u = useId().replace(/:/g, "");
  const id = (k) => `${k}${u}`, url = (k) => `url(#${k}${u})`;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title}
      aria-hidden={title ? undefined : "true"} className="dara">
      <defs>
        <radialGradient id={id("fur")} cx="40%" cy="40%" r="70%">
          <stop offset="0" stopColor="#FFB561" /><stop offset=".55" stopColor="#F97316" /><stop offset="1" stopColor="#C2410C" />
        </radialGradient>
        <radialGradient id={id("muz")} cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#FBE3CF" />
        </radialGradient>
        <linearGradient id={id("hat")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B82FF" /><stop offset="1" stopColor="#0047C7" />
        </linearGradient>
        <radialGradient id={id("iris")} cx="40%" cy="35%" r="65%">
          <stop offset="0" stopColor="#9FE7FF" /><stop offset="1" stopColor="#0058F4" />
        </radialGradient>
        <clipPath id={id("el")}><path d={EYE_L} /></clipPath>
        <clipPath id={id("er")}><path d={EYE_R} /></clipPath>
      </defs>
      {/* голова с острыми ушами */}
      <path d="M24 44C13.4 44 5.5 36.6 5.5 26.4V6.5l11.2 7.6c2.3-1 4.7-1.4 7.3-1.4s5 .4 7.3 1.4l11.2-7.6v19.9C42.5 36.6 34.6 44 24 44Z"
        fill={url("fur")} stroke="#9A3412" strokeWidth=".8" strokeLinejoin="round" />
      {/* внутренняя часть ушей и тёмные кончики */}
      <path d="M8.6 11.8l6.4 4.3-5.6 4.8zM39.4 11.8l-6.4 4.3 5.6 4.8z" fill="#7C2D12" />
      <path d="M5.5 6.5l4.4 3v-.1L5.5 13zM42.5 6.5l-4.4 3L42.5 13z" fill="#431407" />
      {/* светлые щёки-пушок */}
      <path d="M24 44c-7.4 0-13.4-4.6-15.4-11.2 5-1.8 10.6 0 15.4 4.2 4.8-4.2 10.4-6 15.4-4.2C37.4 39.4 31.4 44 24 44Z" fill={url("muz")} />
      {/* объёмный блик */}
      <ellipse cx="14.5" cy="21.5" rx="4.6" ry="2.2" fill="#fff" opacity=".4" transform="rotate(-30 14.5 21.5)" />
      {/* глаза: уверенный прищур */}
      {[["el", 17.3, EYE_L], ["er", 30.7, EYE_R]].map(([k, x, d]) => (
        <g key={k}>
          <path d={d} fill="#fff" />
          <g clipPath={url(k)}>
            <circle cx={x + .6} cy="29.6" r="2.6" fill={url("iris")} />
            <circle cx={x + .6} cy="29.6" r="1.1" fill="#0B1530" />
            <circle cx={x - .2} cy="28.6" r=".7" fill="#fff" />
          </g>
          <path d={`M${x - 4.2} 27.8Q${x} 26.2 ${x + 4.2} 27.8`} fill="none" stroke="#1E1B2E" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ))}
      {/* брови: одна приподнята */}
      <path d="M14 24.8q3-1.2 6-.2M27.8 23.8q3.2-2 6.4-.6" fill="none" stroke="#7C2D12" strokeWidth="1.4" strokeLinecap="round" />
      {/* нос с бликом */}
      <ellipse cx="24" cy="34.4" rx="2.7" ry="2" fill="#1E1B2E" />
      <ellipse cx="23.2" cy="33.8" rx=".9" ry=".45" fill="#fff" opacity=".7" />
      {/* ухмылка */}
      <path d="M21.4 38.4q2.6 1.2 4.6.2t2.4-1.6" fill="none" stroke="#1E1B2E" strokeWidth="1.4" strokeLinecap="round" />
      {/* тюбетейка, лихо набок, между ушами */}
      <g transform="rotate(-10 24 12)">
        <path d="M15.4 9.6 16.2 15.6q7.8 2.8 15.6 0l.8-6Z" fill={url("hat")} />
        <ellipse cx="24" cy="9.6" rx="8.6" ry="2.7" fill="#2F74F6" />
        <path d="M17.2 13.8l1.8-2 1.8 2 1.8-2 1.8 2 1.8-2 1.8 2 1.8-2 1.8 2" fill="none" stroke="#FFD43B" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="24" cy="9.4" r="1.4" fill="#FFD43B" />
        <ellipse cx="20" cy="8.9" rx="3" ry=".9" fill="#fff" opacity=".45" />
      </g>
    </svg>
  );
}

export function Icon({ n, s = 20 }) {
  if (n === "dara") return <Dara s={s} />;
  return (
    <svg className="i" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
  );
}

// Символы предметов/курсов с бэкенда (content/data.py) → иконки; незнакомый символ показывается текстом.
const SYM = { "√x": "s_math", ab: "s_alg", "ƒ(x)": "s_lin", "x²": "s_quad", "⚛": "s_phys", "⚗": "s_chem", Aa: "s_eng",
  "Әә": "s_kaz", "❦": "s_bio", "⌛": "s_hist", "</>": "s_it" };
export const SymIcon = ({ sym, s = 16 }) => (SYM[sym] ? <Icon n={SYM[sym]} s={s} /> : sym);
export const Box = ({ sym, c = "", size = 44, icon }) => {
  const n = icon || SYM[sym];
  return <div className={`icon-box ${c}`} style={{ width: size, height: size }}>{n ? <Icon n={n} s={Math.round(size * 0.52)} /> : sym}</div>;
};
export const Bar = ({ p }) => <div className="bar"><span style={{ width: `${Math.max(0, Math.min(100, p))}%` }} /></div>;
export const Ring = ({ p, size = 92 }) => (
  <div className="ring" style={{ "--p": p, "--size": `${size}px` }} role="img" aria-label={`${p}%`}><b>{p}%</b></div>
);
export const Crumb = ({ items }) => {
  const { t } = useApp();
  return (
    <div className="crumb">
      <a href="#/">{t.nav.home}</a>
      {items.map(([label, href]) => <span key={label}> / {href ? <a href={href}>{fox(label)}</a> : fox(label)}</span>)}
    </div>
  );
};
export const Loading = () => <div className="stack"><div className="skeleton" /><div className="skeleton" style={{ height: 220 }} /></div>;

// Простая разметка ответов тьютора: абзацы и **жирный**.
export function Rich({ text }) {
  return (
    <div className="md">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                part.startsWith("**") && part.endsWith("**") ? <b key={k}>{part.slice(2, -2)}</b> : part)}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export function useToast() {
  return useApp().toast;
}
