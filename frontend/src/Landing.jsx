import { useState } from "react";

const how = [
  ["Видим, где трудно", "Платформа разбирает ответы ученика и показывает тему, из-за которой на самом деле возникают ошибки."],
  ["Помогаем вовремя", "Ученик получает понятное объяснение и задания под свой уровень, а учитель — подсказку, кому нужна его помощь."],
  ["Проверяем результат", "Через время даём новое задание без подсказок, чтобы убедиться, что тема действительно усвоена."],
];

const audience = [
  ["Школам", "Картина по классам и предметам: где отстают ученики и что уже помогло."],
  ["Учителям", "Меньше ручной проверки и готовый список: кому, что и когда объяснить."],
  ["Ученикам", "Личный план на день и помощник, который объясняет, а не решает за тебя."],
  ["Родителям", "Понятно, как идут дела у ребёнка — без ожидания следующей четверти."],
];

function LeadForm() {
  const [state, setState] = useState("idle");

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(res.status);
      setState("done");
      e.target.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="form-done">Спасибо! Мы скоро свяжемся с вами.</p>;
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <input name="name" placeholder="Имя" required maxLength={200} />
      <input name="email" type="email" placeholder="Email" required />
      <input name="school" placeholder="Школа или город" maxLength={300} />
      <select name="role" defaultValue="">
        <option value="" disabled>Кто вы?</option>
        <option value="school">Представитель школы</option>
        <option value="teacher">Учитель</option>
        <option value="parent">Родитель</option>
        <option value="other">Другое</option>
      </select>
      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Отправляем…" : "Хочу попробовать"}
      </button>
      {state === "error" && <p className="form-error">Не получилось отправить. Попробуйте ещё раз.</p>}
    </form>
  );
}

export default function Landing() {
  return (
    <>
      <header className="nav wrap">
        <span className="logo">Dara<span>Learn</span></span>
        <a href="#start" className="btn btn-small">Связаться</a>
      </header>

      <main>
        <section className="hero wrap">
          <h1>Каждый ученик понимает тему, а не просто сдаёт её</h1>
          <p className="lead">
            DaraLearn помогает школе вовремя заметить, где ученику трудно,
            дать нужную помощь и убедиться, что она сработала.
          </p>
          <a href="#start" className="btn">Подключить школу</a>
        </section>

        <section className="band">
          <div className="wrap">
            <h2>Как это работает</h2>
            <div className="how">
              {how.map(([t, d], i) => (
                <div key={t} className="how-item">
                  <span className="how-num">{i + 1}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap">
          <h2>Кому полезно</h2>
          <div className="audience">
            {audience.map(([t, d]) => (
              <div key={t} className="tile">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="start" className="wrap">
          <div className="cta">
            <div>
              <h2>Начните со своей школы</h2>
              <p>Оставьте контакты — расскажем, как подключиться, и ответим на вопросы.</p>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>

      <footer className="wrap footer">© {new Date().getFullYear()} DaraLearn · daralearn.kz</footer>
    </>
  );
}
