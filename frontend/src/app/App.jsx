import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { STRINGS } from "./i18n.js";
import { Ctx, Icon, pick, useApp } from "./ui.jsx";
import Auth from "./pages/Auth.jsx";
import Home from "./pages/Home.jsx";
import Plan from "./pages/Plan.jsx";
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
import Classes from "./staff/Classes.jsx";
import ClassMap from "./staff/ClassMap.jsx";
import StudentCard from "./staff/StudentCard.jsx";
import Feed from "./staff/Feed.jsx";
import ImportResults from "./staff/ImportResults.jsx";
import Cases from "./staff/Cases.jsx";
import Metrics from "./staff/Metrics.jsx";
import Schools from "./staff/Schools.jsx";
import Users from "./staff/Users.jsx";
import Content from "./staff/Content.jsx";
import LessonEdit from "./staff/LessonEdit.jsx";
import { Leads, Audit } from "./staff/Lists.jsx";
import ForcePassword from "./pages/ForcePassword.jsx";
import "@fontsource-variable/onest";
import "./app.css";

const NAV_BOTTOM = [["settings", "settings", "gear"], ["help", "help", "help"]];
const COMMON = { settings: Settings, help: Help, lesson: Lesson };
const STAFF_VIEW = { class: ClassMap, student: StudentCard };
// меню и страницы по ролям
const ROLES = {
  student: {
    nav: [["", "home", "home"], ["plan", "plan", "clip"], ["subjects", "subjects", "book"], ["courses", "courses", "case"],
      ["diagnostics", "diagnostics", "doc"], ["gaps", "gaps", "target"], ["tutor", "tutor", "bot"],
      ["quiz", "quiz", "clip"], ["progress", "progress", "chart"], ["calendar", "calendar", "cal"]],
    pages: { "": Home, plan: Plan, subjects: Subjects, courses: Courses, diagnostics: Diagnostics, gaps: Gaps, tutor: Tutor,
      quiz: Quiz, result: Result, progress: Progress, calendar: Calendar },
  },
  teacher: {
    nav: [["", "classes", "home"], ["feed", "feed", "target"], ["import", "import", "doc"], ["courses", "courses", "case"], ["calendar", "calendar", "cal"]],
    pages: { "": Classes, feed: Feed, import: ImportResults, courses: Courses, calendar: Calendar, ...STAFF_VIEW },
  },
  curator: {
    nav: [["", "cases", "target"], ["classes", "classes", "home"], ["feed", "feed", "clip"]],
    pages: { "": Cases, classes: Classes, feed: Feed, ...STAFF_VIEW },
  },
  admin: {
    nav: [["", "metrics", "chart"], ["schools", "schools", "home"], ["users", "users", "user"], ["classes", "classes", "case"],
      ["content", "content", "book"], ["leads", "leads", "doc"], ["audit", "audit", "clip"]],
    pages: { "": Metrics, schools: Schools, users: Users, classes: Classes, content: Content, edit: LessonEdit, leads: Leads,
      audit: Audit, feed: Feed, import: ImportResults, ...STAFF_VIEW },
  },
};
const ACTIVE = { lesson: "courses", result: "quiz", class: "classes", student: "classes", edit: "content" };

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
    if (user?.role !== "student") return;
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
  else if (user.must_change_password) body = <ForcePassword />;
  else if (route.page === "test") body = <TestRun key={route.param} id={route.param} />;
  else {
    const role = ROLES[user.role] || ROLES.student;
    const pages = { ...COMMON, ...role.pages };
    const Page = pages[route.page] || pages[""];
    // вложенные страницы подсвечивают родительский пункт; если его нет в меню роли — главный
    const mapped = ACTIVE[route.page] ?? route.page;
    const active = [...role.nav, ...NAV_BOTTOM].some(([k]) => k === mapped) ? mapped : "";
    const NAV = role.nav;
    const link = ([k, label, icon]) => (
      <a key={k} href={`#/${k}`} className={active === k ? "active" : ""} aria-current={active === k ? "page" : undefined}>
        <Icon n={icon} /><span>{t.nav[label] ?? t.snav[label]}</span>
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

  const navItems = [...(ROLES[user.role] || ROLES.student).nav, ...NAV_BOTTOM]
    .map(([k, label]) => ({ title: t.nav[label] ?? t.snav[label], href: `#/${k}`, hint: "" }));
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
        {user.role === "student" && (
          <a href="#/gaps" className={`bell ${alerts ? "has" : ""}`} aria-label={t.nav.gaps}>
            <Icon n="bell" s={22} />{alerts > 0 && <span className="bell-count">{alerts}</span>}
          </a>
        )}
        <a href="#/settings" className="user">
          <div className="avatar">{(user.name || "?")[0].toUpperCase()}</div>
          <div className="user-info"><div className="user-name">{user.name}</div>
            <div className="user-sub">{user.role === "student" ? t.grade(user.grade) : t.roles[user.role]}</div></div>
        </a>
      </div>
    </header>
  );
}

