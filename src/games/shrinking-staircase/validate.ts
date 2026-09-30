import type { RoundMeta } from "@/lib/engine/types";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { rounds } from "./rounds";
import { extraLetters, removedLetter, type StairPayload } from "./engine";

/**
 * Semantic checks for one staircase round (exact multiset solver, docs/04):
 * every accepted chain starts at the supplied word, has one answer per rung, and each
 * edge removes exactly one letter occurrence without adding or substituting any letter.
 * Every word is in gameplay membership; practice answers must also be familiar (size-35).
 * Branches are complete chains, so every accepted choice has a verified continuation.
 */
export function checkStaircaseRound(
  meta: Pick<RoundMeta, "id" | "status" | "title">,
  p: StairPayload,
  membership: ReadonlySet<string>,
  familiar: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  const at = (f: string) => `${meta.id}.${f}`;
  if (!/^[A-Z]+$/.test(p.start)) problems.push(`${at("start")}: must be upper-case A-Z`);
  if (!p.rungs.length) problems.push(`${at("rungs")}: no rungs`);
  p.rungs.forEach((r, i) => {
    if (r.length !== p.start.length - 1 - i) problems.push(`${at(`rungs[${i}].length`)}: expected ${p.start.length - 1 - i}, found ${r.length}`);
    if (!r.clue || r.clue.trim().length < 3) problems.push(`${at(`rungs[${i}].clue`)}: missing clue`);
    if (/—/.test(r.clue)) problems.push(`${at(`rungs[${i}].clue`)}: contains an em dash`);
  });
  if (p.rungs.length && p.rungs[p.rungs.length - 1].length !== 2) problems.push(`${at("rungs")}: the final rung must be a two-letter word`);
  if (!p.acceptedChains.length) problems.push(`${at("acceptedChains")}: no accepted chain`);
  const seen = new Set<string>();
  p.acceptedChains.forEach((chain, c) => {
    const where = at(`acceptedChains[${c}]`);
    const sig = chain.join(">");
    if (seen.has(sig)) problems.push(`${where}: duplicate chain`);
    seen.add(sig);
    if (chain[0] !== p.start) problems.push(`${where}: does not begin with ${p.start}`);
    if (chain.length !== p.rungs.length + 1) {
      problems.push(`${where}: has ${chain.length - 1} answers for ${p.rungs.length} rungs (an accepted branch without a complete continuation)`);
      return;
    }
    if (new Set(chain).size !== chain.length) problems.push(`${where}: repeats a word`);
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const next = chain[i];
      if (next.length !== prev.length - 1) problems.push(`${where}[${i}]: ${next} is not one letter shorter than ${prev}`);
      const extra = extraLetters(next, prev);
      if (extra.length) problems.push(`${where}[${i}]: ${next} introduces ${extra.join(", ")} not available in ${prev}`);
      else if (!removedLetter(prev, next)) problems.push(`${where}[${i}]: ${prev} to ${next} does not remove exactly one letter`);
    }
    for (const w of chain) {
      if (!membership.has(w)) problems.push(`${where}: ${w} is not in gameplay membership`);
      if (meta.status !== "demo" && !familiar.has(w)) problems.push(`${where}: ${w} is not in the familiar (size-35) layer`);
    }
  });
  const title = (meta.title ?? "").toUpperCase();
  const words = new Set(p.acceptedChains.flat().slice(0));
  for (const w of words) {
    if (w.length >= 3 && (new RegExp(`\\b${w}\\b`).test(title) || meta.id.toUpperCase().includes(w))) problems.push(`${meta.id}: id or title may spoil ${w}`);
  }
  return problems;
}

export function validateContent(): string[] {
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const problems: string[] = [];
  const perDifficulty: Record<string, number> = {};
  const ids = new Set<string>();
  for (const { meta, payload } of rounds) {
    if (ids.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    ids.add(meta.id);
    if (meta.status === "practice") perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (meta.status === "demo" && !meta.sourceFixtureId) problems.push(`${meta.id}: demo round without sourceFixtureId`);
    problems.push(...checkStaircaseRound(meta, payload, membership, familiar));
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 4) problems.push(`fewer than 4 practice rounds at ${d}`);
  const expertBranches = rounds.filter((r) => r.meta.difficulty === "expert" && r.payload.acceptedChains.length > 1).length;
  if (expertBranches < 2) problems.push("expert rounds should include at least two with accepted branches");
  return problems;
}
