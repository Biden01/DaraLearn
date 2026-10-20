import { useState } from "react";
import { roleOptions } from "../content.js";

export default function LeadForm() {
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
      if (res.status === 429) throw new Error("Слишком много заявок с вашего адреса. Попробуйте через несколько минут.");
      if (!res.ok) throw new Error("Не получилось отправить. Попробуйте ещё раз.");
      setState("done");
      e.target.reset();
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="form-done" role="status">
        <strong>Спасибо! Заявка получена.</strong>
        <p>Ответим на email в ближайшие рабочие дни и предложим время для короткого звонка.</p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit} aria-label="Заявка на пилот">
      <div className="lead-row">
        <input name="name" placeholder="Имя" required maxLength={200} autoComplete="name" />
        <input name="email" type="email" placeholder="Email" required autoComplete="email" />
      </div>
      <div className="lead-row">
        <input name="phone" type="tel" placeholder="Телефон (необязательно)" maxLength={50} autoComplete="tel" />
        <select name="role" defaultValue="" required aria-label="Кто вы">
          <option value="" disabled>Кто вы?</option>
          {roleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <input name="school" placeholder="Школа или город" maxLength={300} autoComplete="organization" />
      <textarea name="message" placeholder="Коротко о задаче: предмет, классы, что хотите проверить (необязательно)" rows={3} maxLength={2000} />
      <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Отправляем…" : "Оставить заявку на пилот"}
      </button>
      <p className="form-note">Нажимая кнопку, вы соглашаетесь, что мы свяжемся с вами по указанным контактам.</p>
      {state === "error" && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
