import { useState } from "react";

// Ответ → исход и состояние узлов карты знаний.
const OUTCOME = ["lost", "ok", "swap", "swap"];
const NODE_STATES = {
  idle: { sqrt: "ok", factor: "ok", inc: "target", disc: "locked" },
  ok: { sqrt: "ok", factor: "ok", inc: "ok", disc: "target" },
  lost: { sqrt: "gap", factor: "ok", inc: "target", disc: "locked" },
  swap: { sqrt: "gap", factor: "ok", inc: "target", disc: "locked" },
};
const EDGES = [
  ["sqrt", "M25 24 L47 42"],
  ["factor", "M75 24 L53 42"],
  ["inc", "M50 58 L50 76"],
];

export default function HeroDemo({ t }) {
  const [pick, setPick] = useState(null);
  const outcome = pick === null ? "idle" : OUTCOME[pick];
  const states = NODE_STATES[outcome];
  const msg = outcome === "idle" ? null : t[outcome];

  return (
    <div className="demo" aria-live="polite">
      <p className="demo-label">{t.label}</p>
      <p className="demo-q">{t.q}</p>
      <div className="demo-opts" role="group" aria-label={t.q}>
        {t.opts.map((o, i) => (
          <button key={o} type="button" onClick={() => setPick(i)} disabled={pick !== null}
            className={pick === i ? (i === 1 ? "right" : "wrong") : pick !== null && i === 1 ? "right-ghost" : ""}>
            {o}
          </button>
        ))}
      </div>

      <div className={`graph graph-${outcome}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {EDGES.map(([from, d]) => (
            <path key={from} d={d} className={states[from] === "gap" ? "edge gap" : "edge"} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {["sqrt", "factor", "inc", "disc"].map((k) => (
          <div key={k} className={`node n-${k} s-${states[k]}`}>
            <span className="node-t">{t.nodes[k]}</span>
            <span className="node-s">{t.states[states[k]]}</span>
          </div>
        ))}
      </div>

      <div className="demo-msg">
        {msg ? (
          <>
            <p className="demo-msg-t">{msg.t}</p>
            <p>{msg.d}</p>
            <button type="button" className="link-btn" onClick={() => setPick(null)}>{t.again}</button>
          </>
        ) : (
          <p className="muted">{t.idle}</p>
        )}
      </div>
    </div>
  );
}
