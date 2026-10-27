// Лента без перегрузки: личные рекомендации по навыку, на который есть групповая, сворачиваются в неё;
// низкий приоритет (подтвердить знания) — отдельным фильтром.
export function feedView(items) {
  const groupLessons = new Map();
  items.filter((x) => x.action === "group" && x.status !== "rejected").forEach((g) => groupLessons.set(`${g.class_id}:${g.lesson}`, g));
  const covered = new Map();
  const important = [];
  const low = [];
  for (const x of items) {
    if (x.action === "group") { important.push(x); continue; }
    const g = x.student && [...groupLessons.values()].find((y) => y.lesson === x.lesson && y.class_name === x.student.class);
    if (g && x.status === "new") { covered.set(g.id, (covered.get(g.id) || 0) + 1); continue; }
    (x.priority >= 2 || x.status !== "new" ? important : low).push(x);
  }
  return { important, low, covered };
}
