// Короткий опрос удобства (ученик, учитель): приглашение-карточка и форма с оценками 1–5.
import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Box, Icon, useApp } from "./ui.jsx";

const LATER_DAYS = 3;
const laterKey = (survey) => `dl_survey_later_${survey}`;

function postponed(survey) {
  try { return Date.now() - Number(localStorage.getItem(laterKey(survey)) || 0) < LATER_DAYS * 864e5; } catch { return false; }
}

// always=false — только приглашение, пока нет ответа (главная); always=true — всегда, с возможностью изменить ответ.
export default function SurveyCard({ always = false, quiet = false }) {
  const { t, user, toast } = useApp();
  const s = t.survey;
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState({});
  const [comment, setComment] = useState("");
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/analytics/survey").then((d) => { setData(d); setAnswers(d.answers); setComment(d.comment); }).catch(() => {});
  }, []);

  if (!data || hidden) return null;
  if (!always && (data.answered || postponed(data.survey))) return null;

  const later = () => {
    try { localStorage.setItem(laterKey(data.survey), String(Date.now())); } catch { /* */ }
    setHidden(true);
  };
  async function submit(e) {
    e.preventDefault();
    if (data.questions.some((q) => !answers[q])) return toast(s.needAll);
    setBusy(true);
    try {
      const d = await api("/analytics/survey", { method: "PUT", body: { answers, comment } });
      setData(d);
      setOpen(false);
      toast(s.thanks);
      if (!always) setHidden(true);
    } catch { toast(t.error); }
    setBusy(false);
  }

  // quiet — тихая строка на главной ученика: иконка, текст, текстовые кнопки
  if (!open && quiet) {
    return (
      <div className="quiet-row">
        <Box icon="star" c="purple" size={36} />
        <p className="grow"><b>{s.title}</b><span className="hide-sm"> · {data.answered ? s.answered : s.invite[user.role]}</span>
          <span className="show-sm"> · {s.short}</span></p>
        <button className="tlink" onClick={() => setOpen(true)}>{data.answered ? s.edit : s.go}</button>
        {!data.answered && !always && <button className="tlink gray hide-sm" onClick={later}>{s.later}</button>}
        {!data.answered && !always && <button className="later-x" aria-label={s.later} title={s.later} onClick={later}><Icon n="x" s={18} /></button>}
      </div>
    );
  }
  if (!open) {
    return (
      <div className="card row wrap" style={{ marginBottom: 20, gap: 16 }}>
        <Box icon="star" c="purple" />
        <div className="grow" style={{ minWidth: 220 }}><div className="card-title">{s.title}</div>
          <div className="muted small">{data.answered ? s.answered : s.invite[user.role]}</div></div>
        <button className="btn" onClick={() => setOpen(true)}>{data.answered ? s.edit : s.start}</button>
        {!data.answered && !always && <button className="btn ghost" onClick={later}>{s.later}</button>}
      </div>
    );
  }
  const qs = s.q[user.role] || {};
  return (
    <form className="card" style={{ marginBottom: 20 }} onSubmit={submit}>
      <p className="card-title">{s.title}</p>
      <p className="muted small" style={{ margin: "4px 0 16px" }}>{s.privacy}</p>
      <div className="stack" style={{ gap: 16 }}>
        {data.questions.map((q, i) => (
          <fieldset key={q} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{i + 1}. {qs[q] || q}</legend>
            <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
              <div className="row" style={{ gap: 8 }} role="radiogroup">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button type="button" key={v} role="radio" aria-checked={answers[q] === v} aria-label={`${v}`}
                    className={`chip ${answers[q] === v ? "on" : ""}`} style={{ width: 48 }}
                    onClick={() => setAnswers((a) => ({ ...a, [q]: v }))}>{v}</button>
                ))}
              </div>
              <div className="row between muted small" aria-hidden="true"><span>1 — {s.low}</span><span>5 — {s.high}</span></div>
            </div>
          </fieldset>
        ))}
        <label className="field">{s.comment}<textarea rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      </div>
      <div className="row wrap" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy}>{s.submit}</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{t.cancel}</button>
      </div>
    </form>
  );
}
