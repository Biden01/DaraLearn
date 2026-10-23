import { useEffect, useState } from "react";
import { TEXT } from "./text.js";
import HeroDemo from "./HeroDemo.jsx";
import PilotForm from "./PilotForm.jsx";
import "@fontsource-variable/onest";
import "./landing.css";

function initialLang() {
  try {
    const saved = localStorage.getItem("dl_lang");
    if (saved === "kk" || saved === "ru") return saved;
  } catch { /* приватный режим */ }
  return (navigator.language || "").startsWith("ru") ? "ru" : "kk";
}

export default function Landing() {
  const [lang, setLang] = useState(initialLang);
  const t = TEXT[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("dl_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <a href="/" className="brand"><img src="/logo.png" alt="" width="34" height="34" />DaraLearn</a>
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
          <div className="wrap hero-in">
            <div className="hero-copy">
              <h1>{t.hero.title}</h1>
              <p className="lead">{t.hero.lead}</p>
              <div className="cta">
                <a href="/app#register" className="btn">{t.hero.start}</a>
                <a href="#pilot" className="btn ghost">{t.hero.pilot}</a>
              </div>
              <p className="muted small">{t.hero.note}</p>
            </div>
            <HeroDemo t={t.demo} key={lang} />
          </div>
        </section>

        <section id="how" className="band">
          <div className="wrap">
            <h2>{t.loop.title}</h2>
            <p className="lead narrow">{t.loop.lead}</p>
            <ol className="loop">
              {t.loop.steps.map(([h, d], i) => (
                <li key={h}>
                  <span className="loop-n">{i + 1}</span>
                  <h3>{h}</h3>
                  <p>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section>
          <div className="wrap honest">
            <div>
              <h2>{t.honest.title}</h2>
              <p className="lead">{t.honest.text}</p>
            </div>
            <div className="meter" aria-hidden="true">
              <div className="meter-row"><span>{t.honest.practice}</span><b>92%</b><i style={{ "--w": "92%" }} className="soft" /></div>
              <div className="meter-row"><span>{t.honest.check}</span><b>58%</b><i style={{ "--w": "58%" }} /></div>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="wrap">
            <h2>{t.roles.title}</h2>
            <div className="roles">
              {t.roles.items.map(([h, d]) => (
                <div key={h}><h3>{h}</h3><p>{d}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>{t.inside.title}</h2>
            <dl className="inside">
              {t.inside.items.map(([h, d]) => (
                <div key={h}><dt>{h}</dt><dd>{d}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section id="pilot" className="pilot">
          <div className="wrap pilot-in">
            <div>
              <h2>{t.pilot.title}</h2>
              <p className="lead">{t.pilot.lead}</p>
              <ul className="ticks">{t.pilot.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
            <PilotForm t={t.pilot} key={lang} />
          </div>
        </section>

        <section id="faq">
          <div className="wrap faq">
            <h2>{t.faq.title}</h2>
            <div>
              {t.faq.items.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <a href="/" className="brand"><img src="/logo.png" alt="" width="28" height="28" />DaraLearn</a>
          <span className="muted small">{t.footer.rights}</span>
          <span className="muted small">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </>
  );
}
