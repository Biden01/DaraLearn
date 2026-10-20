import {
  nav, questions, cycle, compare, rules, tutor, roles, scope, timeline, metrics, faq,
} from "./content.js";
import LeadForm from "./sections/LeadForm.jsx";

function Section({ id, eyebrow, title, lead, children, className = "" }) {
  return (
    <section id={id} className={className}>
      <div className="wrap">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {lead && <p className="section-lead">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <>
      <header className="nav wrap">
        <a href="#top" className="logo" aria-label="DaraLearn">Dara<span>Learn</span></a>
        <nav className="nav-links" aria-label="Разделы">
          {nav.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          <a href="/demo">Демо</a>
        </nav>
        <a href="#start" className="btn btn-small">Оставить заявку</a>
      </header>

      <main id="top">
        <section className="hero wrap">
          <span className="badge">Пилот V0 · одна школа, один предмет</span>
          <h1>Каждый ученик понимает тему, а не просто сдаёт её</h1>
          <p className="lead">
            DaraLearn помогает школе вовремя заметить, где ученику трудно,
            дать нужную помощь и убедиться, что она сработала.
          </p>
          <div className="hero-actions">
            <a href="#start" className="btn">Подключить школу</a>
            <a href="/demo" className="btn btn-ghost">Открыть демо</a>
          </div>
          <ul className="hero-facts" aria-label="Три шага">
            <li><b>Понять</b> выявить учебные пробелы</li>
            <li><b>Помочь</b> выбрать подходящее действие</li>
            <li><b>Проверить</b> измерить результат помощи</li>
          </ul>
        </section>

        <Section id="problem" eyebrow="Проблема" title="Оценка не объясняет причину ошибки"
          lead="Учителю ещё предстоит определить проблему и выбрать помощь. На это у него обычно нет времени.">
          <div className="problem">
            <div className="problem-card">
              <span className="big">40%</span>
              <span>по вероятности у ученика. Что это значит и что делать дальше?</span>
              <small>Иллюстративный пример.</small>
            </div>
            <div>
              <h3>Что нужно выяснить</h3>
              <ul className="checklist">
                {questions.map((q) => <li key={q}>{q}</li>)}
              </ul>
            </div>
          </div>
        </Section>

        <Section id="how" className="band" eyebrow="Как это работает" title="Один ученик проходит полный цикл"
          lead="Результат проверки влияет на следующее решение системы. Новые события запускают следующий цикл.">
          <div className="how">
            {cycle.map(([t, d], i) => (
              <div key={t} className="how-item">
                <span className="how-num">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="compare" eyebrow="Чем отличаемся" title="Связываем диагностику, действия и проверку прогресса"
          lead="Контент-платформы дают материалы, репетиторы объясняют. DaraLearn замыкает цикл: от данных до подтверждённого результата.">
          <div className="compare">
            {compare.map(([t, items, accent]) => (
              <div key={t} className={"tile" + (accent ? " tile-accent" : "")}>
                <h3>{t}</h3>
                <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="note">Преимущество — гипотеза. Проверяем сравнением продуктов и пилотом.</p>
        </Section>

        <Section id="rules" eyebrow="Решения" title="Решения принимаются по понятным правилам"
          lead="Система связывает ситуацию с конкретным следующим действием. Учитель может принять, изменить или отклонить любую рекомендацию.">
          <div className="rules" role="table" aria-label="Правила решений">
            <div className="rules-head" role="row"><span>Ситуация</span><span>Следующее действие</span></div>
            {rules.map(([s, a]) => (
              <div key={s} className="rules-row" role="row">
                <span role="cell"><small>Ситуация</small>{s}</span>
                <span role="cell"><small>Действие</small>{a}</span>
              </div>
            ))}
          </div>
          <p className="note">Пороги срабатывания согласуем со школой до пилота.</p>
        </Section>

        <Section id="tutor" className="sand" eyebrow="AI-репетитор" title="Ведёт к самостоятельному решению, а не решает за ученика"
          lead="Занятие адаптируется к ответам ученика и заканчивается проверкой без подсказок.">
          <div className="tutor">
            {tutor.map(([t, steps], gi) => (
              <div key={t} className={"tile" + (gi === 2 ? " tile-accent" : "")}>
                <h3>{t}</h3>
                <ol start={gi * 3 + 1}>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
              </div>
            ))}
          </div>
          <div className="proof">
            <div><span className="big">Практика</span><span>с подсказками и объяснениями</span></div>
            <div className="proof-sep" aria-hidden="true">≠</div>
            <div><span className="big">Проверка</span><span>новое задание без подсказок, спустя время</span></div>
          </div>
          <p className="note">Результат практики и независимой проверки учитываются отдельно. Если данных мало, система так и говорит: «недостаточно данных».</p>
        </Section>

        <Section id="who" eyebrow="Кому полезно" title="Каждый видит то, что нужно для его следующего действия">
          <div className="audience">
            {roles.map(([t, d]) => (
              <div key={t} className="tile">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="scope" className="band" eyebrow="Первая версия" title="V0 ограничивает масштаб, сохраняя полный цикл"
          lead="Первую версию проверяем на одном предмете и в одной школе. Расширяем после проверки гипотез.">
          <div className="scope" role="table" aria-label="Объём первой версии">
            <div className="rules-head" role="row"><span>В первой версии</span><span>После пилота</span></div>
            {scope.map(([a, b]) => (
              <div key={a} className="rules-row" role="row">
                <span role="cell"><small>В V0</small>{a}</span>
                <span role="cell"><small>Дальше</small>{b}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="pilot" eyebrow="Пилот" title="Разработка предшествует восьминедельному пилоту"
          lead="Пилот запускаем после проверки полного учебного сценария на реальных материалах школы.">
          <div className="timeline">
            {timeline.map(([when, t, d], i) => (
              <div key={t} className={"tile" + (i === 2 ? " tile-accent" : "")}>
                <span className="when">{when}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="metrics">
            <h3>Что измеряем</h3>
            <ul>{metrics.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
          <p className="note">Сроки предварительные. Метрики и критерии успеха согласуем до старта.</p>
        </Section>

        <Section id="faq" className="sand" eyebrow="Вопросы" title="Частые вопросы">
          <div className="faq">
            {faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </Section>

        <section id="start" className="wrap">
          <div className="cta">
            <div>
              <h2>Начните со своей школы</h2>
              <p>Оставьте контакты. Расскажем, как проходит пилот, что нужно от школы, и ответим на вопросы.</p>
              <ul className="cta-list">
                <li>Короткий звонок: 20–30 минут</li>
                <li><a href="/demo">Интерактивное демо</a> уже доступно без регистрации</li>
                <li>Демо на одном ученике и одном навыке</li>
                <li>Предложение по объёму и срокам пилота</li>
              </ul>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>

      <footer className="wrap footer">
        <span>© {new Date().getFullYear()} DaraLearn · daralearn.kz</span>
        <span>Платформа для школ: найти учебный пробел, помочь и проверить результат.</span>
      </footer>
    </>
  );
}
