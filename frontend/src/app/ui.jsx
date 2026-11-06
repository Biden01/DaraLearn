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
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  spark: <><path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" /><path d="M19 15c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  chev: <path d="m9 6 6 6-6 6" />,
  docchk: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 15l2 2 4-4" /></>,
  checkc: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
};

// Dara — персонаж AI Tutor: крутой снежный барс в синей тюбетейке с жёлтым орнаментом.
// Объёмный стиль (градиенты + блики); id градиентов уникальны на каждый экземпляр.
export function Dara({ s = 24, title }) {
  const u = useId().replace(/:/g, "");
  const id = (k) => `${k}${u}`, url = (k) => `url(#${k}${u})`;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title}
      aria-hidden={title ? undefined : "true"} className="dara">
      <defs>
        <radialGradient id={id("fur")} cx="40%" cy="38%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#E9EEF5" /><stop offset="1" stopColor="#B9C4D3" />
        </radialGradient>
        <radialGradient id={id("muz")} cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#DDE4EE" />
        </radialGradient>
        <linearGradient id={id("hat")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B82FF" /><stop offset="1" stopColor="#0047C7" />
        </linearGradient>
        <radialGradient id={id("iris")} cx="40%" cy="35%" r="65%">
          <stop offset="0" stopColor="#9FE7FF" /><stop offset="1" stopColor="#0058F4" />
        </radialGradient>
        <clipPath id={id("el")}><path d="M13.6 28.4Q17.5 27 21.4 28.4Q21 32.4 17.5 32.4Q14 32.4 13.6 28.4Z" /></clipPath>
        <clipPath id={id("er")}><path d="M26.6 28.4Q30.5 27 34.4 28.4Q34 32.4 30.5 32.4Q27 32.4 26.6 28.4Z" /></clipPath>
      </defs>
      {/* уши */}
      <circle cx="11" cy="19" r="5.4" fill={url("fur")} stroke="#9AA6B8" strokeWidth=".8" />
      <circle cx="37" cy="19" r="5.4" fill={url("fur")} stroke="#9AA6B8" strokeWidth=".8" />
      <circle cx="11.3" cy="19.6" r="2.7" fill="#8A97AA" />
      <circle cx="36.7" cy="19.6" r="2.7" fill="#8A97AA" />
      {/* голова */}
      <path d="M24 44.5C13.8 44.5 6.5 38 6.5 29.8 6.5 21.2 14.2 15.5 24 15.5s17.5 5.7 17.5 14.3c0 8.2-7.3 14.7-17.5 14.7Z" fill={url("fur")} stroke="#9AA6B8" strokeWidth=".8" />
      {/* пятна-розетки */}
      <g fill="none" stroke="#5B6678" strokeWidth="1.3" strokeLinecap="round" opacity=".75">
        <path d="M20.5 21.6a1.8 1.8 0 0 1 3 0M25.6 22.8a1.6 1.6 0 0 1 2.7.4" />
        <path d="M9.4 29.6a2 2 0 0 1 1.6-2.4M38.8 30.4a2 2 0 0 0-1.4-2.6M10.6 34.6a1.6 1.6 0 0 1 .4-2" />
      </g>
      <g fill="#5B6678" opacity=".7">
        <circle cx="24" cy="18.6" r=".9" /><circle cx="17.4" cy="23.4" r=".8" /><circle cx="31" cy="23.6" r=".8" />
        <circle cx="37.6" cy="34.6" r=".8" />
      </g>
      {/* объёмный блик на голове */}
      <ellipse cx="15.5" cy="24" rx="5" ry="2.6" fill="#fff" opacity=".7" transform="rotate(-25 15.5 24)" />
      {/* глаза: уверенный прищур */}
      {[["el", 17.5], ["er", 30.5]].map(([k, x]) => (
        <g key={k}>
          <path d={k === "el" ? "M13.6 28.4Q17.5 27 21.4 28.4Q21 32.4 17.5 32.4Q14 32.4 13.6 28.4Z" : "M26.6 28.4Q30.5 27 34.4 28.4Q34 32.4 30.5 32.4Q27 32.4 26.6 28.4Z"} fill="#fff" />
          <g clipPath={url(k)}>
            <circle cx={x + .6} cy="30.2" r="2.6" fill={url("iris")} />
            <circle cx={x + .6} cy="30.2" r="1.1" fill="#0B1530" />
            <circle cx={x - .2} cy="29.2" r=".7" fill="#fff" />
          </g>
          <path d={`M${x - 4.2} 28.4Q${x} 26.8 ${x + 4.2} 28.4`} fill="none" stroke="#1E2433" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ))}
      {/* брови: одна приподнята */}
      <path d="M14.2 25.4q3-1.2 6 -.2M27.6 24.4q3.2-2 6.4-.6" fill="none" stroke="#5B6678" strokeWidth="1.4" strokeLinecap="round" />
      {/* мордочка */}
      <ellipse cx="21.2" cy="36.4" rx="4" ry="3.1" fill={url("muz")} />
      <ellipse cx="26.8" cy="36.4" rx="4" ry="3.1" fill={url("muz")} />
      <path d="M21.6 33.2h4.8c.6 0 .9.7.5 1.1l-2.2 2.1a1 1 0 0 1-1.4 0l-2.2-2.1c-.4-.4-.1-1.1.5-1.1Z" fill="#E48A9C" />
      <ellipse cx="23.4" cy="33.8" rx="1" ry=".45" fill="#fff" opacity=".7" />
      {/* ухмылка */}
      <path d="M21.4 38.6q2.6 1.2 4.6.2t2.4-1.6" fill="none" stroke="#1E2433" strokeWidth="1.4" strokeLinecap="round" />
      {/* тюбетейка, лихо набок */}
      <g transform="rotate(-10 24 13)">
        <path d="M12.6 10.2 13.6 17q10.4 3.4 20.8 0l1-6.8Z" fill={url("hat")} />
        <ellipse cx="24" cy="10.2" rx="11.6" ry="3.4" fill="#2F74F6" />
        <path d="M14.6 14.6l2.2-2.4 2.2 2.4 2.2-2.4 2.2 2.4 2.2-2.4 2.2 2.4 2.2-2.4 2.2 2.4 2.2-2.4" fill="none" stroke="#FFD43B" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="24" cy="10" r="1.6" fill="#FFD43B" />
        <ellipse cx="18.5" cy="9.4" rx="4" ry="1.1" fill="#fff" opacity=".45" />
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
      {items.map(([label, href]) => <span key={label}> / {href ? <a href={href}>{label}</a> : label}</span>)}
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
