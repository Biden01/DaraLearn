import { useEffect, useRef, useState } from "react";
import { TEXT } from "./text.js";
import HeroDemo from "./HeroDemo.jsx";
import HeroCarousel from "./HeroCarousel.jsx";
import PilotForm from "./PilotForm.jsx";
import RevealText from "../components/ui/reveal-text.jsx";
import { ArrowLoop, ArrowCurl, ArrowFlick, SpinBadge } from "./Doodles.jsx";
import "@fontsource-variable/onest";
import "./landing.css";
import "./landing-bold.css";

function initialLang() {
  try {
    const saved = localStorage.getItem("dl_lang");
    if (saved === "kk" || saved === "ru") return saved;
  } catch { /* приватный режим */ }
  return (navigator.language || "").startsWith("ru") ? "ru" : "kk";
}

// Контурные иконки 24×24 для карточек.
const ICONS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  help: <><path d="M12 21a9 9 0 1 0-9-9c0 1.6.4 3 1.1 4.3L3 21l4.7-1.1A9 9 0 0 0 12 21Z" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.4M12 16.5v.01" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></>,
  student: <><path d="M2 9.5 12 5l10 4.5L12 14 2 9.5Z" /><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5M22 9.5V15" /></>,
  teacher: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M7 20h10M12 16v4M7 12l3-3 2.5 2.5L17 7" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z" /><path d="M10 21h4" /></>,
  pulse: <><path d="M3 12h4l2.5-6 5 12 2.5-6h4" /></>,
  map: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="m7.6 7.9 3 7.6M16.4 7.9l-3 7.6" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  book: <><path d="M3 5.5C5.5 4 9 4 12 6c3-2 6.5-2 9-.5V19c-2.5-1.5-6-1.5-9 .5-3-2-6.5-2-9-.5V5.5Z" /><path d="M12 6v13.5" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
};
const LOOP_ICONS = ["search", "help", "check"];
const ROLE_ICONS = ["student", "teacher", "bell"];
// Карточки карусели в герое: [номер фото, пункт из t.inside.items, роль из t.roles.items].
const HERO_SLIDES = [[1, 0, 0], [2, 2, 0], [3, 1, 1], [4, 3, 0], [5, 4, 2]];
const CHIPS = [["pulse", 0], ["map", 1], ["chat", 2], ["chart", 4]];

// Мини-иллюстрации для плиток «Что внутри» — без текста, чтобы не переводить.
const VISUALS = [
  <div className="v-rows">{[86, 64, 40, 92].map((w) => <i key={w} style={{ "--w": `${w}%` }} />)}</div>,
  <svg className="v-map" viewBox="0 0 120 70"><path d="M24 16 60 54M96 16 60 54" /><circle cx="24" cy="16" r="9" /><circle cx="96" cy="16" r="9" className="gap" /><circle cx="60" cy="54" r="11" className="cur" /></svg>,
  <div className="v-chat"><i /><i /><i /></div>,
  <div className="v-cards"><i /><i /><i /></div>,
  <div className="v-bars">{[30, 46, 40, 62, 74, 90].map((h, i) => <i key={i} style={{ "--h": `${h}%` }} />)}</div>,
  <div className="v-cal">{Array.from({ length: 21 }, (_, i) => <i key={i} className={[3, 8, 11, 17].includes(i) ? "on" : i === 13 ? "test" : ""} />)}</div>,
];

function Icon({ name }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  );
}

