import { useEffect, useState } from "react";
import {
  SCHOOL, skills, skillById, students, HERO_ID, scenario, heroState, hypotheses,
  diagTasks, tutorScript, teacherFeed, adviserCases, taskBank, importPreview,
} from "./data.js";
import "./demo.css";

const ROLES = [
  ["scenario", "Сценарий", "Один ученик проходит полный цикл"],
  ["student", "Ученик", "План на сегодня, репетитор, прогресс"],
  ["teacher", "Учитель", "Класс, причины, лента действий"],
  ["curator", "Куратор", "Случаи и следующие шаги"],
  ["admin", "Администратор", "Материалы, задания, импорт"],
];

function pct(v) { return v == null ? "—" : `${v} %`; }
function tone(v) { return v == null ? "none" : v >= 70 ? "ok" : v >= 50 ? "mid" : "low"; }
function stateWithHero(step) {
  return students.map((s) => (s.id === HERO_ID ? { ...s, state: heroState(step) } : s));
}

function Skill({ id, st }) {
  const [p, i, n] = st;
  return (
    <div className={`skill tone-${tone(i)}`}>
      <div className="skill-name">{skillById[id].name}</div>
      <div className="skill-bars">
        <span title="Практика с подсказками"><small>Практика</small><b>{pct(p)}</b></span>
        <span title="Независимая проверка"><small>Проверка</small><b>{pct(i)}</b></span>
        <span><small>Событий</small><b>{n}</b></span>
      </div>
      {i == null && <div className="skill-note">Недостаточно данных</div>}
    </div>
  );
}

