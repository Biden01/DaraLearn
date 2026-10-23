// Куда ведёт рекомендация Decision Engine.
export function actionHref(r) {
  switch (r.action) {
    case "diagnostic": return "#/diagnostics";
    case "prereq": return `#/lesson/${r.target}`;
    case "lesson": case "practice": return `#/lesson/${r.lesson}`;
    case "tutor": return `#/tutor?lesson=${r.lesson}`;
    case "verify": return `#/quiz?lesson=${r.lesson}`;
    case "teacher": return "#/help";
    default: return "#/";
  }
}
