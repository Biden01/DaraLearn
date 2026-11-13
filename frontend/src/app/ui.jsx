import { createContext, useContext, useId } from "react";

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Текст из пары {kk, ru} или строка как есть.
export const pick = (v, lang) => (v == null ? "" : typeof v === "string" ? v : v[lang] ?? v.kk ?? "");

const P = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  book: <path d="M2 5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />,
  case: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  doc: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  bot: <><rect x="4" y="8" width="16" height="12" rx="4" /><path d="M12 4v4M9 13v1M15 13v1M10 17h4M2 13v2M22 13v2" /></>,
  clip: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4" /></>,
  chart: <path d="M4 20V12M10 20V8M16 20V4M22 20H2" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  left: <path d="M19 12H5M11 6l-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  fire: <path d="M12 22c4 0 7-3 7-7 0-5-5-8-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  bulb: <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  board: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h6M15 14h6" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />,
  snow: <><path d="M12 3v18M4.8 7.5l14.4 9M19.2 7.5 4.8 16.5" />
    <path d="M9 4.5 12 6l3-1.5M9 19.5l3-1.5 3 1.5M5.6 9l.4 3-2.6 1M18.4 9l-.4 3 2.6 1M5.6 15l-2.6-1 .4-3M18.4 15l2.6-1-.4-3" /></>,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  spark: <><path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" /><path d="M19 15c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  chev: <path d="m9 6 6 6-6 6" />,
  chevl: <path d="m15 6-6 6 6 6" />,
  // деталь пазла (форма — Lucide «puzzle», ISC): пробел = недостающая деталь; покачивается при наведении (.piece в app.css)
  gaps: <g className="piece"><path d="M19.44 7.85c-.05.32.06.65.29.88l1.57 1.57c.47.47.7 1.09.7 1.7s-.23 1.24-.7 1.71l-1.61 1.61a.98.98 0 0 1-.84.27c-.47-.07-.8-.48-.97-.92a2.5 2.5 0 1 0-3.21 3.21c.44.17.85.5.92.97a.98.98 0 0 1-.27.84l-1.61 1.61a2.4 2.4 0 0 1-1.7.7 2.4 2.4 0 0 1-1.71-.7l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.47-.18.9-.53.97-1.02a1.03 1.03 0 0 0-.29-.88L2.7 13.7A2.4 2.4 0 0 1 2 12c0-.62.24-1.23.7-1.7l1.53-1.53c.24-.24.58-.35.92-.3.51.08.88.53 1.07 1.01a2.5 2.5 0 1 0 3.26-3.26c-.48-.19-.93-.56-1.01-1.07-.05-.34.06-.68.3-.92L10.3 2.7A2.4 2.4 0 0 1 12 2c.62 0 1.23.24 1.7.7l1.57 1.57c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.9.53-.97 1.02z" /></g>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></>,
  docchk: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 15l2 2 4-4" /></>,
  checkc: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
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
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
  );
}

export const Box = ({ sym, c = "", size = 44, icon }) => (
  <div className={`icon-box ${c}`} style={{ width: size, height: size }}>{icon ? <Icon n={icon} s={size * 0.5} /> : sym}</div>
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
