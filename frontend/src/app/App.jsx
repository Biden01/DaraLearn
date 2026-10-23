import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { STRINGS } from "./i18n.js";
import { Ctx, Icon, pick, useApp } from "./ui.jsx";
import Auth from "./pages/Auth.jsx";
import Home from "./pages/Home.jsx";
import Subjects from "./pages/Subjects.jsx";
import Courses from "./pages/Courses.jsx";
import Lesson from "./pages/Lesson.jsx";
import Diagnostics from "./pages/Diagnostics.jsx";
import Gaps from "./pages/Gaps.jsx";
import Tutor from "./pages/Tutor.jsx";
import Quiz from "./pages/Quiz.jsx";
import TestRun from "./pages/TestRun.jsx";
import Result from "./pages/Result.jsx";
import Progress from "./pages/Progress.jsx";
import Calendar from "./pages/Calendar.jsx";
import Settings from "./pages/Settings.jsx";
import Help from "./pages/Help.jsx";
import "@fontsource-variable/onest";
import "./app.css";

const NAV = [["", "home", "home"], ["subjects", "subjects", "book"], ["courses", "courses", "case"],
  ["diagnostics", "diagnostics", "doc"], ["gaps", "gaps", "target"], ["tutor", "tutor", "bot"],
  ["quiz", "quiz", "clip"], ["progress", "progress", "chart"], ["calendar", "calendar", "cal"]];
const NAV_BOTTOM = [["settings", "settings", "gear"], ["help", "help", "help"]];
const PAGES = { "": Home, subjects: Subjects, courses: Courses, lesson: Lesson, diagnostics: Diagnostics, gaps: Gaps,
  tutor: Tutor, quiz: Quiz, result: Result, progress: Progress, calendar: Calendar, settings: Settings, help: Help };
const ACTIVE = { lesson: "courses", result: "quiz" };

function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = h.split("?");
  const [page = "", ...rest] = path.split("/");
  return { page, param: rest.join("/"), query: new URLSearchParams(query) };
}

