import { createContext, useContext, useId } from "react";

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Текст из пары {kk, ru} или строка как есть.
export const pick = (v, lang) => (v == null ? "" : typeof v === "string" ? v : v[lang] ?? v.kk ?? "");

// Қарапайым бөлшектерді («1/6», «π/3», «7·√3/6», «(x+2)/(x+1)») кітаптағыдай
// үстінде-астында (numerator/denominator), ал «a_n», «S_n», «a_(n+1)» түрдегі
// индекстерді нағыз subscript етіп көрсетеді. Үлкен/күрделі өрнектегі «/»
// (мыс. жай мәтінде кездейсоқ) түртпейді — тек сан/бір әріп/√.../жақшалы жай
// топтарды таниды, сол арқылы қате тани алмайтын жерге тимейді.
const MATH_TOKEN = "(?:\\([^()]*\\)|√\\([^()]*\\)|√\\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?[a-zA-Zα-ωΑ-Ω]|π|[a-zA-Zα-ωΑ-Ω]|\\d+(?:\\.\\d+)?)";
const MATH_CHAIN = `${MATH_TOKEN}(?:·${MATH_TOKEN})*`;
const FRACTION_RE = new RegExp(`(-)?(${MATH_CHAIN})/(${MATH_CHAIN})`, "gu");
const SUB_RE = /([a-zA-Zα-ωΑ-Ω])_(\([^()]*\)|[a-zA-Z0-9]+)/gu;
const declamp = (s) => (/^\([^()]*\)$/.test(s) ? s.slice(1, -1) : s);

// regex-ті тек жол (string) бөліктеріне қолданады, бұрын шыққан элементтерді өзгертпейді.
function splitBy(parts, regex, render) {
  const out = [];
  for (const part of parts) {
    if (typeof part !== "string") { out.push(part); continue; }
    let last = 0;
    for (const m of part.matchAll(regex)) {
      if (m.index > last) out.push(part.slice(last, m.index));
      out.push(render(m));
      last = m.index + m[0].length;
    }
    if (last < part.length) out.push(part.slice(last));
  }
  return out;
}

export const MathText = ({ children }) => {
  const text = children == null ? "" : String(children);
  let parts = splitBy([text], SUB_RE, (m) => (
    <span key={`s${m.index}`}>{m[1]}<sub>{declamp(m[2])}</sub></span>
  ));
  parts = splitBy(parts, FRACTION_RE, (m) => (
    <span className="frac" key={`f${m.index}`}>
      {m[1] && "−"}
      <span className="frac-stack"><span className="num">{declamp(m[2])}</span><span className="den">{declamp(m[3])}</span></span>
    </span>
  ));
  return parts;
};

