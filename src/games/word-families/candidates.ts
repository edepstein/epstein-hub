/**
 * Machine-checkable group rules for Word Families (used by the validator and offline authoring).
 * A rule says which tiles on a board can plausibly fit a category. The validator recomputes the candidates
 * of every rule-backed group over the whole board and counts the exact covers (partitions of all tiles into the
 * round's groups, four tiles each, every tile a candidate of its group). A well-formed wall has exactly one.
 */
export type GroupRule =
  /** The tile contains one of the words as a proper substring (e.g. SHINGLE hides SHIN). */
  | { kind: "hidden"; words: string[] }
  /** The tile is an anagram of one of the words (and is not that word). */
  | { kind: "anagram"; words: string[] }
  /** The tile plus one inserted letter (anywhere) spells one of the words. */
  | { kind: "plus-one"; words: string[] }
  /** The tile reversed spells one of the words (and is not a palindrome). */
  | { kind: "reversal"; words: string[] }
  /** The tile is one of the words (a closed list of category members). */
  | { kind: "members"; words: string[] }
  /** Judged by the author; the candidate tiles are listed explicitly. */
  | { kind: "authored"; candidates: string[] };

const squash = (s: string) => s.replace(/[^A-Z]/g, "");
const sortLetters = (s: string) => [...s].sort().join("");

export function ruleFits(rule: GroupRule, label: string): boolean {
  const t = squash(label);
  switch (rule.kind) {
    case "hidden":
      return rule.words.some((w) => t.length > w.length && t.includes(w));
    case "anagram":
      return rule.words.some((w) => w !== t && w.length === t.length && sortLetters(w) === sortLetters(t));
    case "plus-one":
      return rule.words.some((w) => {
        if (w.length !== t.length + 1) return false;
        for (let i = 0; i < w.length; i++) if (w.slice(0, i) + w.slice(i + 1) === t) return true;
        return false;
      });
    case "reversal": {
      const r = [...t].reverse().join("");
      return r !== t && rule.words.includes(r);
    }
    case "members":
      return rule.words.includes(t) || rule.words.includes(label);
    case "authored":
      return rule.candidates.includes(label);
  }
}

export function candidatesFor(rule: GroupRule, labels: string[]): string[] {
  return labels.filter((l) => ruleFits(rule, l));
}

/** Count exact covers of all tiles by the groups' candidate sets (each group takes four tiles). Stops at `limit`. */
export function countPartitions(sets: string[][], labels: string[], limit = 3): number {
  const idx = new Map(labels.map((l, i) => [l, i]));
  const cand = sets.map((s) => s.map((l) => idx.get(l)!).sort((a, b) => a - b));
  let count = 0;
  const covered: boolean[] = new Array(labels.length).fill(false);
  const used: boolean[] = new Array(sets.length).fill(false);
  const pick = (from: number[], need: number, start: number, done: () => void) => {
    if (need === 0) {
      done();
      return;
    }
    for (let k = start; k < from.length && count < limit; k++) {
      const t = from[k];
      if (covered[t]) continue;
      covered[t] = true;
      pick(from, need - 1, k + 1, done);
      covered[t] = false;
    }
  };
  const solve = () => {
    if (count >= limit) return;
    const first = covered.indexOf(false);
    if (first < 0) {
      count++;
      return;
    }
    for (let g = 0; g < sets.length; g++) {
      if (used[g] || !cand[g].includes(first)) continue;
      used[g] = true;
      covered[first] = true;
      pick(cand[g], 3, 0, solve);
      covered[first] = false;
      used[g] = false;
    }
  };
  solve();
  return count;
}