/* ---------- Сценарий ---------- */
function Scenario({ step, setStep }) {
  const s = scenario[step];
  const st = heroState(step);
  return (
    <div className="scn">
      <div className="scn-steps" role="tablist">
        {scenario.map((x, i) => (
          <button key={x.key} role="tab" aria-selected={i === step} className={"scn-step" + (i === step ? " active" : i < step ? " done" : "")} onClick={() => setStep(i)}>
            <span className="scn-num">{i === 0 ? "•" : i}</span>
            <span><b>{x.title}</b><small>{x.short}</small></span>
          </button>
        ))}
      </div>
      <div className="scn-body">
        <div className="card scn-main">
          <p className="eyebrow">Шаг {step} из {scenario.length - 1} · Алихан Серик, {SCHOOL.klass}</p>
          <h2>{s.title}</h2>
          <p className="scn-text">{s.text}</p>
          <div className="sys"><b>Система</b>{s.system}</div>
          {step === 2 && (
            <div className="hyps">
              {hypotheses.map((h) => (
                <div key={h.title} className="hyp"><div className="hyp-bar" style={{ width: `${h.p * 100}%` }} /><b>{h.title}</b> <span>{Math.round(h.p * 100)} %</span><p>{h.text}</p></div>
              ))}
            </div>
          )}
          {step === 3 && (
            <ol className="diag">
              {diagTasks.map((t) => (
                <li key={t.q} className={t.ok ? "ok" : "bad"}><span>{t.q}</span><small>Ответ: {t.given} · верно: {t.a}</small></li>
              ))}
            </ol>
          )}
          {step === 4 && <TutorChat compact />}
          {step === 5 && (
            <div className="before-after">
              <div><small>До занятия</small><b>1 из 3</b><span>диагностика без подсказок</span></div>
              <div><small>Практика</small><b>85 %</b><span>с репетитором, 4 подсказки</span></div>
              <div className="accent"><small>Через 3 дня</small><b>4 из 5</b><span>новые задания без подсказок</span></div>
            </div>
          )}
          <div className="scn-nav">
            <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Назад</button>
            {step < scenario.length - 1
              ? <button className="btn" onClick={() => setStep(step + 1)}>Дальше: {scenario[step + 1].title}</button>
              : <button className="btn" onClick={() => setStep(0)}>Начать заново</button>}
          </div>
        </div>
        <aside className="card scn-side">
          <h3>Student State · Алихан</h3>
          <p className="muted">Практика и независимая проверка считаются отдельно.</p>
          <div className="skills">
            {["prob", "comb", "count", "frac"].map((id) => <Skill key={id} id={id} st={st[id]} />)}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Ученик ---------- */
function TutorChat({ compact }) {
  const [n, setN] = useState(compact ? tutorScript.length : 2);
  const shown = tutorScript.slice(0, n);
  const stages = [...new Set(tutorScript.map((t) => t.stage))];
  const curStage = shown[shown.length - 1]?.stage;
  return (
    <div className={"chat" + (compact ? " compact" : "")}>
      <div className="chat-stages">
        {stages.map((st, i) => <span key={st} className={stages.indexOf(curStage) >= i ? "on" : ""}>{i + 1}. {st}</span>)}
      </div>
      <div className="chat-log">
        {shown.map((m, i) => <div key={i} className={"msg " + m.who}><small>{m.who === "tutor" ? "Репетитор" : "Алихан"}</small>{m.text}</div>)}
      </div>
      {!compact && (
        <div className="chat-actions">
          {n < tutorScript.length
            ? <button className="btn btn-small" onClick={() => setN(n + 1)}>{tutorScript[n].who === "student" ? "Ответить" : "Продолжить"}</button>
            : <span className="done-pill">Занятие завершено · практика 85 % · проверка через 3 дня</span>}
        </div>
      )}
    </div>
  );
}

export function StudentView({ step }) {
  const st = heroState(step);
  const [tab, setTab] = useState("plan");
  return (
    <div className="grid-2">
      <div className="card">
        <div className="tabs">
          <button className={tab === "plan" ? "on" : ""} onClick={() => setTab("plan")}>План на сегодня</button>
          <button className={tab === "tutor" ? "on" : ""} onClick={() => setTab("tutor")}>Занятие с репетитором</button>
        </div>
        {tab === "plan" ? (
          <ul className="plan">
            <li className="todo"><b>Комбинации · занятие с репетитором</b><span>20 минут. Разберём, когда порядок не важен.</span></li>
            <li><b>Дроби и проценты · 3 задания</b><span>Повторение, без подсказок.</span></li>
            <li className="later"><b>Классическая вероятность</b><span>Вернёмся после комбинаций.</span></li>
          </ul>
        ) : <TutorChat />}
      </div>
      <div className="card">
        <h3>Мой прогресс</h3>
        <p className="muted">Проверка — задания без подсказок спустя время.</p>
        <div className="skills">{skills.map((s) => <Skill key={s.id} id={s.id} st={st[s.id]} />)}</div>
      </div>
    </div>
  );
}

/* ---------- Учитель ---------- */
export function TeacherView({ step }) {
  const data = stateWithHero(step);
  const [sel, setSel] = useState(HERO_ID);
  const [feed, setFeed] = useState({});
  const items = teacherFeed(step);
  const stu = data.find((s) => s.id === sel);
  return (
    <div className="grid-2 teacher">
      <div className="card">
        <h3>{SCHOOL.klass} · {SCHOOL.subject}</h3>
        <p className="muted">Независимая проверка по навыкам. Нажмите на ученика.</p>
        <div className="heat">
          <div className="heat-row head"><span /> {skills.map((s) => <span key={s.id} title={s.name}>{s.name.split(" ")[0]}</span>)}</div>
          {data.map((s) => (
            <button key={s.id} className={"heat-row" + (s.id === sel ? " sel" : "")} onClick={() => setSel(s.id)}>
              <span>{s.id} · {s.name.split(" ")[0]}</span>
              {skills.map((k) => { const v = s.state[k.id][1]; return <span key={k.id} className={"cell tone-" + tone(v)}>{v == null ? "·" : v}</span>; })}
            </button>
          ))}
        </div>
        <div className="student-card">
          <h4>{stu.name}</h4>
          {sel === HERO_ID ? (
            <>
              <div className="hyps small">
                {hypotheses.map((h) => <div key={h.title} className="hyp"><div className="hyp-bar" style={{ width: `${h.p * 100}%` }} /><b>{h.title}</b> <span>{Math.round(h.p * 100)} %</span></div>)}
              </div>
              <p className="muted">{step >= 3 ? "Гипотеза подтверждена диагностикой (1 из 3)." : "Гипотезы требуют проверки: назначена диагностика."}</p>
            </>
          ) : <p className="muted">Выберите ученика 001, чтобы увидеть разбор причин из сценария.</p>}
        </div>
      </div>
      <div className="card">
        <h3>Лента действий</h3>
        <p className="muted">Система объясняет, кому нужна помощь и почему. Решение за учителем.</p>
        <div className="feed">
          {items.map((it) => (
            <div key={it.id} className={"feed-item " + (feed[it.id] || "")}>
              <div><b>{it.title}</b><span>{it.text}</span><small>Правило: {it.rule}</small></div>
              {feed[it.id]
                ? <em>{{ ok: "Принято", edit: "Изменено", no: "Отклонено" }[feed[it.id]]}</em>
                : <div className="feed-btns">
                    <button onClick={() => setFeed({ ...feed, [it.id]: "ok" })}>Принять</button>
                    <button onClick={() => setFeed({ ...feed, [it.id]: "edit" })}>Изменить</button>
                    <button onClick={() => setFeed({ ...feed, [it.id]: "no" })}>Отклонить</button>
                  </div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Куратор ---------- */
export function CuratorView() {
  const [done, setDone] = useState({});
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Очередь случаев · период: 2 недели</h3>
        <p className="muted">Учитель помогает с пробелами, куратор — с планом, посещаемостью и организацией.</p>
        <div className="cases">
          {adviserCases.map((c) => (
            <div key={c.id} className={"case" + (done[c.id] ? " done" : "")}>
              <div className="case-head"><b>{c.student}</b><span>план {c.plan} % · пропущено {c.missed}</span></div>
              <div className="case-bar"><i style={{ width: `${c.plan}%` }} /></div>
              <p>{c.rec}</p>
              {done[c.id] ? <em>Отмечено: выполнено</em> : <button className="btn btn-small" onClick={() => setDone({ ...done, [c.id]: true })}>Отметить выполненным</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Правила куратора</h3>
        <table className="tbl">
          <tbody>
            <tr><td>Выполнение плана ниже 50 % за период</td><td>Беседа с куратором</td></tr>
            <tr><td>3+ пропуска за 2 недели</td><td>Связь с родителями</td></tr>
            <tr><td>Две помощи ИИ без прогресса</td><td>Передать учителю</td></tr>
          </tbody>
        </table>
        <p className="muted">Пороги предварительные, согласуются со школой до пилота.</p>
      </div>
    </div>
  );
}

/* ---------- Администратор ---------- */
export function AdminView() {
  const [tab, setTab] = useState("skills");
  const purpose = { diagnostic: "Диагностика", practice: "Практика", verification: "Проверка" };
  return (
    <div className="card">
      <div className="tabs">
        <button className={tab === "skills" ? "on" : ""} onClick={() => setTab("skills")}>Карта навыков</button>
        <button className={tab === "tasks" ? "on" : ""} onClick={() => setTab("tasks")}>Банк заданий</button>
        <button className={tab === "import" ? "on" : ""} onClick={() => setTab("import")}>Импорт Excel/CSV</button>
      </div>
      {tab === "skills" && (
        <>
          <p className="muted">{SCHOOL.subject}, раздел «Комбинаторика и вероятность». В V0 — 20–40 навыков, здесь показаны 6.</p>
          <div className="graph">
            {skills.map((s) => (
              <div key={s.id} className="node"><b>{s.name}</b>{s.req.length ? <small>требует: {s.req.map((r) => skillById[r].name).join(", ")}</small> : <small>базовый навык</small>}</div>
            ))}
          </div>
        </>
      )}
      {tab === "tasks" && (
        <>
          <p className="muted">В V0 — 150–300 проверенных заданий. У каждого: навык, сложность, правильный ответ, назначение.</p>
          <table className="tbl">
            <thead><tr><th>ID</th><th>Навык</th><th>Сложн.</th><th>Назначение</th><th>Условие</th></tr></thead>
            <tbody>{taskBank.map((t) => <tr key={t.id}><td>{t.id}</td><td>{skillById[t.skill].name}</td><td>{t.level}</td><td>{purpose[t.purpose]}</td><td>{t.q}</td></tr>)}</tbody>
          </table>
        </>
      )}
      {tab === "import" && (
        <>
          <p className="muted">Файл «ПКС_вероятность_14.10.xlsx». Система проверяет ответы, привязывает задания к навыкам и создаёт события.</p>
          <table className="tbl mono">
            <tbody>{importPreview.map((r, i) => <tr key={i}>{r.map((c, j) => i === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
          <div className="sys"><b>Результат</b>40 ответов · 38 распознано · 2 на ручной разбор · создано 40 Learning Events</div>
        </>
      )}
    </div>
  );
}

/* ---------- Оболочка ---------- */
export default function Demo() {
  const [role, setRole] = useState("scenario");
  const [step, setStep] = useState(1);
  useEffect(() => {
    document.title = "DaraLearn · Демо";
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m);
    return () => m.remove();
  }, []);
  return (
    <div className="demo">
      <header className="demo-top">
        <a href="/" className="logo">Dara<span>Learn</span></a>
        <span className="demo-pill">Демо · {SCHOOL.name} · {SCHOOL.subject}</span>
        <div className="demo-step">
          <small>Шаг сценария</small>
          <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
            {scenario.map((s, i) => <option key={s.key} value={i}>{i}. {s.title}</option>)}
          </select>
        </div>
      </header>
      <div className="demo-body">
        <nav className="demo-nav" aria-label="Кабинеты">
          {ROLES.map(([k, t, d]) => (
            <button key={k} className={role === k ? "on" : ""} onClick={() => setRole(k)}><b>{t}</b><small>{d}</small></button>
          ))}
          <p className="demo-note">Данные вымышленные. Кабинеты показывают, как выглядит работа системы на одном классе.</p>
        </nav>
        <main className="demo-main">
          {role === "scenario" && <Scenario step={step} setStep={setStep} />}
          {role === "student" && <StudentView step={step} />}
          {role === "teacher" && <TeacherView step={step} />}
          {role === "curator" && <CuratorView />}
          {role === "admin" && <AdminView />}
        </main>
      </div>
    </div>
  );
}
