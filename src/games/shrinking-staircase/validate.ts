import type { RoundMeta } from "@/lib/engine/types";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";
import { rounds } from "./rounds";
import { describeStep, extraLetters, removedLetter, type StairPayload } from "./engine";

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
  uncommon: ReadonlySet<string> = new Set(),
  difficulty: string = "standard",
): string[] {
  const master = difficulty === "master";
  const problems: string[] = [];
  const at = (f: string) => `${meta.id}.${f}`;
  if (!/^[A-Z]+$/.test(p.start)) problems.push(`${at("start")}: must be upper-case A-Z`);
  if (!p.rungs.length) problems.push(`${at("rungs")}: no rungs`);
  p.rungs.forEach((r, i) => {
    if (r.length !== p.start.length - 1 - i) problems.push(`${at(`rungs[${i}].length`)}: expected ${p.start.length - 1 - i}, found ${r.length}`);
    if (!r.clue || r.clue.trim().length < 3) problems.push(`${at(`rungs[${i}].clue`)}: missing clue`);
    if (/—/.test(r.clue)) problems.push(`${at(`rungs[${i}].clue`)}: contains an em dash`);
  });
  const last = p.rungs.length ? p.rungs[p.rungs.length - 1].length : 0;
  if (!master && p.rungs.length && last !== 2) problems.push(`${at("rungs")}: the final rung must be a two-letter word`);
  if (master) {
    if (p.start.length < 8 || p.start.length > 10) problems.push(`${at("start")}: Master starts must have 8 to 10 letters`);
    if (last < 3 || last > 4) problems.push(`${at("rungs")}: a Master staircase must end on a three- or four-letter word`);
    if (p.rungs.length < 5) problems.push(`${at("rungs")}: Master staircases need at least five rungs`);
    if (p.lettersAid) problems.push(`${at("lettersAid")}: Master rounds do not show letter tiles`);
  }
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
      if (meta.status !== "demo" && !master && !familiar.has(w)) problems.push(`${where}: ${w} is not in the familiar (size-35) layer`);
      if (master && !familiar.has(w) && !uncommon.has(w) && (c === 0 || chain.indexOf(w) === p.acceptedChains[0].indexOf(w))) problems.push(`${where}: ${w} is outside the familiar and uncommon layers (Master answers must be in one of them)`);
    }
    if (master) {
      for (let i = 1; i < chain.length; i++) {
        if (chain[i].length > 3 && !describeStep(chain[i - 1], chain[i]).rearranged) problems.push(`${where}[${i}]: ${chain[i - 1]} to ${chain[i]} keeps the letters in order, which is too easy for Master`);
      }
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
  const uncommon = loadUncommonSync();
  const problems: string[] = [];
  const perDifficulty: Record<string, number> = {};
  const ids = new Set<string>();
  const starts = new Set<string>();
  const answerOwner = new Map<string, string>();
  const clueTexts = new Set<string>();
  for (const { meta, payload } of rounds) {
    if (ids.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    ids.add(meta.id);
    if (meta.status === "practice" || meta.status === "demo") perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (starts.has(payload.start)) problems.push(`${meta.id}: duplicate start word ${payload.start}`);
    starts.add(payload.start);
    for (const w of new Set(payload.acceptedChains.flat().slice(0))) {
      if (w.length >= 3 && w !== payload.start && answerOwner.has(w) && !meta.id.startsWith("sc-demo")) problems.push(`${meta.id}: answer ${w} already used in ${answerOwner.get(w)}`);
      if (w.length >= 3 && !answerOwner.has(w)) answerOwner.set(w, meta.id);
    }
    for (const r of payload.rungs) {
      if (clueTexts.has(r.clue)) problems.push(`${meta.id}: duplicate clue text "${r.clue}"`);
      clueTexts.add(r.clue);
    }
    if (meta.status === "demo" && !meta.sourceFixtureId) problems.push(`${meta.id}: demo round without sourceFixtureId`);
    problems.push(...checkStaircaseRound(meta, payload, membership, familiar, uncommon, meta.difficulty));
  }
  const minimum: Record<string, number> = { gentle: 14, standard: 14, expert: 20, master: 14 };
  for (const d of Object.keys(minimum)) if ((perDifficulty[d] ?? 0) < minimum[d]) problems.push(`fewer than ${minimum[d]} rounds (practice plus demo) at ${d}`);
  const expertBranches = rounds.filter((r) => r.meta.difficulty === "expert" && r.payload.acceptedChains.length > 1).length;
  if (expertBranches < 2) problems.push("expert rounds should include at least two with accepted branches");
  return problems;
}
