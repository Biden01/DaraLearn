import { useState } from "react";

export default function PilotForm({ t }) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    setError("");
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 429) throw new Error(t.err429);
      if (!res.ok) throw new Error(t.err);
      setState("done");
      e.target.reset();
    } catch (err) {
      setError(err.message || t.err);
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="form-done" role="status">
        <p className="form-done-t">{t.done}</p>
        <p>{t.doneText}</p>
      </div>
    );
  }

  return (
    <form className="pilot-form" onSubmit={submit}>
      <div className="form-row">
        <label>{t.name}<input name="name" required maxLength={200} autoComplete="name" /></label>
        <label>{t.email}<input name="email" type="email" required autoComplete="email" /></label>
      </div>
      <div className="form-row">
        <label>{t.phone}<input name="phone" type="tel" maxLength={50} autoComplete="tel" /></label>
        <label>{t.role}
          <select name="role" defaultValue="" required>
            <option value="" disabled>—</option>
            {t.roles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <label>{t.school}<input name="school" maxLength={300} autoComplete="organization" /></label>
      <label>{t.message}<textarea name="message" rows={3} maxLength={2000} /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? t.sending : t.send}
      </button>
      <p className="form-note">{t.consent}</p>
      {state === "error" && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