// Иконки 24×24 — собственный набор DaraLearn (пресет Soft: линия 2px, скругления 3–4px, поля 2.5px);
// исходники и превью — design/icons/. Класс «d» — мягкая заливка основной формы в цвет иконки (duotone);
// её плотность задаёт --ico-fill (в активном пункте меню ярче). Лисёнок AI Tutor — отдельно, компонент Dara ниже.
const P = {
  menu: <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checks: <path d="M2.5 12.5 7 17l9.5-9.5M12 15.5l1.5 1.5L21.5 9" />,
  chev: <path d="M9.5 6l6 6-6 6" />,
  chevl: <path d="M14.5 6l-6 6 6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  left: <path d="M19 12H5M11 6l-6 6 6 6" />,
  search: <><circle className="d" cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5l5 5" /></>,
  download: <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M3.5 15.5v2a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-2" />,
  eye: <><path className="d" d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <path d="M10 5.7a9 9 0 0 1 2-.2c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.2 3M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 5.4-1.6M14.1 14.1a3 3 0 0 1-4.2-4.2M3.5 3.5l17 17" />,
  info: <><circle className="d" cx="12" cy="12" r="9.5" /><path d="M12 11v5.5M12 7.5h.01" /></>,
  help: <><circle className="d" cx="12" cy="12" r="9.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.3M12 17h.01" /></>,
  clock: <><circle className="d" cx="12" cy="12" r="9.5" /><path d="M12 7v5l3.5 2" /></>,
  trash: <><path d="M4 6.5h16M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5" /><path className="d" d="M6 6.5l.8 12a2.5 2.5 0 0 0 2.5 2h5.4a2.5 2.5 0 0 0 2.5-2l.8-12" /><path d="M10 11v5M14 11v5" /></>,
  send: <><path className="d" d="M20.5 3.5 3.5 10l7 3 3 7.5z" /><path d="M20.5 3.5l-10 9.5" /></>,
  lock: <><rect className="d" x="4.5" y="10.5" width="15" height="10" rx="3" /><path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5v2" /></>,
  bell: <><path className="d" d="M6 10a6 6 0 0 1 12 0c0 4.5 1.5 6 2.5 7h-17c1-1 2.5-2.5 2.5-7z" /><path d="M10 20.5a2.3 2.3 0 0 0 4 0" /></>,
  home: <><path className="d" d="M3.5 10.2a2 2 0 0 1 .7-1.5l6.5-5.4a2 2 0 0 1 2.6 0l6.5 5.4a2 2 0 0 1 .7 1.5V18a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 18z" /><path d="M9.5 20.5v-5a2.5 2.5 0 0 1 5 0v5" /></>,
  plan: <><path className="d" d="M8.5 4.5H7A2.5 2.5 0 0 0 4.5 7v11A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 17 4.5h-1.5" /><rect x="8.5" y="2.5" width="7" height="4" rx="1.5" /><path d="M9 13.5l2 2 4-4" /></>,
  clip: <><path className="d" d="M8.5 4.5H7A2.5 2.5 0 0 0 4.5 7v11A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 17 4.5h-1.5" /><rect x="8.5" y="2.5" width="7" height="4" rx="1.5" /><path d="M9 11.5h6M9 15.5h4" /></>,
  cal: <><rect className="d" x="3.5" y="5" width="17" height="15.5" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  sched: <><path className="d" d="M20.5 10.5V8.5A3.5 3.5 0 0 0 17 5H7a3.5 3.5 0 0 0-3.5 3.5V17A3.5 3.5 0 0 0 7 20.5h3.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /><circle cx="17" cy="17" r="4.5" /><path d="M17 15v2l1.5 1" /></>,
  book: <><path className="d" d="M2.5 5.5c2.5-1 6-1 9.5 1.5 3.5-2.5 7-2.5 9.5-1.5v13c-2.5-1-6-1-9.5 1.5-3.5-2.5-7-2.5-9.5-1.5z" /><path d="M12 7v12.5" /></>,
  case: <><path className="d" d="M12 4 2.5 9 12 14l9.5-5z" /><path d="M6.5 11.2v4.3c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-4.3M21.5 9v5" /></>,
  docchk: <><path d="M3.5 8V6A2.5 2.5 0 0 1 6 3.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2" /><circle className="d" cx="11.5" cy="11.5" r="3.5" /><path d="M14 14l2.5 2.5" /></>,
  checkc: <><path className="d" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z" /><path d="m9 12 2 2 4-4" /></>,
  gaps: <g className="piece"><path className="d" d="M6.5 6H9a2 2 0 0 1 4 0h2.5A2.5 2.5 0 0 1 18 8.5V11a2 2 0 0 1 0 4v2.5a2.5 2.5 0 0 1-2.5 2.5H13a2 2 0 0 0-4 0H6.5A2.5 2.5 0 0 1 4 17.5V15a2 2 0 0 0 0-4V8.5A2.5 2.5 0 0 1 6.5 6z" /></g>,
  trend: <path d="M3 16.5l5.5-5.5 4 4L20.5 7M15 7h5.5v5.5" />,
  trophy: <><path className="d" d="M7 3.5h10v6a5 5 0 0 1-10 0z" /><path d="M7 5.5H5a2 2 0 0 0 0 4h2M17 5.5h2a2 2 0 0 1 0 4h-2M12 14.5v3M8 20.5h8M9.5 17.5h5" /></>,
  user: <><circle className="d" cx="12" cy="12" r="9.5" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1.2-1.9 3.2-3 5.5-3s4.3 1.1 5.5 3" /></>,
  gear: <><path className="d" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  target: <><circle cx="12" cy="12" r="9.5" /><circle className="d" cx="12" cy="12" r="5.5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  chart: <><path d="M3.5 3.5v14a3 3 0 0 0 3 3h14" /><rect className="d" x="8" y="12" width="3" height="5" rx="1.5" /><rect className="d" x="12.5" y="6.5" width="3" height="10.5" rx="1.5" /><rect className="d" x="17" y="9.5" width="3" height="7.5" rx="1.5" /></>,
  doc: <><path className="d" d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9z" /><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5M8.5 13h7M8.5 16.5h5" /></>,
  board: <><rect className="d" x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8 8v6M12 8v3.5M16 8v8" /></>,
  bulb: <><path className="d" d="M9 16c0-1.5-.7-2.5-1.7-3.5a5.5 5.5 0 1 1 9.4 0C15.7 13.5 15 14.5 15 16z" /><path d="M9.5 19h5M10.5 21.5h3" /></>,
  bot: <><rect className="d" x="4.5" y="8" width="15" height="11.5" rx="3.5" /><path d="M12 8V4.5M9.5 13v1.5M14.5 13v1.5M2.5 13v2.5M21.5 13v2.5" /></>,
  star: <path className="d" d="M12 3l2.6 5.6 6 .7-4.4 4.2 1.2 6L12 16.5l-5.4 3 1.2-6-4.4-4.2 6-.7z" />,
  fire: <><path className="d" d="M12 21.5a7 7 0 0 0 7-7c0-3.5-2.5-6-4-7.5-.5 2-1.5 3-3 3.5.5-3-1-6-3.5-7.5C8.5 6 5 9 5 14.5a7 7 0 0 0 7 7z" /><path d="M12 21.5a3 3 0 0 1-3-3c0-2 1.5-3 3-4.5 1.5 1.5 3 2.5 3 4.5a3 3 0 0 1-3 3z" /></>,
  snow: <path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 4 12 6l2.5-2M9.5 20l2.5-2 2.5 2" />,
  spark: <><path className="d" d="M11 3.5c.6 4.3 2.4 6.1 6.5 6.75-4.1.65-5.9 2.45-6.5 6.75-.6-4.3-2.4-6.1-6.5-6.75C8.6 9.6 10.4 7.8 11 3.5z" /><path d="M18.5 15v5M16 17.5h5" /></>,
  s_math: <><rect className="d" x="2.5" y="2.5" width="19" height="19" rx="5" stroke="none" /><path d="M7.5 4.5v6M4.5 7.5h6M13.5 7.5h6M5 14l5 5M10 14l-5 5M13.5 15h6M13.5 18h6" /></>,
  s_alg: <><path d="M12 4.5v16M8.5 20.5h7M5 7.5h14M5 7.5 2.5 14M5 7.5 7.5 14M19 7.5 16.5 14M19 7.5l2.5 6.5" /><circle cx="12" cy="4.5" r="1.5" fill="currentColor" /><path className="d" d="M2.5 14a2.5 2.5 0 0 0 5 0zM16.5 14a2.5 2.5 0 0 0 5 0z" /></>,
  s_lin: <><rect className="d" x="2.5" y="2.5" width="19" height="19" rx="5" stroke="none" /><path d="M4.5 19.5 19.5 4.5" /><circle cx="9" cy="15" r="2" fill="currentColor" /><circle cx="15" cy="9" r="2" fill="currentColor" /></>,
  s_quad: <><rect className="d" x="2.5" y="2.5" width="19" height="19" rx="5" stroke="none" /><path d="M5 4.5c1.8 8 4 12.5 7 12.5s5.2-4.5 7-12.5" /><circle cx="12" cy="17" r="2" fill="currentColor" /></>,
  s_phys: <><circle cx="12" cy="12" r="1.2" fill="currentColor" /><path className="d" d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z" /><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z" /></>,
  s_chem: <><path className="d" d="M9.5 3.5v5.2L4.6 17.5a2 2 0 0 0 1.75 3h11.3a2 2 0 0 0 1.75-3L14.5 8.7V3.5" /><path d="M8.5 3.5h7M7 15h10" /></>,
  s_eng: <path d="m5 8 6 6M4 14l6-6 2-3M2.5 5h11M7 2.5h1m13.5 19-5-10-5 10m2-4h6" />,
  s_kaz: <><path className="d" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M12 13.5V11c-1-1.6-2.6-2.4-3.8-1.7-1 .6-.9 2 .1 2.3.7.2 1.2-.3 1-.9M12 11c1-1.6 2.6-2.4 3.8-1.7 1 .6.9 2-.1 2.3-.7.2-1.2-.3-1-.9" /></>,
  s_bio: <><path className="d" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2.5 21c0-3 1.85-5.36 5.08-6C10 14.52 12 13 13 12" /></>,
  s_hist: <><path className="d" d="M19 17V5a2 2 0 0 0-2-2H4a2 2 0 0 1 2 2v14a2 2 0 1 0 4 0v-1a1 1 0 0 1 1-1z" stroke="none" /><path d="M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3M10 8h5M10 12h5" /></>,
  s_it: <><rect className="d" x="2.5" y="4.5" width="19" height="15" rx="3.5" /><path d="M15 9.5l2.5 2.5-2.5 2.5M9 9.5 6.5 12 9 14.5M13 8l-2 8" /></>,
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
    <svg className="i" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
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
// Пән/кітап карточкасы: сурет орнына үлкейтілген белгі, атауы, «Өту» батырмасы.
// Жаңа пән data.py-де sym/color-мен тіркелсе, осы карточка қосымша өзгеріссіз жұмыс істейді.
export const BookCard = ({ sym, c = "", title, href, cta }) => (
  <a href={href} className="book-card">
    <div className={`book-media ${c}`}><SymIcon sym={sym} s={44} /></div>
    <div className="book-body">
      <h3 className="book-title">{title}</h3>
      <span className="btn block">{cta} <Icon n="arrow" s={16} /></span>
    </div>
  </a>
);
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
