import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
import { distancesFrom, hamming, isLadder } from "./graph";
import familiarList from "./content/familiar.json";

/**
 * Word Ladder content checks: equal-length distinct endpoints, membership of endpoints, example
 * route and bank; every edge a single substitution; BFS minimum over the pinned membership equals
 * the stored optimum and the example route length; practice routes use only familiar words (so a
 * common-word shortest route exists); difficulty bands; demo fixtures' finite dictionaries
 * reproduce their stored optimum; the shipped familiar list matches the size-35 layer.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const respectable = new Set([...familiar, ...loadUncommonSync()]);
  const perDifficulty: Record<string, number> = {};
  const pairs = new Set<string>();
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    const L = p.start.length;
    if (p.parLexicon !== undefined && p.parLexicon !== "everyday" && p.parLexicon !== "full") problems.push(`${at("parLexicon")}: must be "everyday" or "full"`);
    if (!/^[A-Z]+$/.test(p.start) || !/^[A-Z]+$/.test(p.target)) problems.push(`${at("start/target")}: upper-case A-Z only`);
    if (p.target.length !== L) problems.push(`${at("target")}: length differs from start`);
    if (p.start === p.target) problems.push(`${at("target")}: endpoints must differ`);
    const key = [p.start, p.target].sort().join("-");
    if (pairs.has(key)) problems.push(`${meta.id}: duplicate endpoint pair`);
    pairs.add(key);
    for (const w of [p.start, p.target, ...p.examplePath, ...(p.bank ?? [])]) if (!membership.has(w)) problems.push(`${at("words")}: ${w} not in membership`);
    if (p.examplePath[0] !== p.start || p.examplePath[p.examplePath.length - 1] !== p.target) problems.push(`${at("examplePath")}: must run from start to target`);
    if (!isLadder(p.examplePath)) problems.push(`${at("examplePath")}: every edge must change exactly one letter`);
    if (new Set(p.examplePath).size !== p.examplePath.length) problems.push(`${at("examplePath")}: repeats a word`);
    const ends = new Set([p.start, p.target]);
    const full = p.parLexicon === "full";
    if (full && meta.difficulty !== "master") problems.push(`${meta.id}: parLexicon "full" is for Master rounds only`);
    if (meta.difficulty === "master" && !full) problems.push(`${meta.id}: Master rounds must set parLexicon "full"`);
    const dist = full
      ? distancesFrom(p.target, (w) => membership.has(w), p.start).get(p.start)
      : distancesFrom(p.target, (w) => ends.has(w) || (membership.has(w) && familiar.has(w))).get(p.start);
    if (dist == null) problems.push(`${meta.id}: endpoints are not connected by ${full ? "any words" : "everyday words"}`);
    else {
      if (dist !== p.optimalMoves) problems.push(`${at("optimalMoves")}: stored ${p.optimalMoves}, BFS over ${full ? "the full word list" : "everyday words"} (par) gives ${dist}`);
      if (p.examplePath.length - 1 !== dist) problems.push(`${at("examplePath")}: ${p.examplePath.length - 1} moves, optimum ${dist}`);
    }
    if (full) {
      // Master: par over the whole list; the example route stays respectable (familiar + uncommon layers),
      // endpoints are everyday words, and everyday words alone cannot match par (real vocabulary is needed).
      if (L < 4 || L > 6) problems.push(`${meta.id}: Master ladders use 4-6 letters`);
      if (p.optimalMoves < 5 || p.optimalMoves > 9) problems.push(`${meta.id}: Master ladders need par 5-9, found ${p.optimalMoves}`);
      for (const w of p.examplePath) if (!respectable.has(w) && w !== p.start && w !== p.target) problems.push(`${at("examplePath")}: ${w} is outside the familiar and uncommon layers`);
      for (const w of [p.start, p.target]) if (!familiar.has(w)) problems.push(`${at("start/target")}: ${w} is not an everyday word`);
      if (p.examplePath.every((w) => familiar.has(w))) problems.push(`${at("examplePath")}: Master example route should include uncommon words`);
      const everyday = distancesFrom(p.target, (w) => ends.has(w) || (membership.has(w) && familiar.has(w))).get(p.start);
      if (everyday != null && everyday < p.optimalMoves + 2) problems.push(`${meta.id}: an everyday-word route of ${everyday} is too close to par ${p.optimalMoves}; Master needs real vocabulary (at least 2 moves saved)`);
      const rs = distancesFrom(p.target, (w) => ends.has(w) || (membership.has(w) && respectable.has(w)), p.start).get(p.start);
      if (rs !== p.optimalMoves) problems.push(`${meta.id}: no par-length route exists over the familiar and uncommon layers (found ${rs})`);
      if (p.bank) problems.push(`${at("bank")}: Master ladders have no word bank`);
    } else if (meta.status !== "demo") {
      for (const w of p.examplePath) if (!familiar.has(w)) problems.push(`${at("examplePath")}: ${w} is not in the familiar (size-35) layer`);
      const h = hamming(p.start, p.target);
      if (meta.difficulty === "gentle" && (L < 3 || L > 4 || p.optimalMoves > 4)) problems.push(`${meta.id}: gentle ladders use 3-4 letters and at most 4 moves`);
      if (meta.difficulty === "gentle" && !(p.bank && p.bank.length)) problems.push(`${at("bank")}: gentle ladders offer a word bank`);
      if (meta.difficulty === "standard" && (L < 4 || L > 5 || p.optimalMoves < 4 || p.optimalMoves > 6)) problems.push(`${meta.id}: standard ladders use 4-5 letters and 4-6 moves`);
      if (meta.difficulty === "expert" && (p.optimalMoves < 6 || p.optimalMoves <= h)) problems.push(`${meta.id}: expert ladders need 6+ moves including a forced detour`);
    }
    if (p.bank) {
      const bank = new Set(p.bank);
      if (!p.examplePath.every((w) => bank.has(w))) problems.push(`${at("bank")}: must contain the example route`);
    }
    if (p.fixtureDictionary) {
      const dict = new Set(p.fixtureDictionary);
      const d = distancesFrom(p.target, (w) => dict.has(w)).get(p.start);
      if (d !== p.fixtureOptimalMoves) problems.push(`${at("fixtureOptimalMoves")}: stored ${p.fixtureOptimalMoves}, fixture BFS gives ${d}`);
    }
    const label = `${meta.id} ${meta.title ?? ""}`.toUpperCase();
    if (label.includes(p.target) || label.includes(p.start)) problems.push(`${meta.id}: id/title names an endpoint`);
  }
  for (const [d, n] of [["gentle", 16], ["standard", 16], ["expert", 22], ["master", 12]] as const) if ((perDifficulty[d] ?? 0) < n) problems.push(`fewer than ${n} ${d} rounds`);
  const expected = [...familiar].filter((w) => w.length >= 3 && w.length <= 5 && membership.has(w)).sort();
  if (expected.length !== familiarList.length || expected.some((w, i) => w !== familiarList[i])) problems.push("content/familiar.json is out of date with the size-35 layer");
  return problems;
}
