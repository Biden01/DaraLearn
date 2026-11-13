import * as React from "react";
import "./flipbook-scroll-gallery.css";
import { fox } from "../../app/ui.jsx";

// Фотокнига с перелистыванием (21st.dev, FlipbookScrollGallery), перенесена под проект:
// JSX вместо TSX, обычный CSS (flipbook-scroll-gallery.css) вместо Tailwind, React 18
// (ref через forwardRef, атрибут fetchpriority в нижнем регистре).
// Отличие от оригинала: проп `cover` — текст карточки на форзаце (по умолчанию eyebrow),
// чтобы заголовок секции можно было рисовать снаружи в стиле лендинга.
//
// items: [{ id, image, title?, caption?, date?, backImage? }]
// scrollDriven: прокрутка страницы листает книгу (секция растёт до items.length × 70vh).
//   При false книга в одном экране, колесо над ней листает страницы.
// progress / page: управляемый режим. autoplay: листает сам, пока читатель не вмешается.

const STIFFNESS = 120;
const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.72;
const BOUNCE = 0.22;
const SLICES = 3;
const CURL = 0.024;
const MAX_CURL = 16;
const HOVER_LIFT = 0.075;
const RIFFLE = 3;
const RIFFLE_GAP = 70;
const FIRST_STEP = 1000;
const PERSPECTIVE = 1600;
const SINGLE_PERSPECTIVE = 2600;
const TILT = 8;
const SINGLE_BELOW = 480;
const WHEEL_STEP = 100;
const WHEEL_TICK = 120;
const WHEEL_QUEUE = 3;
const WHEEL_LINE = 40;
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.6 0 0 0 -0.4'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")";
const MARBLE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='680' viewBox='0 0 480 680' preserveAspectRatio='none'%3E%3Cfilter id='m' filterUnits='userSpaceOnUse' x='-400' y='-400' width='1280' height='1480'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.0035 0.016' numOctaves='4' seed='9'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0 0 0 0.35 1 0.35 0 0 0 0 0 0.5 0 0 0 0 0 0 0 0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect x='-400' y='-400' width='1280' height='1480' transform='rotate(-28 240 340)' filter='url(%23m)'/%3E%3C/svg%3E\")";
const DEFAULT_LABELS = { previous: "Previous page", next: "Next page", pageOf: "Page {page} of {total}" };

function depthFor(mode, width) {
  return mode === "spread" ? Math.max(PERSPECTIVE, Math.round(width * 6.5)) : Math.max(SINGLE_PERSPECTIVE, Math.round(width * 8.5));
}
const shadeFront = (deg) => 0.36 * (1 - Math.cos((deg * Math.PI) / 180));
const shadeBack = (deg) => 0.36 * (1 + Math.cos((deg * Math.PI) / 180));
const sheenFront = (deg) => (deg > -90 ? 0.16 * Math.max(0, Math.sin((-2 * deg * Math.PI) / 180)) : 0);
const sheenBack = (deg) => (deg < -90 ? 0.16 * Math.max(0, Math.sin((2 * deg * Math.PI) / 180)) : 0);
const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

function handSpeed(trail) {
  const last = trail[trail.length - 1];
  const from = trail.find((sample) => last !== undefined && last.t - sample.t <= 120);
  if (!last || !from || last.t - from.t < 8) return 0;
  return (last.x - from.x) / (last.t - from.t);
}

const two = (value) => String(value).padStart(2, "0");

function markLoaded(node) {
  if (node && node.complete && node.naturalWidth > 0) node.dataset.loaded = "true";
}

function Grain() {
  return <span aria-hidden="true" className="fb-grain" style={{ backgroundImage: GRAIN }} />;
}

function Photo({ src, className = "", priority = false }) {
  return (
    <span className={`fb-photo ${className}`}>
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        fetchpriority={priority ? "high" : undefined}
        ref={markLoaded}
        onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
        className="fb-img"
      />
      <span aria-hidden="true" className="fb-photo-ring" />
    </span>
  );
}

function Curl({ corner }) {
  const toward = corner === "right" ? "to top left" : "to top right";
  return (
    <span
      aria-hidden="true"
      className={`fb-curl ${corner}`}
      style={{ background: `linear-gradient(${toward}, color-mix(in oklab, var(--fb-fg) 12%, var(--fb-card)) 0 50%, color-mix(in oklab, var(--fb-fg) 5%, var(--fb-card)) 50%, var(--fb-card) 100%)` }}
    />
  );
}

function Gutter({ edge }) {
  return <span aria-hidden="true" className={`fb-gutter ${edge}`} />;
}

function FrontPage({ item, index, fontSize }) {
  return (
    <div className="fb-page fb-front" style={{ fontSize }}>
      <Grain />
      <Photo src={item.image} priority={index === 0} className="fb-front-photo" />
      <div className="fb-front-text">
        {item.title && <p className="fb-title">{fox(item.title)}</p>}
        {item.caption && <p className="fb-caption">{fox(item.caption)}</p>}
        <p className="fb-meta">
          <span>{item.date}</span>
          <span>{two(index + 1)}</span>
        </p>
      </div>
      <Gutter edge="left" />
      <span aria-hidden="true" className="fb-edge" />
      <Curl corner="right" />
    </div>
  );
}

