// Казахские окончания после чисел: 3-тен, 6-сы, 10-нан. Зависят от последнего слова числа
// при чтении вслух (сингармонизм и озвончение), поэтому один суффикс на все числа не подходит.
const UNITS = ["", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз"];
const TENS = ["", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан"];

function lastWord(n) {
  n = Math.abs(Math.trunc(Number(n) || 0));
  if (n === 0) return "нөл";
  if (n % 10) return UNITS[n % 10];
  if (n % 100) return TENS[(n % 100) / 10];
  if (n % 1000) return "жүз";
  return n % 1e6 ? "мың" : "миллион";
}

const back = (w) => /[аоұыя][^әеөүіэаоұыя]*$/.test(w); // последний гласный — твёрдый
const endsVowel = (w) => /[аәеоөұүыіэяюи]$/.test(w);

// притяжательная форма: «10 сұрақтың 3-і», «20-сы»
export const poss = (n) => { const w = lastWord(n); return `${n}-${endsVowel(w) ? "с" : ""}${back(w) ? "ы" : "і"}`; };

// исходный падеж: «10-нан 3», «5-тен»
export const abl = (n) => {
  const w = lastWord(n);
  const c = /[аәеоөұүыіэяюиуйрлжз]$/.test(w) ? "д" : /[мнң]$/.test(w) ? "н" : "т";
  return `${n}-${c}${back(w) ? "ан" : "ен"}`;
};

// Даты по-казахски. Браузеры часто не знают названий месяцев для kk-KZ и пишут «M11», поэтому свои таблицы.
const MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
const WEEKDAYS = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сб"]; // getDay(): 0 — жексенбі

export const monthKk = (d) => MONTHS[d.getMonth()];

// opts — как у toLocaleDateString: { weekday: "short", day: "numeric", month: "short" | "long" }
export function dateKk(d, opts) {
  const parts = [];
  if (opts.day) parts.push(d.getDate());
  if (opts.month) parts.push(opts.month === "long" ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()].slice(0, 3)}.`);
  const s = parts.join(" ");
  return opts.weekday ? `${WEEKDAYS[d.getDay()]}, ${s}` : s;
}