function Head({ kicker, title, lead, center }) {
  return (
    <div className={center ? "head center" : "head"}>
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

// Плавное появление блоков при прокрутке.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  const [lang, setLang] = useState(initialLang);
  const [scrolled, setScrolled] = useState(false);
  const t = TEXT[lang];
  const railRef = useRef(null);
  const slide = (dir) => {
    const rail = railRef.current;
    const card = rail?.querySelector(".feat");
    if (card) rail.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: "smooth" });
  };
  const [titleA, ...titleB] = t.hero.title.split(". ");
  useReveal();

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("dl_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={scrolled ? "top scrolled" : "top"}>
        <div className="wrap top-in">
          <a href="/" className="brand pill-logo" aria-label="DaraLearn"><span className="pl-a">DARA</span><span className="pl-b">LEARN</span></a>
          <nav className="top-nav" aria-label="Main">
            <a href="#how">{t.nav.how}</a>
            <a href="#pilot">{t.nav.schools}</a>
            <a href="#faq">{t.nav.faq}</a>
          </nav>
          <div className="top-act">
            <div className="lang" role="group" aria-label="Тіл / Язык">
              {["kk", "ru"].map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l === "kk" ? "ҚАЗ" : "РУС"}</button>
              ))}
            </div>
            <a href="/app" className="btn ghost sm">{t.nav.login}</a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-bg" aria-hidden="true" />
          <div className="wrap hero-in">
            <HeroCarousel label={t.inside.title} slides={HERO_SLIDES.map(([img, item, role]) => ({
              image: `/landing/slide-${img}.jpg`,
              title: t.inside.items[item][0],
              description: t.inside.items[item][1],
              badge: t.roles.items[role][0],
            }))} key={lang} />
            <div className="hero-title">
              <ArrowLoop className="doodle doodle-l" />
              <ArrowCurl className="doodle doodle-r" />
              <RevealText
                as="h1"
                key={`title-${lang}`}
                delay={0.15}
                duration={0.85}
                lines={[
                  { text: `${titleA}.` },
                  ...(titleB.length > 0 ? [{ text: titleB.join(". "), className: "accent" }] : []),
                ]}
              />
            </div>
            <p className="lead">{t.hero.lead}</p>
            <div className="cta">
              <div className="cta-pill">
                <a href="/app#register" className="btn lg">{t.hero.start}<span aria-hidden="true">→</span></a>
                <p>{t.hero.note}</p>
              </div>
              <a href="#pilot" className="btn ghost lg">{t.hero.pilot}</a>
            </div>
            <ul className="facts">
              {t.hero.facts.map(([b, s]) => <li key={b}><b>{b}</b><span>{s}</span></li>)}
            </ul>
          </div>
          <SpinBadge href="/app#register" text={t.hero.start} className="hero-badge" />
        </section>

        <div className="sheet">
        <section className="platform">
          <div className="wrap">
            <div className="stage reveal">
              <Head kicker="DaraLearn" title={t.platform.title} lead={t.platform.lead} center />
              <div className="laptop">
                <div className="laptop-screen">
                  <div className="window">
                    <div className="window-bar" aria-hidden="true"><i /><i /><i /><span>daralearn.kz/app</span></div>
                    <HeroDemo t={t.demo} key={lang} />
                  </div>
                </div>
                <div className="laptop-base" aria-hidden="true" />
                {CHIPS.map(([icon, i], n) => (
                  <div key={icon} className={`chip chip-${n}`} aria-hidden="true">
                    <span className="ico-sm"><Icon name={icon} /></span>{t.inside.items[i][0]}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="band">
          <div className="wrap">
            <Head kicker={t.loop.kicker} title={t.loop.title} lead={t.loop.lead} center />
            <ol className="loop">
              {t.loop.steps.map(([h, d], i) => (
                <li key={h} className="card reveal" style={{ "--d": `${i * 80}ms` }}>
                  <div className="card-top"><span className="ico-box"><Icon name={LOOP_ICONS[i]} /></span><span className="loop-n">0{i + 1}</span></div>
                  <h3>{h}</h3>
                  <p>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="rail-sec">
          <div className="wrap">
            <div className="row-head">
              <Head kicker={t.inside.kicker} title={t.inside.title} />
              <div className="arrows">
                <button type="button" aria-label="←" onClick={() => slide(-1)}>←</button>
                <button type="button" aria-label="→" onClick={() => slide(1)}>→</button>
              </div>
            </div>
          </div>
          <div className="rail" ref={railRef}>
            {t.inside.items.map(([h, d], i) => (
              <article key={h} className={`feat feat-${i}`}>
                <div className="feat-vis" aria-hidden="true">{VISUALS[i]}</div>
                <h3>{h}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <ArrowFlick className="doodle doodle-band" />
          <div className="wrap cta-band-in">
            <div>
              <h2>{t.band.title}</h2>
              <p>{t.band.text}</p>
            </div>
            <a href="#pilot" className="btn yellow lg">{t.hero.pilot}<span aria-hidden="true">→</span></a>
          </div>
        </section>

        <section>
          <div className="wrap honest">
            <div className="reveal">
              <Head kicker={t.honest.kicker} title={t.honest.title} />
              <p className="lead">{t.honest.text}</p>
            </div>
            <div className="meter card reveal" aria-hidden="true">
              <p className="meter-cap">{t.honest.example}</p>
              <div className="meter-row"><span>{t.honest.practice}</span><b className="dim">92%</b><i style={{ "--w": "92%" }} className="soft" /></div>
              <div className="meter-row"><span>{t.honest.check}</span><b>58%</b><i style={{ "--w": "58%" }} /></div>            </div>
          </div>
        </section>

        <section className="band">
          <div className="wrap">
            <Head kicker={t.roles.kicker} title={t.roles.title} center />
            <div className="roles">
              {t.roles.items.map(([h, d], i) => (
                <div key={h} className="card reveal" style={{ "--d": `${i * 80}ms` }}>
                  <span className="ico-box"><Icon name={ROLE_ICONS[i]} /></span>
                  <h3>{h}</h3><p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pilot" className="pilot">
          <div className="pilot-bg" aria-hidden="true" />
          <div className="wrap pilot-in">
            <div>
              <Head kicker={t.pilot.kicker} title={t.pilot.title} />
              <p className="lead">{t.pilot.lead}</p>
              <ul className="ticks">{t.pilot.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
            <PilotForm t={t.pilot} key={lang} />
          </div>
        </section>

        <section id="faq">
          <div className="wrap faq">
            <div>
              <Head kicker={t.faq.kicker} title={t.faq.title} />
              <p className="muted">{t.faq.more}</p>
              <a href="#pilot" className="btn ghost sm faq-cta">{t.hero.pilot}</a>
            </div>
            <div>
              {t.faq.items.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>
        </div>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div className="foot-brand">
            <a href="/" className="brand pill-logo" aria-label="DaraLearn"><span className="pl-a">DARA</span><span className="pl-b">LEARN</span></a>
            <p className="muted small">{t.footer.rights}</p>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <a href="#how">{t.nav.how}</a>
            <a href="#pilot">{t.nav.schools}</a>
            <a href="#faq">{t.nav.faq}</a>
            <a href="/app">{t.nav.login}</a>
          </nav>
          <span className="muted small foot-copy">© {new Date().getFullYear()} DaraLearn</span>
        </div>
      </footer>
    </>
  );
}