function BackPage({ item, index, fontSize }) {
  return (
    <div className="fb-page" style={{ fontSize }}>
      <Grain />
      <span aria-hidden="true" className="fb-ruled" />
      {item.backImage ? (
        <span className="fb-polaroid">
          <Photo src={item.backImage} className="fb-polaroid-photo" />
          <span aria-hidden="true" className="fb-tape" />
        </span>
      ) : (
        <span className="fb-stamp">
          <span className="fb-stamp-n">{two(index + 1)}</span>
          {item.date && <span className="fb-stamp-date">{item.date}</span>}
        </span>
      )}
      <div className="fb-back-text">
        {item.title && <p className="fb-back-title">{fox(item.title)}</p>}
        {item.date && <p className="fb-back-date">{item.date}</p>}
      </div>
      <Gutter edge="right" />
      <Curl corner="left" />
    </div>
  );
}

function Endpaper({ title, fontSize }) {
  const [lead, ...more] = (title ?? "").split(" · ");
  return (
    <div className="fb-page fb-endpaper" style={{ fontSize }}>
      <span aria-hidden="true" className="fb-marble" style={{ backgroundImage: MARBLE }} />
      <Grain />
      {title && (
        <div className="fb-title-card">
          <span aria-hidden="true" className="fb-title-card-b1" />
          <span aria-hidden="true" className="fb-title-card-b2" />
          <p className="fb-title-card-lead">{lead}</p>
          {more.length > 0 && (
            <>
              <span aria-hidden="true" className="fb-title-card-rule" />
              <p className="fb-title-card-more">{more.join(" · ")}</p>
            </>
          )}
        </div>
      )}
      <Gutter edge="right" />
    </div>
  );
}

const RAMP = { spread: ["to right", "to left"], single: ["to bottom", "to top"] };

function Face({ side, k, spread, width, height, sliceW, sliceH, children }) {
  // Каждая грань заходит на 1px в соседние, чтобы шов между полосками всегда был закрыт бумагой.
  const pre = k > 0 ? 1 : 0;
  const post = k < SLICES - 1 ? 1 : 0;
  const along = spread ? sliceW : sliceH;
  const offset = side === "front" ? -k * along + pre : -((SLICES - 1 - k) * along - post);
  const v = side === "front" ? "f" : "b";
  const [fromStart, fromEnd] = RAMP[spread ? "spread" : "single"];
  const ramp = (dir, color, opacity) => (
    <span aria-hidden="true" className="fb-fill" style={{ background: `linear-gradient(${dir}, ${color}, transparent)`, opacity }} />
  );
  return (
    <div
      className="fb-face"
      style={{ left: spread ? -pre : 0, top: spread ? 0 : -pre, width: spread ? sliceW + pre + post : sliceW, height: spread ? sliceH : sliceH + pre + post, transform: side === "back" ? (spread ? "rotateY(180deg)" : "rotateX(180deg)") : undefined }}
    >
      <div style={{ position: "absolute", ...(spread ? { left: offset, top: 0 } : { left: 0, top: offset }), width, height }}>
        {children}
      </div>
      {ramp(fromStart, "#000", `var(--${v}s0, 0)`)}
      {ramp(fromEnd, "#000", `var(--${v}s1, 0)`)}
      {ramp(fromStart, "#fff", `calc(var(--${v}g0, 0) * var(--fb-sheen, 1))`)}
      {ramp(fromEnd, "#fff", `calc(var(--${v}g1, 0) * var(--fb-sheen, 1))`)}
    </div>
  );
}

