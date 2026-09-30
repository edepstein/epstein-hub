import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
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
  const perDifficulty: Record<string, number> = {};
  const pairs = new Set<string>();
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    const L = p.start.length;
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
    const dist = distancesFrom(p.target, (w) => membership.has(w)).get(p.start);
    if (dist == null) problems.push(`${meta.id}: endpoints are disconnected in membership`);
    else {
      if (dist !== p.optimalMoves) problems.push(`${at("optimalMoves")}: stored ${p.optimalMoves}, BFS over membership gives ${dist}`);
      if (p.examplePath.length - 1 !== dist) problems.push(`${at("examplePath")}: ${p.examplePath.length - 1} moves, optimum ${dist}`);
    }
    if (meta.status !== "demo") {
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
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 4) problems.push(`fewer than 4 ${d} rounds`);
  const expected = [...familiar].filter((w) => w.length >= 3 && w.length <= 5 && membership.has(w)).sort();
  if (expected.length !== familiarList.length || expected.some((w, i) => w !== familiarList[i])) problems.push("content/familiar.json is out of date with the size-35 layer");
  return problems;
}
