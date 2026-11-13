import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { fox } from "../app/ui.jsx";

// Стопка карточек с фото: тянется мышью/пальцем, листается стрелками и сама раз в несколько секунд.
// Порт карусели «stacked» на наш CSS вместо Tailwind.

const SPRING = { type: "spring", stiffness: 200, damping: 30, mass: 1 };
const AUTOPLAY_MS = 3800;

function getConfig(width) {
  if (width < 640) return { distanceDivisor: 120, velocityDivisor: 500, sensitivity: 180, x: 78, y: 18, rotate: 8, scale: 0.07 };
  if (width < 1024) return { distanceDivisor: 160, velocityDivisor: 650, sensitivity: 220, x: 120, y: 26, rotate: 10, scale: 0.09 };
  return { distanceDivisor: 200, velocityDivisor: 800, sensitivity: 250, x: 160, y: 34, rotate: 11, scale: 0.11 };
}

export default function HeroCarousel({ slides, label }) {
  const progress = useMotionValue(0);
  const start = useRef(0);
  const paused = useRef(false);
  const [width, setWidth] = useState(() => window.innerWidth);
  const config = useMemo(() => getConfig(width), [width]);
  const total = slides.length;

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const go = (step) => animate(progress, Math.round(progress.get()) + step, SPRING);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { if (!paused.current && !document.hidden) go(1); }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, []);

  function onDragEnd(_, info) {
    const shift = -info.offset.x / config.distanceDivisor - info.velocity.x / config.velocityDivisor;
    const step = Math.max(-3, Math.min(3, Math.round(shift)));
    animate(progress, Math.round(start.current) + step, SPRING);
    paused.current = false;
  }

  function onKey(e) {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  }

  return (
    <div className="stack" role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0} onKeyDown={onKey}
      onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <motion.div
        className="stack-drag"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0}
        onDragStart={() => { start.current = progress.get(); paused.current = true; }}
        onDrag={(_, info) => progress.set(progress.get() - info.delta.x / config.sensitivity)}
        onDragEnd={onDragEnd}
      />
      {slides.map((s, i) => (
        <StackCard key={s.title} slide={s} index={i} total={total} progress={progress} config={config} />
      ))}
    </div>
  );
}

function StackCard({ slide, index, total, progress, config }) {
  // Смещение карточки от центра по кругу: …, -2, -1, 0, 1, 2, …
  const offset = useTransform(progress, (p) => {
    let d = (index - p) % total;
    if (d > total / 2) d -= total;
    if (d < -total / 2) d += total;
    return d;
  });
  const x = useTransform(offset, (o) => o * config.x);
  const y = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : Math.abs(o) * config.y));
  const rotate = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : o * config.rotate));
  const scale = useTransform(offset, (o) => 1 - Math.abs(o) * config.scale);
  const opacity = useTransform(offset, [-total / 2, -total / 2 + 0.5, 0, total / 2 - 0.5, total / 2], [0, 1, 1, 1, 0]);
  const zIndex = useTransform(offset, (o) => Math.round(100 - Math.abs(o) * 10));
  const dim = useTransform(offset, [-2, -0.5, 0, 0.5, 2], [0.5, 0.2, 0, 0.2, 0.5]);
  const text = useTransform(offset, [-0.5, 0, 0.5], [0, 1, 0]);

  return (
    <motion.div className="stack-card" style={{ x, y, rotate, scale, opacity, zIndex }}>
      <img src={slide.image} alt="" draggable="false" />
      <motion.div className="stack-dim" style={{ opacity: dim }} />
      <div className="stack-shade" />
      <span className="stack-badge">{slide.badge}</span>
      <motion.div className="stack-text" style={{ opacity: text }}>
        <p className="stack-title">{fox(slide.title)}</p>
        <p className="stack-desc">{fox(slide.description)}</p>
      </motion.div>
    </motion.div>
  );
}
