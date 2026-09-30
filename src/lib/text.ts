/**
 * Letter-game normalisation policy (docs/04): trim surrounding whitespace, upper-case,
 * A–Z only. Internal punctuation is NOT silently removed; callers reject it with a reason.
 */
export function normaliseWord(raw: string): { word: string; problem: null | "empty" | "non-letters" } {
  const word = raw.trim().normalize("NFC").toUpperCase();
  if (!word) return { word, problem: "empty" };
  if (!/^[A-Z]+$/.test(word)) return { word, problem: "non-letters" };
  return { word, problem: null };
}

export function letterCounts(word: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of word) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

/** True when `word` can be spelt from `pool` using each pool letter at most once. */
export function fitsMultiset(word: string, pool: readonly string[] | string): boolean {
  const counts = letterCounts(Array.isArray(pool) ? pool.join("") : (pool as string));
  for (const ch of word) {
    const n = counts.get(ch) ?? 0;
    if (n <= 0) return false;
    counts.set(ch, n - 1);
  }
  return true;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