function storedLang() {
  try { const l = localStorage.getItem("dl_lang"); if (l === "kk" || l === "ru") return l; } catch { /* */ }
  return (navigator.language || "").startsWith("ru") ? "ru" : "kk";
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined — загрузка, null — не вошёл
  const [lang, setLangState] = useState(storedLang);
  const [route, setRoute] = useState(parseHash);
  const [toastMsg, setToastMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState(0);
  const toastTimer = useRef();
  const t = STRINGS[lang];

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem("dl_lang", l); } catch { /* */ }
    setUser((u) => {
      if (u) api("/auth/me", { method: "PATCH", body: { lang: l } }).catch(() => {});
      return u ? { ...u, lang: l } : u;
    });
  }, []);

  useEffect(() => {
    api("/auth/me").then((u) => { setUser(u); setLangState(u.lang); }).catch(() => setUser(null));
    const onHash = () => { setRoute(parseHash()); setMenuOpen(false); window.scrollTo(0, 0); };
    const onUnauth = () => setUser(null);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("dl:unauthorized", onUnauth);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("dl:unauthorized", onUnauth); };
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // число важных рекомендаций для колокольчика
  useEffect(() => {
    if (!user) return;
    api("/decisions/me").then((d) => setAlerts(d.recommendations.filter((r) => r.priority >= 2).length)).catch(() => {});
  }, [user, route.page]);

  const ctx = useMemo(() => ({
    t, lang, setLang, user, setUser, toast, route,
    L: (v) => pick(v, lang),
    go: (hash) => { window.location.hash = hash; },
    startTest: async (body) => {
      try {
        const a = await api("/verification/attempts", { method: "POST", body });
        window.location.hash = `#/test/${a.id}`;
      } catch { toast(t.error); }
    },
  }), [t, lang, setLang, user, toast, route]);

  if (user === undefined) return <div className="loading">…</div>;

  let body;
  if (!user) body = <Auth />;
  else if (route.page === "test") body = <TestRun key={route.param} id={route.param} />;
  else {
    const Page = PAGES[route.page] || Home;
    const active = ACTIVE[route.page] ?? route.page;
    const link = ([k, label, icon]) => (
      <a key={k} href={`#/${k}`} className={active === k ? "active" : ""} aria-current={active === k ? "page" : undefined}>
        <Icon n={icon} /><span>{t.nav[label]}</span>
      </a>
    );
    body = (
      <div className={menuOpen ? "menu-open" : ""}>
        <aside className="sidebar" style={menuOpen ? { transform: "none" } : undefined}>
          <a href="#/" className="brand"><img src="/logo.png" alt="" /> DaraLearn</a>
          <nav className="nav" aria-label="Main">{NAV.map(link)}</nav>
          <nav className="nav nav-bottom">{NAV_BOTTOM.map(link)}</nav>
        </aside>
        {menuOpen && <div className="overlay" style={{ display: "block", position: "fixed", inset: 0, background: "rgba(17,19,41,.3)", zIndex: 25 }} onClick={() => setMenuOpen(false)} />}
        <Header alerts={alerts} onMenu={() => setMenuOpen(true)} />
        <main className="main" id="app"><Page key={route.page + route.param} /></main>
      </div>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      {body}
      <div className={`toast ${toastMsg ? "show" : ""}`} role="status">{toastMsg}</div>
    </Ctx.Provider>
  );
}

function Header({ alerts, onMenu }) {
  const { t, lang, setLang, user, L } = useApp();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState([]);
  const [sel, setSel] = useState(0);
  const input = useRef();

  useEffect(() => {
    api("/content/courses?subject=math").then((cs) => {
      const items = [];
      cs.forEach((c) => {
        items.push({ title: c.title, href: "#/courses", hint: t.nav.courses });
        c.lessons.forEach((l) => items.push({ title: l.title, href: `#/lesson/${l.slug}`, hint: c.title }));
      });
      setIndex(items);
    }).catch(() => {});
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navItems = [...NAV, ...NAV_BOTTOM].map(([k, label]) => ({ title: t.nav[label], href: `#/${k}`, hint: "" }));
  const hits = q.trim()
    ? [...navItems, ...index.map((x) => ({ ...x, title: L(x.title), hint: L(x.hint) }))]
      .filter((x) => x.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 7)
    : [];

  const goTo = (h) => { window.location.hash = h.href; setQ(""); input.current?.blur(); };
  return (
    <header className="header">
      <button className="burger" aria-label={t.menu} onClick={onMenu}><Icon n="menu" s={22} /></button>
      <label className="search">
        <Icon n="search" s={18} />
        <input ref={input} value={q} placeholder={t.search} aria-label={t.search}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && hits[sel]) goTo(hits[sel]);
            if (e.key === "Escape") setQ("");
          }} />
        <span className="kbd">Ctrl K</span>
        {q.trim() && (
          <div className="search-pop" role="listbox">
            {hits.length ? hits.map((h, i) => (
              <a key={h.href + h.title} href={h.href} className={i === sel ? "on" : ""} onClick={() => setQ("")}>
                <span>{h.title}</span><span className="muted small">{h.hint}</span>
              </a>
            )) : <div className="muted small" style={{ padding: 10 }}>{t.nothing}</div>}
          </div>
        )}
      </label>
      <div className="header-right">
        <div className="lang" role="group" aria-label="Тіл / Язык">
          {["kk", "ru"].map((l) => (
            <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l === "kk" ? "ҚАЗ" : "РУС"}</button>
          ))}
        </div>
        <a href="#/gaps" className={`bell ${alerts ? "has" : ""}`} aria-label={t.nav.gaps}>
          <Icon n="bell" s={22} />{alerts > 0 && <span className="bell-count">{alerts}</span>}
        </a>
        <a href="#/settings" className="user">
          <div className="avatar">{(user.name || "?")[0].toUpperCase()}</div>
          <div className="user-info"><div className="user-name">{user.name}</div><div className="user-sub">{t.grade(user.grade)}</div></div>
        </a>
      </div>
    </header>
  );
}

