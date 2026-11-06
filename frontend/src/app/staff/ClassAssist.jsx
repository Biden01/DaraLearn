import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Crumb, Loading, useApp } from "../ui.jsx";
import { Markdown } from "./Docs.jsx";

const optText = (o, L) => (typeof o === "string" ? o : L(o));
const LETTERS = ["A", "B", "C", "D", "E", "F"];

// Помощник учителя по пробелу класса: план объяснения (ИИ), квиз на 5 минут и exit ticket из банка, печать.
export default function ClassAssist() {
  const { t, L, lang, route, user, toast } = useApp();
  const v = t.assist;
  const id = route.param;
  const lesson = route.query.get("lesson") || "";
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("plan");
  const [plan, setPlan] = useState({ text: "", busy: false });
  const [answers, setAnswers] = useState(false);

  useEffect(() => {
    api(`/state/classes/${id}/assist?lesson=${encodeURIComponent(lesson)}`).then(setD).catch(() => setD(false));
  }, [id, lesson]);

  async function makePlan() {
    setPlan({ text: "", busy: true });
    try {
      const r = await api(`/state/classes/${id}/assist/plan`, { method: "POST", body: { lesson, lang } });
      setPlan({ text: r.text, busy: false });
    } catch (ex) {
      setPlan({ text: "", busy: false });
      toast(v.errors[ex.code] || t.error);
    }
  }

  if (d === null) return <Loading />;
  if (d === false) return <p className="muted">{t.error}</p>;
  const tasks = tab === "quiz" ? d.quiz : d.exit;
  return (
    <>
      <div className="no-print">
        <Crumb items={[[t.classes.title, "#/" + (user.role === "teacher" ? "" : "classes")], [d.class.name, `#/class/${id}`], [v.title]]} />
      </div>
      <h1>{v.title}: {L(d.lesson.title)}</h1>
      <p className="subtitle">
        {v.gap(d.gap.length, d.students)}{d.gap.length > 0 && ` — ${d.gap.join(", ")}`}
        {Object.keys(d.errors).length > 0 && <><br />{t.errLine}: {Object.entries(d.errors).map(([k, n]) => `${t.errKinds[k] || k} ×${n}`).join(", ")}</>}
      </p>
      <div className="row between wrap no-print" style={{ gap: 10, marginBottom: 14 }}>
        <div className="tabs">
          {["plan", "quiz", "exit"].map((k) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{v.tabs[k]}</button>)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {tab !== "plan" && (
            <label className="small row" style={{ gap: 6 }}><input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />{v.showAnswers}</label>
          )}
          <button className="btn sm ghost" onClick={() => window.print()}>{v.print}</button>
        </div>
      </div>

      {tab === "plan" ? (
        <div className="card">
          {!plan.text && (
            <div className="no-print">
              <p className="muted small" style={{ marginTop: 0 }}>{v.planHelp}</p>
              <button className="btn" onClick={makePlan} disabled={plan.busy}>{plan.busy ? v.making : v.make}</button>
            </div>
          )}
          {plan.text && (
            <>
              <div className="md"><Markdown text={plan.text} /></div>
              <p className="muted small no-print" style={{ marginBottom: 0 }}>{v.aiNote}{" "}
                <button className="link" onClick={makePlan} disabled={plan.busy}>{v.again}</button></p>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="muted small no-print" style={{ marginTop: 0 }}>{tab === "quiz" ? v.quizHelp : v.exitHelp}</p>
          {tasks.length === 0 && <p className="muted">{v.noTasks}</p>}
          <ol className="assist-tasks">
            {tasks.map((x) => (
              <li key={x.id}>
                <div className="t-strong" style={{ marginBottom: 6 }}>{L(x.question)}</div>
                <div className="row wrap" style={{ gap: "6px 18px" }}>
                  {x.options.map((o, i) => (
                    <span key={i} className={answers && i === x.answer ? "assist-right" : ""}>{LETTERS[i]}) {optText(o, L)}</span>
                  ))}
                </div>
                {answers && L(x.explanation) && <div className="muted small" style={{ marginTop: 4 }}>{L(x.explanation)}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
