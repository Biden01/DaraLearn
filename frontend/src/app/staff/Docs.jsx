import { Fragment } from "react";
import { Crumb, useApp } from "../ui.jsx";
// Документы из docs/ попадают в сборку как текст: правка .md в git → автодеплой → страница обновлена.
import PLAN from "../../../../docs/PLAN.md?raw";
import COMPETITORS from "../../../../docs/COMPETITORS.md?raw";
import ARCHITECTURE from "../../../../docs/ARCHITECTURE.md?raw";

const DOCS = { plan: PLAN, competitors: COMPETITORS, architecture: ARCHITECTURE };
const FILES = { "PLAN.md": "plan", "COMPETITORS.md": "competitors", "ARCHITECTURE.md": "architecture" };

// План продукта, конкуренты и архитектура для команды (только админ).
export default function Docs() {
  const { t, route, go } = useApp();
  const d = t.docs;
  const tab = DOCS[route.param] ? route.param : "plan";
  return (
    <>
      <Crumb items={[[d.title]]} />
      <div className="row between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div className="tabs">
          {Object.keys(DOCS).map((k) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => go(`#/docs/${k}`)}>{d.tabs[k]}</button>
          ))}
        </div>
        <span className="muted small">{d.source}</span>
      </div>
      <article className="card md">
        <Markdown text={DOCS[tab]} />
      </article>
    </>
  );
}

// ---- Минимальный Markdown: заголовки, абзацы, списки и чекбоксы, таблицы, код, цитаты, жирный, ссылки ----

export function Markdown({ text }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isList = (l) => /^\s*([-*]|\d+\.)\s+/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```")) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      i++;
      out.push(<pre key={out.length}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const Tag = `h${Math.min(h[1].length + 1, 5)}`;
      out.push(<Tag key={out.length}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (isTableRow(line) && isTableRow(lines[i + 1] || "") && /^[\s|:-]+$/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && isTableRow(lines[i]); i++) rows.push(cells(lines[i]));
      out.push(
        <div className="md-table" key={out.length}>
          <table>
            <thead><tr>{head.map((c, k) => <th key={k}>{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, n) => <tr key={n}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (isList(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      for (; i < lines.length && (isList(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length)); i++) {
        if (isList(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        else items[items.length - 1] += " " + lines[i].trim(); // перенос строки внутри пункта
      }
      const List = ordered ? "ol" : "ul";
      out.push(
        <List key={out.length}>
          {items.map((it, k) => {
            const cb = it.match(/^\[( |x)\]\s+(.*)$/i);
            return cb
              ? <li key={k} className="md-task"><span className={`md-check ${cb[1] !== " " ? "on" : ""}`}>{cb[1] !== " " ? "✓" : ""}</span>{inline(cb[2])}</li>
              : <li key={k}>{inline(it)}</li>;
          })}
        </List>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      const q = [];
      for (; i < lines.length && lines[i].startsWith(">"); i++) q.push(lines[i].replace(/^>\s?/, ""));
      out.push(<blockquote key={out.length}>{inline(q.join(" "))}</blockquote>);
      continue;
    }
    const p = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>)/.test(lines[i]) && !isList(lines[i]) && !isTableRow(lines[i]); i++) {
      p.push(lines[i]);
    }
    out.push(<p key={out.length}>{p.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l)}</Fragment>)}</p>);
  }
  return out;
}

// **жирный**, `код`, [текст](ссылка), голые https-ссылки
function inline(s) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)|]+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const k = parts.length;
    if (m[1] != null) parts.push(<b key={k}>{inline(m[1])}</b>);
    else if (m[2] != null) parts.push(<code key={k}>{m[2]}</code>);
    else if (m[3] != null) parts.push(link(m[3], m[4], k));
    else parts.push(link(m[5], m[5], k, false)); // голая ссылка: текст не разбираем повторно
    last = re.lastIndex;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

function link(label, href, key, parse = true) {
  const text = parse ? inline(label) : label;
  const doc = FILES[href.split("#")[0]];
  if (doc) return <a key={key} href={`#/docs/${doc}`}>{text}</a>;
  if (/^https?:\/\//.test(href)) return <a key={key} href={href} target="_blank" rel="noreferrer">{text}</a>;
  return <code key={key}>{label}</code>; // ссылка на файл репозитория — на сайте её нет
}
