import { Crumb, useApp } from "../ui.jsx";
import { Markdown } from "./Docs.jsx";
// Текст лежит в docs/: правка .md в git → автодеплой → страница обновлена.
import RU from "../../../../docs/HOW_IT_WORKS.md?raw";
import KK from "../../../../docs/HOW_IT_WORKS.kk.md?raw";

// Вступление до первого «## » и шаги: каждый «## Заголовок» — карточка с номером.
function parse(text) {
  const [intro, ...parts] = text.replace(/\r/g, "").split(/^## /m);
  return { intro: intro.trim(), steps: parts.map((p) => {
    const nl = p.indexOf("\n");
    return { title: p.slice(0, nl).trim(), body: p.slice(nl + 1).trim() };
  }) };
}

// «Как работает сайт»: что делает DaraLearn по порядку (только админ).
export default function HowItWorks() {
  const { t, lang } = useApp();
  const { intro, steps } = parse(lang === "kk" ? KK : RU);
  const title = t.snav.how;
  return (
    <div style={{ maxWidth: 820 }}>
      <Crumb items={[[title]]} />
      <h1>{title}</h1>
      <div className="md how-intro"><Markdown text={intro} /></div>
      <ol className="how-steps">
        {steps.map((s, i) => (
          <li key={i} className="card how-step">
            <span className="how-n" aria-hidden="true">{i + 1}</span>
            <div className="grow md">
              <h2>{s.title}</h2>
              <Markdown text={s.body} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
