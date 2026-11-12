import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

// Появление текста по словам: размытие + подъём, со сдвигом между словами.
// Перенос компонента RevealText (21st.dev) под проект: JSX, без Tailwind,
// "motion/react" вместо "framer-motion" (тот же API).

const FONT_SIZES = {
  sm: "clamp(0.875rem, 1.5vw, 1.125rem)",
  base: "clamp(1rem, 2vw, 1.375rem)",
  lg: "clamp(1.375rem, 3vw, 2rem)",
  xl: "clamp(1.75rem, 4vw, 2.75rem)",
  "2xl": "clamp(2rem, 5vw, 4rem)",
  display: "clamp(2rem, 5vw, 4rem)",
  huge: "clamp(2.5rem, 7vw, 5.5rem)",
};

const MOTION_ELEMENTS = {
  h1: motion.h1, h2: motion.h2, h3: motion.h3, h4: motion.h4,
  p: motion.p, span: motion.span, div: motion.div,
};

export function splitTextIntoWords(input) {
  return input ? input.trim().split(/\s+/) : [];
}

export function createRevealVariants({ stagger = 0.045, delay = 0, duration = 0.8, yOffset = 24, blur = 10 }) {
  return {
    containerVariants: {
      hidden: {},
      visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
    },
    childVariants: {
      hidden: { opacity: 0, y: yOffset, filter: `blur(${typeof blur === "number" ? `${blur}px` : blur})` },
      visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration, ease: [0.215, 0.61, 0.355, 1] } },
    },
  };
}

/**
 * text / children — строка; lines — [{ text, className }] для нескольких строк
 * с разным оформлением (каждая строка — отдельный блок, слова идут одной волной).
 * size — пресет или CSS-значение; без size размер берётся из CSS страницы.
 */
export default function RevealText({
  text, children, lines, className, size, as = "h2",
  delay = 0, duration = 0.8, stagger = 0.045, yOffset = 24, blur = 10,
  once = true, viewportMargin = "-10% 0px", style,
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: viewportMargin });
  const reduce = useReducedMotion();

  const groups = lines ?? [{ text: typeof children === "string" ? children : text || "" }];
  const { containerVariants, childVariants } = createRevealVariants({ stagger, delay, duration, yOffset, blur });
  const Tag = MOTION_ELEMENTS[as] || motion.h2;
  const label = groups.map((g) => g.text).join(" ");

  return (
    <Tag
      ref={ref}
      className={className}
      aria-label={label}
      variants={containerVariants}
      initial={reduce ? false : "hidden"}
      animate={reduce || isInView ? "visible" : "hidden"}
      style={size ? { fontSize: FONT_SIZES[size] ?? size, ...style } : style}
    >
      {groups.map((g, gi) => (
        <span key={gi} className={g.className} aria-hidden="true">
          {splitTextIntoWords(g.text).map((word, i, all) => (
            <span key={i}>
              <motion.span variants={childVariants} style={{ display: "inline-block", willChange: "transform, opacity, filter" }}>
                {word}
              </motion.span>
              {i < all.length - 1 && " "}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
