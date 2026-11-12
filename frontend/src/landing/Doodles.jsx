// Рисованные акценты в стиле «синий + лайм»: стрелки и крутящийся круглый бейдж.

export function ArrowLoop({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10,90 C 10,40 40,20 60,50 C 70,65 80,75 95,70" />
      <path d="M80,55 L95,70 L85,85" />
    </svg>
  );
}

export function ArrowCurl({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M90,10 C 80,60 60,80 40,60 C 20,40 40,20 60,30 C 80,40 70,70 50,80" />
      <path d="M65,75 L50,80 L55,65" />
    </svg>
  );
}

export function ArrowFlick({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20,80 Q 40,20 80,40" />
      <path d="M60,20 L80,40 L50,60" />
    </svg>
  );
}

// Круглый лаймовый бейдж-ссылка с бегущей по кругу надписью.
export function SpinBadge({ href, text, className = "" }) {
  const ring = `${text} • ${text} • `.toUpperCase();
  return (
    <a href={href} className={`spin-badge ${className}`} aria-label={text}>
      <svg viewBox="0 0 100 100" className="spin-ring" aria-hidden="true">
        <defs><path id="spin-path" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" /></defs>
        <text><textPath href="#spin-path" textLength="226" lengthAdjust="spacingAndGlyphs">{ring}</textPath></text>
      </svg>
      <svg viewBox="0 0 100 100" className="spin-arrow" fill="none" stroke="currentColor" strokeWidth="8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20,80 Q 40,50 30,30 T 80,20" />
        <path d="M60,10 L80,20 L70,40" />
      </svg>
    </a>
  );
}