export const FlipbookScrollGallery = React.forwardRef(function FlipbookScrollGallery(
  {
    items,
    eyebrow,
    heading,
    cover,
    scrollDriven = true,
    progress,
    page,
    defaultPage = 0,
    onPageChange,
    autoplay = false,
    interval = 1800,
    labels = DEFAULT_LABELS,
    className,
    style,
    ...rest
  },
  ref,
) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const count = items.length;
  const last = Math.max(0, count - 1);
  const controlled = progress !== undefined || page !== undefined;
  const driven = scrollDriven && !controlled;
  const coverTitle = cover ?? eyebrow;

  const rootRef = React.useRef(null);
  const areaRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const leavesRef = React.useRef(null);
  const leafRefs = React.useRef([]);
  const sliceRefs = React.useRef([]);
  const thickRefs = React.useRef([]);
  const castBoxRefs = React.useRef([]);
  const castRefs = React.useRef([]);
  const frame = React.useRef(null);
  const sim = React.useRef({ f: [], v: [], drag: -1, hover: "", raf: 0, last: 0, expectY: null, intended: null, shown: -1, painted: [] });
  const pointer = React.useRef({ id: -1, x: 0, y: 0, moved: false, side: "", grab: 0, lastT: 0, trail: [] });
  const suppressClick = React.useRef(false);
  const wheel = React.useRef({ acc: 0, at: -Infinity, timer: 0 });
  const stoppedRef = React.useRef(false);

  const [geo, setGeo] = React.useState({ mode: "spread", w: 0, h: 0 });
  const [internalPage, setInternalPage] = React.useState(() => clamp(Math.round(defaultPage), 0, last));
  const [shownPage, setShownPage] = React.useState(() => clamp(Math.round(page ?? progress ?? (scrollDriven ? 0 : defaultPage)), 0, last));
  const [reduced, setReduced] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);
  const [focusSide, setFocusSide] = React.useState("next");

  const live = React.useRef(null);
  live.current = { count, last, controlled, driven, progress, page, internalPage, reduced, geo, onPageChange };

  const setRoot = React.useCallback(
    (node) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const kick = React.useCallback(() => {
    const s = sim.current;
    if (!s.raf) s.raf = requestAnimationFrame((now) => frame.current?.(now));
  }, []);

  const stop = React.useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    setStopped(true);
  }, []);

  const readTarget = React.useCallback(() => {
    const l = live.current;
    if (l.progress !== undefined) return clamp(Number.isFinite(l.progress) ? l.progress : 0, 0, l.last);
    if (l.page !== undefined) return clamp(Number.isFinite(l.page) ? Math.round(l.page) : 0, 0, l.last);
    if (!l.driven) return clamp(l.internalPage, 0, l.last);
    const root = rootRef.current;
    if (!root) return 0;
    const box = root.getBoundingClientRect();
    const travel = box.height - window.innerHeight;
    if (travel <= 0) return 0;
    const p = clamp(-box.top / travel, 0, 1) * l.last;
    const whole = Math.round(p);
    return Math.abs(p - whole) < 0.004 ? whole : p;
  }, []);

  const currentPage = React.useCallback(() => {
    const l = live.current;
    const s = sim.current;
    if (l.controlled || s.intended === null) return clamp(Math.round(readTarget()), 0, l.last);
    return s.intended;
  }, [readTarget]);

  const go = React.useCallback(
    (target) => {
      const l = live.current;
      const s = sim.current;
      if (l.count === 0) return;
      const next = clamp(Math.round(target), 0, l.last);
      if (l.controlled) {
        if (next !== clamp(Math.round(readTarget()), 0, l.last)) l.onPageChange?.(next);
        return;
      }
      s.intended = next;
      if (l.driven) {
        const root = rootRef.current;
        if (!root) return;
        const box = root.getBoundingClientRect();
        const travel = box.height - window.innerHeight;
        if (travel <= 0) return;
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const y = Math.round(clamp(window.scrollY + box.top + (next / Math.max(1, l.last)) * travel, 0, max));
        s.expectY = y;
        window.scrollTo({ top: y, behavior: "instant" });
      } else {
        l.internalPage = next;
        setInternalPage(next);
      }
      kick();
    },
    [kick, readTarget],
  );

  // Пружина на каждый лист; лист не может обогнать соседей, поэтому быстрый прыжок веером пролистывает страницы.
  const simulate = React.useCallback((dt, target) => {
    const s = sim.current;
    const { count: n, reduced: still } = live.current;
    const whole = Math.abs(target - Math.round(target)) < 1e-6 ? Math.round(target) : -1;
    const hoverRight = s.hover === "right" && whole >= 0 && whole < n - 1 ? whole : -1;
    const hoverLeft = s.hover === "left" && whole > 0 ? whole - 1 : -1;
    const goal = (i) => {
      if (still) return target - i >= 0.5 ? 1 : 0;
      const base = clamp(target - i, 0, 1);
      if (i === hoverRight) return Math.max(base, HOVER_LIFT);
      if (i === hoverLeft) return Math.min(base, 1 - HOVER_LIFT);
      return base;
    };
    if (still) {
      for (let i = 0; i < n; i++) {
        if (i === s.drag) continue;
        s.f[i] = goal(i);
        s.v[i] = 0;
      }
      return false;
    }
    const between = (i) => clamp(goal(i), i === n - 1 ? 0 : (s.f[i + 1] ?? 0), i === 0 ? 1 : (s.f[i - 1] ?? 1));
    const steps = 2;
    const h = dt / steps;
    for (let k = 0; k < steps; k++) {
      for (let i = 0; i < n; i++) {
        if (i === s.drag) continue;
        const f = s.f[i] ?? 0;
        const v = s.v[i] ?? 0;
        const eff = between(i);
        let nv = v + (-STIFFNESS * (f - eff) - DAMPING * v) * h;
        let nf = f + nv * h;
        if (nf > 1) {
          nf = 1;
          if (nv > 0) nv = -nv * BOUNCE;
        } else if (nf < 0) {
          nf = 0;
          if (nv < 0) nv = -nv * BOUNCE;
        }
        s.f[i] = nf;
        s.v[i] = nv;
      }
      for (let i = 1; i < n; i++) {
        const above = s.f[i - 1] ?? 0;
        const here = s.f[i] ?? 0;
        if (here <= above) continue;
        if (i === s.drag) {
          s.f[i - 1] = here;
          s.v[i - 1] = Math.max(s.v[i - 1] ?? 0, s.v[i] ?? 0);
        } else {
          s.f[i] = above;
          s.v[i] = Math.min(s.v[i] ?? 0, s.v[i - 1] ?? 0);
        }
      }
      for (let i = n - 2; i >= 0; i--) {
        const below = s.f[i + 1] ?? 0;
        const here = s.f[i] ?? 0;
        if (here >= below) continue;
        if (i === s.drag) {
          s.f[i + 1] = here;
          s.v[i + 1] = Math.min(s.v[i + 1] ?? 0, s.v[i] ?? 0);
        } else {
          s.f[i] = below;
          s.v[i] = Math.max(s.v[i] ?? 0, s.v[i + 1] ?? 0);
        }
      }
    }
    let busy = s.drag >= 0;
    for (let i = 0; i < n && !busy; i++) {
      if (i === s.drag) continue;
      if (Math.abs((s.f[i] ?? 0) - between(i)) > 0.0006 || Math.abs(s.v[i] ?? 0) > 0.006) busy = true;
    }
    if (!busy) {
      for (let i = 0; i < n; i++) {
        s.f[i] = goal(i);
        s.v[i] = 0;
      }
    }
    return busy;
  }, []);

  const paint = React.useCallback(() => {
    const s = sim.current;
    const { count: n, geo: g } = live.current;
    if (!g.w || n === 0) return;
    const spread = g.mode === "spread";
    const span = spread ? g.w : g.h;
    let rightTop = n;
    let leftTop = -1;
    for (let i = 0; i < n; i++) {
      if ((s.f[i] ?? 0) < 0.002) {
        rightTop = i;
        break;
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      if ((s.f[i] ?? 0) > 0.998) {
        leftTop = i;
        break;
      }
    }
    let castRight = -1;
    let castLeft = -1;
    let turned = 0;
    const bent = [];
    const curls = [];
    for (let i = 0; i < n; i++) {
      const f = s.f[i] ?? 0;
      const air = f >= 0.002 && f <= 0.998;
      if (f >= 0.5) turned++;
      if (air && f < 0.5) castRight = i;
      if (air && f >= 0.5 && castLeft < 0) castLeft = i;
      const leaf = leafRefs.current[i];
      if (!leaf) continue;
      const angle = -180 * f;
      const visible = air || i === rightTop || i === leftTop;
      const omega = -180 * (s.v[i] ?? 0);
      // Сопротивление воздуха заставляет край отставать; рука на краю — вести.
      const curl = air ? clamp((i === s.drag ? 1 : -1) * omega * CURL, -MAX_CURL, MAX_CURL) : 0;
      curls[i] = curl;
      const key = `${g.mode}|${angle.toFixed(2)}|${curl.toFixed(2)}|${visible ? 1 : 0}`;
      if (s.painted[i] === key) continue;
      s.painted[i] = key;
      leaf.style.setProperty("--angle", `${angle.toFixed(2)}deg`);
      leaf.style.transform = spread ? `rotateY(${angle.toFixed(3)}deg)` : `rotateX(${(-angle).toFixed(3)}deg)`;
      leaf.style.zIndex = String(f < 0.5 ? 2 * (n - i) : 2 * (n + i));
      leaf.style.visibility = visible ? "" : "hidden";
      for (let k = 0; k < SLICES; k++) bent[k] = k === 0 ? angle : clamp((bent[k - 1] ?? angle) + curl, -180, 0);
      for (let k = 0; k < SLICES; k++) {
        const slice = sliceRefs.current[i * SLICES + k];
        if (!slice) continue;
        const own = bent[k] ?? angle;
        const before = bent[k - 1] ?? own;
        if (k > 0) slice.style.transform = spread ? `rotateY(${(own - before).toFixed(3)}deg)` : `rotateX(${(before - own).toFixed(3)}deg)`;
        const near = (own + before) / 2;
        const far = (own + (bent[k + 1] ?? own)) / 2;
        slice.style.setProperty("--fs0", shadeFront(near).toFixed(3));
        slice.style.setProperty("--fs1", shadeFront(far).toFixed(3));
        slice.style.setProperty("--fg0", sheenFront(near).toFixed(3));
        slice.style.setProperty("--fg1", sheenFront(far).toFixed(3));
        slice.style.setProperty("--bs0", shadeBack(far).toFixed(3));
        slice.style.setProperty("--bs1", shadeBack(near).toFixed(3));
        slice.style.setProperty("--bg0", sheenBack(far).toFixed(3));
        slice.style.setProperty("--bg1", sheenBack(near).toFixed(3));
      }
    }
    const thickness = (stack) => `scaleY(${(0.14 + 0.86 * (stack / Math.max(1, n))).toFixed(3)})`;
    const leftStack = thickRefs.current[0];
    const rightStack = thickRefs.current[1];
    if (leftStack) leftStack.style.transform = thickness(turned);
    if (rightStack) rightStack.style.transform = thickness(n - turned);
    const depth = depthFor(g.mode, g.w);
    const reach = (i) => {
      let a = -180 * (s.f[i] ?? 0);
      let x = 0;
      let z = 0;
      for (let k = 0; k < SLICES; k++) {
        if (k > 0) a = clamp(a + (curls[i] ?? 0), -180, 0);
        const r = (a * Math.PI) / 180;
        x += (span / SLICES) * Math.cos(r);
        z -= (span / SLICES) * Math.sin(r);
      }
      const scale = depth / Math.max(1, depth - z);
      return spread ? x * scale : span / 2 + (x - span / 2) * scale;
    };
    const castR = castRefs.current[1];
    const castRBox = castBoxRefs.current[1];
    if (castR && castRBox) {
      if (castRight >= 0) {
        const f = s.f[castRight] ?? 0;
        castR.style.opacity = (0.6 * Math.sin(f * Math.PI)).toFixed(3);
        castR.style.transform = spread ? `translateX(${reach(castRight).toFixed(1)}px)` : `translateY(${reach(castRight).toFixed(1)}px)`;
        castRBox.style.zIndex = String(2 * (n - rightTop) + 1);
      } else castR.style.opacity = "0";
    }
    const castL = castRefs.current[0];
    const castLBox = castBoxRefs.current[0];
    if (castL && castLBox) {
      if (spread && castLeft >= 0) {
        const f = s.f[castLeft] ?? 0;
        castL.style.opacity = (0.6 * Math.sin(f * Math.PI)).toFixed(3);
        castL.style.transform = `translateX(${reach(castLeft).toFixed(1)}px)`;
        castLBox.style.zIndex = String(2 * (n + leftTop) + 1);
      } else castL.style.opacity = "0";
    }
  }, []);

  frame.current = (now) => {
    const s = sim.current;
    s.raf = 0;
    const l = live.current;
    if (l.count === 0) return;
    const dt = s.last ? Math.min(0.067, (now - s.last) / 1000) : 1 / 60;
    s.last = now;
    const target = readTarget();
    const shown = clamp(Math.round(target), 0, l.last);
    if (shown !== s.shown) {
      s.shown = shown;
      rootRef.current?.setAttribute("data-page", String(shown));
      setShownPage(shown);
      if (!l.controlled) l.onPageChange?.(shown);
    }
    const busy = simulate(dt, target);
    paint();
    if (busy) kick();
    else s.last = 0;
  };

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => {
      const aw = area.clientWidth;
      const ah = area.clientHeight;
      if (!aw || !ah) return;
      const single = aw < SINGLE_BELOW;
      const across = single ? 1.08 : 2.08;
      const room = ah * 0.94;
      let w = Math.min((aw * (single ? 0.88 : 0.92)) / across, single ? 440 : 480);
      const margin = single ? 0.262 : 0.18;
      let h = Math.min(w / 0.62, room - margin * w);
      if (h < w / 0.74) {
        w = room / (1 / 0.74 + margin);
        h = w / 0.74;
      }
      const mode = single ? "single" : "spread";
      const whole = (value, min) => Math.max(min, Math.floor(value / SLICES) * SLICES);
      const next = { mode, w: whole(w, 60), h: whole(h, 81) };
      setGeo((old) => (old.mode === next.mode && old.w === next.w && old.h === next.h ? old : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // Перезапуск листов только когда меняются сами страницы, а не ссылка на массив.
  const pagesKey = items.map((item) => item.id).join("|");
  React.useLayoutEffect(() => {
    const s = sim.current;
    const { count: n, reduced: still } = live.current;
    const target = readTarget();
    s.f = [];
    s.v = [];
    for (let i = 0; i < n; i++) {
      s.f.push(still ? (target - i >= 0.5 ? 1 : 0) : clamp(target - i, 0, 1));
      s.v.push(0);
    }
    s.painted = [];
    s.drag = -1;
    s.shown = clamp(Math.round(target), 0, Math.max(0, n - 1));
    setShownPage(s.shown);
    paint();
  }, [pagesKey, readTarget, paint]);

  React.useLayoutEffect(() => {
    paint();
  });

  React.useEffect(() => {
    stoppedRef.current = false;
    setStopped(false);
  }, [autoplay]);

  React.useEffect(() => {
    if (!driven) {
      window.addEventListener("resize", kick);
      return () => window.removeEventListener("resize", kick);
    }
    const s = sim.current;
    const onScroll = () => {
      if (s.expectY !== null && Math.abs(window.scrollY - s.expectY) <= 2) s.expectY = null;
      else {
        s.expectY = null;
        s.intended = null;
        stop();
      }
      kick();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("resize", kick);
    kick();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("resize", kick);
    };
  }, [driven, kick, stop]);

  // Без привязки к прокрутке колесо над книгой листает страницы: ~100px на страницу, не чаще раза в 120 мс.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (driven || !stage) return;
    const w = wheel.current;
    const turn = (fresh) => {
      window.clearTimeout(w.timer);
      w.timer = 0;
      const l = live.current;
      if (Math.abs(w.acc) < WHEEL_STEP || sim.current.drag >= 0) return;
      const wait = w.at + WHEEL_TICK - performance.now();
      if (wait > 0) {
        w.timer = window.setTimeout(() => turn(false), wait);
        return;
      }
      const dir = w.acc > 0 ? 1 : -1;
      const from = currentPage();
      const to = clamp(from + dir, 0, l.last);
      if (to === from) {
        w.acc = 0;
        return;
      }
      go(to);
      w.at = performance.now();
      const used = fresh ? Math.min(Math.abs(w.acc), 2 * WHEEL_STEP) : WHEEL_STEP;
      w.acc = l.controlled ? 0 : dir * Math.min(Math.abs(w.acc) - used, WHEEL_QUEUE * WHEEL_STEP);
      if (Math.abs(w.acc) >= WHEEL_STEP) w.timer = window.setTimeout(() => turn(false), WHEEL_TICK);
    };
    const onWheel = (event) => {
      if (event.ctrlKey || event.metaKey || sim.current.drag >= 0) return;
      const unit = event.deltaMode === 1 ? WHEEL_LINE : event.deltaMode === 2 ? stage.clientHeight || window.innerHeight : 1;
      const dy = event.deltaY * unit;
      if (dy === 0 || Math.abs(event.deltaX * unit) > Math.abs(dy)) return;
      stop();
      const dir = dy > 0 ? 1 : -1;
      const from = currentPage();
      // На первой и последней странице колесо снова прокручивает документ.
      if ((dir > 0 && from >= live.current.last) || (dir < 0 && from <= 0)) {
        w.acc = 0;
        return;
      }
      if (event.cancelable) event.preventDefault();
      if (w.acc !== 0 && Math.sign(w.acc) !== dir) w.acc = 0;
      w.acc = dir * Math.min(Math.abs(w.acc + dy), (WHEEL_QUEUE + 2) * WHEEL_STEP);
      turn(true);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      window.clearTimeout(w.timer);
      w.timer = 0;
      w.acc = 0;
    };
  }, [driven, currentPage, go, stop]);

  React.useEffect(() => {
    kick();
  }, [progress, page, internalPage, reduced, geo, kick]);

  React.useEffect(
    () => () => {
      cancelAnimationFrame(sim.current.raf);
      sim.current.raf = 0;
    },
    [],
  );

  const ready = geo.w > 0;

  // «Вдох» при появлении: правая страница один раз приподнимает угол.
  React.useEffect(() => {
    if (!ready || reduced) return;
    const timer = window.setTimeout(() => {
      const s = sim.current;
      const p = clamp(Math.round(readTarget()), 0, live.current.last);
      if (p < live.current.last && s.drag < 0) {
        s.v[p] = (s.v[p] ?? 0) + 2.2;
        kick();
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ready, reduced, kick, readTarget]);

  React.useEffect(() => {
    if (!autoplay || reduced || controlled || stopped || count < 2 || !ready) return;
    let step = 0;
    let timer = 0;
    const riffle = [];
    const run = () => {
      if (!document.hidden) {
        const from = currentPage();
        if (from >= last) {
          go(0);
          step = 0;
        } else if (step % 4 === 3) {
          for (let k = 1; k <= RIFFLE; k++) riffle.push(window.setTimeout(() => go(Math.min(last, from + k)), (k - 1) * RIFFLE_GAP));
          step++;
        } else {
          go(from + 1);
          step++;
        }
      }
      timer = window.setTimeout(run, interval);
    };
    timer = window.setTimeout(run, FIRST_STEP);
    return () => {
      window.clearTimeout(timer);
      riffle.forEach((id) => window.clearTimeout(id));
    };
  }, [autoplay, reduced, controlled, stopped, count, ready, interval, last, go, currentPage]);

  const hitTest = (x, y) => {
    const box = leavesRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    if (x < box.left - 8 || x > box.right + 8 || y < box.top - 8 || y > box.bottom + 8) return null;
    if (live.current.geo.mode === "spread") {
      const half = box.width / 2;
      const u = (x - (box.left + half)) / half;
      return { side: u < 0 ? "left" : "right", u };
    }
    const u = (x - box.left) / box.width;
    return { side: u < 0.3 ? "left" : "right", u };
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    stop();
    const hit = hitTest(event.clientX, event.clientY);
    suppressClick.current = false;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, side: hit?.side ?? "", grab: hit?.u ?? 0, lastT: event.timeStamp, trail: [{ t: event.timeStamp, x: event.clientX }] };
  };

  const onPointerMove = (event) => {
    const p = pointer.current;
    const s = sim.current;
    const l = live.current;
    if (p.id === event.pointerId) {
      const now = event.timeStamp;
      const dx = event.clientX - p.x;
      if (!p.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(event.clientY - p.y)) {
        p.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (l.geo.mode === "spread" && !l.reduced && p.side) {
          let leaf = -1;
          if (p.side === "right") {
            for (let i = 0; i < l.count; i++) {
              if ((s.f[i] ?? 0) < 0.5) {
                leaf = i;
                break;
              }
            }
            if (leaf >= l.last) leaf = -1;
          } else {
            for (let i = l.count - 1; i >= 0; i--) {
              if ((s.f[i] ?? 0) >= 0.5) {
                leaf = i;
                break;
              }
            }
          }
          if (leaf >= 0) {
            s.drag = leaf;
            s.hover = "";
          }
        }
      }
      if (p.moved) {
        const elapsed = Math.max(1, now - p.lastT);
        p.trail.push({ t: now, x: event.clientX });
        while (p.trail.length > 2 && now - (p.trail[0]?.t ?? now) > 200) p.trail.shift();
        const box = leavesRef.current?.getBoundingClientRect();
        if (s.drag >= 0 && box && box.width > 0) {
          // Свободный край остаётся под пальцем: позиция края (−1…1 от корешка) → угол.
          const half = box.width / 2;
          const u = (event.clientX - (box.left + half)) / half;
          const edge = clamp(u - p.grab + (p.side === "right" ? 1 : -1), -1, 1);
          const f = Math.acos(edge) / Math.PI;
          const before = s.f[s.drag] ?? 0;
          s.v[s.drag] = (s.v[s.drag] ?? 0) * 0.5 + ((f - before) / (elapsed / 1000)) * 0.5;
          s.f[s.drag] = f;
          kick();
        }
        p.lastT = now;
      }
      return;
    }
    if (event.pointerType !== "mouse" || l.geo.mode !== "spread" || l.reduced) return;
    const hit = hitTest(event.clientX, event.clientY);
    const side = hit && Math.abs(hit.u) > 0.5 && Math.abs(hit.u) <= 1.02 ? hit.side : "";
    if (side !== s.hover) {
      s.hover = side;
      kick();
    }
  };

  const finishPointer = (event, cancelled) => {
    const p = pointer.current;
    if (p.id !== event.pointerId) return;
    const s = sim.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    p.id = -1;
    const dx = event.clientX - p.x;
    const paused = event.timeStamp - p.lastT > 140;
    const fling = paused ? 0 : handSpeed(p.trail);
    if (s.drag >= 0) {
      const leaf = s.drag;
      const f = s.f[leaf] ?? 0;
      if (paused) s.v[leaf] = 0;
      const v = s.v[leaf] ?? 0;
      s.drag = -1;
      suppressClick.current = true;
      if (!cancelled && p.side === "right" && (f > 0.25 || (f > 0.04 && (v > 1.2 || fling < -0.45)))) go(leaf + 1);
      else if (!cancelled && p.side === "left" && (f < 0.75 || (f < 0.96 && (v < -1.2 || fling > 0.45)))) go(leaf);
      kick();
      return;
    }
    if (p.moved) {
      suppressClick.current = true;
      if (!cancelled && (Math.abs(dx) > 40 || Math.abs(fling) > 0.45)) go(currentPage() + (dx < 0 ? 1 : -1));
    }
  };

  const onClick = (event) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const hit = hitTest(event.clientX, event.clientY);
    if (!hit) return;
    stop();
    go(currentPage() + (hit.side === "right" ? 1 : -1));
  };

  const onKeyDown = (event) => {
    const from = currentPage();
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "PageDown") next = from + 1;
    else if (event.key === "ArrowLeft" || event.key === "PageUp") next = from - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    stop();
    go(next);
  };

  const W = geo.w;
  const H = geo.h;
  const spread = geo.mode === "spread";
  const c = Math.max(4, Math.round(W * 0.04));
  const t = Math.max(4, Math.round(W * 0.032));
  const tail = Math.round(W * 0.1);
  const bind = spread ? 0 : Math.round(W * 0.05);
  const top = spread ? c : c + t + bind;
  const bump = Math.max(3, Math.round(c * 0.45));
  const pagesW = spread ? 2 * W : W;
  const bookW = pagesW + 2 * c;
  const coverH = H + top + c;
  const fontSize = clamp(W * 0.048, 8.5, 20);
  const sliceW = spread ? W / SLICES : W;
  const sliceH = spread ? H : H / SLICES;
  const cornerSize = Math.max(28, Math.round(W * 0.16));
  const depth = depthFor(geo.mode, W);
  const radius = Math.max(3, Math.round(c * 0.5));
  const prevDisabled = shownPage <= 0;
  const nextDisabled = shownPage >= last;
  const tabSide = focusSide === "next" ? (nextDisabled && !prevDisabled ? "previous" : "next") : prevDisabled && !nextDisabled ? "next" : "previous";
  const current = items[shownPage];
  const pageText = labels.pageOf.replace("{page}", String(shownPage + 1)).replace("{total}", String(count));
  const liveText = count > 0 ? [current?.title, current?.caption, pageText].filter(Boolean).map((part) => String(part).replace(/[.\s]+$/, "")).join(". ") : "";

  const leaves = React.useMemo(() => {
    if (!ready) return null;
    const slice = (item, i, k) => (
      <div
        ref={(node) => {
          sliceRefs.current[i * SLICES + k] = node;
        }}
        data-slice={k}
        className="fb-3d"
        style={k === 0 ? { left: 0, top: 0, width: sliceW, height: sliceH } : { left: spread ? "100%" : 0, top: spread ? 0 : "100%", width: "100%", height: "100%", transformOrigin: spread ? "0 50%" : "50% 0" }}
      >
        <Face side="front" k={k} spread={spread} width={W} height={H} sliceW={sliceW} sliceH={sliceH}>
          <FrontPage item={item} index={i} fontSize={fontSize} />
        </Face>
        <Face side="back" k={k} spread={spread} width={W} height={H} sliceW={sliceW} sliceH={sliceH}>
          <BackPage item={item} index={i} fontSize={fontSize} />
        </Face>
        {k < SLICES - 1 && slice(item, i, k + 1)}
      </div>
    );
    return items.map((item, i) => (
      <div
        key={item.id}
        ref={(node) => {
          if (leafRefs.current[i] !== node) sim.current.painted[i] = "";
          leafRefs.current[i] = node;
        }}
        data-leaf={i}
        aria-hidden="true"
        className="fb-3d"
        style={{ top: 0, left: spread ? W : 0, width: W, height: H, transformOrigin: spread ? "0 50%" : "50% 0", zIndex: 2 * (items.length - i) }}
      >
        {slice(item, i, 0)}
      </div>
    ));
  }, [items, ready, spread, W, H, sliceW, sliceH, fontSize]);

  return (
    <section
      {...rest}
      ref={setRoot}
      data-slot="flipbook-scroll-gallery"
      data-page={shownPage}
      data-mode={geo.mode}
      className={`fb ${className ?? ""}`.trim()}
      style={{ ...(driven ? { height: `max(200vh, ${count * 70}vh)` } : null), ...style }}
    >
      <div className={`fb-viewport ${driven ? "driven" : ""}`}>
        <div aria-hidden="true" className="fb-glow" />
        {(eyebrow || heading) && (
          <header className="fb-header">
            {eyebrow && <p className={spread && ready ? "fb-sr" : "fb-eyebrow"}>{eyebrow}</p>}
            {heading && <h2 className="fb-heading">{heading}</h2>}
          </header>
        )}
        <div ref={areaRef} className="fb-area">
          <div
            ref={stageRef}
            data-stage
            role="group"
            aria-roledescription="photo book"
            aria-label={heading ?? eyebrow ?? "Photo book"}
            aria-describedby={`${uid}-live`}
            className="fb-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => finishPointer(event, false)}
            onPointerCancel={(event) => finishPointer(event, true)}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse" && sim.current.hover) {
                sim.current.hover = "";
                kick();
              }
            }}
            onClick={onClick}
            onKeyDown={onKeyDown}
          >
            {ready && (
              <div data-book className="fb-book" style={{ width: bookW, height: coverH + tail, perspective: depth, perspectiveOrigin: "50% 30%" }}>
                <div data-tilt className="fb-abs" style={{ left: 0, top: 0, width: bookW, height: coverH, transform: `rotateX(${TILT}deg)`, transformOrigin: "50% 100%" }}>
                  <div aria-hidden="true" className="fb-shadow" />
                  <div aria-hidden="true" data-cover className="fb-cover" style={{ borderRadius: radius }}>
                    <span className="fb-cloth" />
                  </div>
                  {spread &&
                    [0, 1].map((end) => (
                      <span
                        key={end}
                        aria-hidden="true"
                        className="fb-bump"
                        style={{ width: c * 2.4, height: bump, top: end ? coverH : -bump, borderRadius: end ? "0 0 999px 999px" : "999px 999px 0 0" }}
                      />
                    ))}
                  {!spread && (
                    <span
                      aria-hidden="true"
                      data-binding
                      className="fb-abs"
                      style={{ left: 0, right: 0, top: 0, height: c + bind, borderRadius: `${radius}px ${radius}px 0 0`, backgroundImage: "linear-gradient(to bottom, color-mix(in oklab, white 22%, transparent), transparent 45%, color-mix(in oklab, black 30%, transparent))" }}
                    />
                  )}
                  {[0, 1].map((stack) => (
                    <div
                      key={stack}
                      ref={(node) => {
                        thickRefs.current[stack] = node;
                      }}
                      data-thickness={stack ? "right" : "left"}
                      aria-hidden="true"
                      className="fb-thickness"
                      style={{
                        left: spread ? c + stack * W : c,
                        top: spread || stack ? top + H : top - t,
                        width: W,
                        height: t,
                        transformOrigin: spread || stack ? "50% 0" : "50% 100%",
                      }}
                    />
                  ))}
                  <span
                    aria-hidden="true"
                    data-ribbon
                    className="fb-ribbon"
                    style={{ left: spread ? bookW / 2 + W * 0.05 : c + W * 0.16, top: top + H - c * 1.5, width: Math.max(4, Math.round(W * 0.034)), height: tail + c * 2.4 }}
                  />
                  <div
                    ref={leavesRef}
                    data-leaves
                    className="fb-abs"
                    style={{ left: c, top, width: pagesW, height: H, perspective: depth, perspectiveOrigin: "50% 50%", clipPath: spread ? undefined : "inset(0 -50% -50% -50%)" }}
                  >
                    {spread && (
                      <div data-endpaper aria-hidden="true" className="fb-abs" style={{ left: 0, top: 0, width: W, height: H, zIndex: 0 }}>
                        <Endpaper title={coverTitle} fontSize={fontSize} />
                      </div>
                    )}
                    {[0, 1].map((side) => (
                      <div
                        key={side}
                        ref={(node) => {
                          castBoxRefs.current[side] = node;
                        }}
                        aria-hidden="true"
                        className="fb-cast-box"
                        style={{ left: side && spread ? W : 0, width: W, height: H, zIndex: 1, display: side || spread ? undefined : "none" }}
                      >
                        <div
                          ref={(node) => {
                            castRefs.current[side] = node;
                          }}
                          data-cast={side ? "right" : "left"}
                          className="fb-cast"
                          style={
                            spread
                              ? { top: 0, bottom: 0, width: W * 0.34, ...(side ? { left: 0 } : { right: 0 }), background: `linear-gradient(${side ? "to right" : "to left"}, var(--fb-cast), transparent)` }
                              : { left: 0, right: 0, top: 0, height: H * 0.3, background: "linear-gradient(to bottom, var(--fb-cast), transparent)" }
                          }
                        />
                      </div>
                    ))}
                    {leaves}
                  </div>
                  {["previous", "next"].map((side) => {
                    const disabled = side === "previous" ? prevDisabled : nextDisabled;
                    return (
                      <button
                        key={side}
                        type="button"
                        data-corner={side}
                        aria-label={labels[side]}
                        aria-disabled={disabled || undefined}
                        tabIndex={tabSide === side ? 0 : -1}
                        onFocus={() => setFocusSide(side)}
                        onClick={(event) => {
                          event.stopPropagation();
                          stop();
                          if (!disabled) go(currentPage() + (side === "next" ? 1 : -1));
                        }}
                        className="fb-corner"
                        style={{ left: side === "previous" ? c : c + pagesW - cornerSize, top: top + H - cornerSize, width: cornerSize, height: cornerSize }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <footer className="fb-footer">
          {count <= 24 && (
            <div aria-hidden="true" className="fb-dots">
              {items.map((item, i) => (
                <span key={item.id} className={i === shownPage ? "on" : ""} />
              ))}
            </div>
          )}
          {count > 0 && (
            <p aria-hidden="true" className="fb-counter">
              {two(shownPage + 1)} / {two(count)}
            </p>
          )}
          <p id={`${uid}-live`} aria-live="polite" className="fb-sr">
            {liveText}
          </p>
        </footer>
      </div>
    </section>
  );
});

export default FlipbookScrollGallery;
