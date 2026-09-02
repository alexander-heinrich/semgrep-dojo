// Deterministic "daily pick": FNV-1a of the local date, biased to unsolved challenges.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** @param {Array<{id:string}>} challenges @param {Object} progress */
export function dailyPick(challenges, progress, date = new Date()) {
  if (!challenges.length) return null;
  const unsolved = challenges.filter((c) => !/^solved/.test((progress[c.id] || {}).status || ''));
  const pool = unsolved.length ? unsolved : challenges;
  return pool[fnv1a(todayKey(date)) % pool.length];
}
export function randomPick(challenges, progress) {
  const unsolved = challenges.filter((c) => !/^solved/.test((progress[c.id] || {}).status || ''));
  const pool = unsolved.length ? unsolved : challenges;
  return pool[Math.floor(Math.random() * pool.length)];
}
