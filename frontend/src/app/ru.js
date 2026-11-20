// Русские окончания после чисел: 1 урок, 2 урока, 5 уроков (11–14 — всегда «многие»).
export const pl = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 15 ? many : b === 1 ? one : b > 1 && b < 5 ? few : many;
};
// после «из N» и «у N»: из 1 задания, из 5 заданий
export const gen = (n, one, many) => (Math.abs(n) % 10 === 1 && Math.abs(n) % 100 !== 11 ? one : many);
