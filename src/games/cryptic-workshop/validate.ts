import { rounds as allRounds } from "./rounds";
import type { RoundBundle } from "../types";
import type { WorkshopPayload } from "./engine";
import { enumerationLengths, HELP_EXAMPLES, verifyClue } from "./construction";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "@/lib/dictionary/node";

/** Answers deliberately outside the ESDB common-word list (proper nouns), each logged for review. */
export const ALLOWED_NON_DICTIONARY_ANSWERS = new Set(["ROME"]);

/**
 * Cryptic Workshop content checks. Fails closed: every clue's construction is recomputed
 * (anagram multisets, hidden offsets, reversals, charades, containers, deletions, initials),
 * phrases must be whole words in the surface, the definition must sit at an end, indicators
 * and abbreviations must be on the house lists. Answers must be real words (ESDB membership)
 * and unique across the bank; ids and titles must not spoil answers; help examples must not
 * collide with any round answer.
 */
export function validateRounds(rounds: RoundBundle<WorkshopPayload>[]): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const uncommon = loadUncommonSync();
  const seen = new Map<string, string>();
  const per: Record<string, number> = {};
  for (const { meta, payload } of rounds) {
    per[meta.difficulty] = (per[meta.difficulty] ?? 0) + 1;
    if (meta.difficulty === "master" && !payload.clues.some((c) => c.construction.type === "compound")) problems.push(`${meta.id}: a Master workshop needs at least one compound clue`);
    if (meta.difficulty === "master" && payload.clues.filter((c) => c.construction.type === "cryptic-definition").length > 1) problems.push(`${meta.id}: at most one cryptic definition per Master workshop`);
    if (payload.clues.length < 3) problems.push(`${meta.id}.clues: a workshop needs at least three clues`);
    const ids = new Set<string>();
    payload.clues.forEach((clue, i) => {
      const where = `${meta.id}.clues[${i}]`;
      if (ids.has(clue.id)) problems.push(`${where}.id: duplicate clue id ${clue.id}`);
      ids.add(clue.id);
      problems.push(...verifyClue(clue, where).problems);
      // Each word of the enumeration must be a real word (phrases are checked word by word).
      let at = 0;
      for (const n of enumerationLengths(clue.enumeration)) {
        const word = clue.answer.slice(at, at + n);
        at += n;
        if (!membership.has(word) && !ALLOWED_NON_DICTIONARY_ANSWERS.has(clue.answer)) problems.push(`${where}.answer: ${word} is not in the word list`);
        if (meta.difficulty === "master" && !familiar.has(word) && !uncommon.has(word)) problems.push(`${where}.answer: ${word} is outside the familiar and uncommon layers; Master answers must be recognisable to a strong solver`);
      }
      if (meta.difficulty === "master") {
        if (clue.answer.length < 7) problems.push(`${where}.answer: Master answers have at least 7 letters`);
        if (!["compound", "double-definition", "cryptic-definition"].includes(clue.construction.type)) problems.push(`${where}: Master clues are compound, double definitions or flagged cryptic definitions, not a single plain device`);
        if (clue.construction.type === "cryptic-definition" && !clue.note) problems.push(`${where}: cryptic definitions must carry an honest note`);
      }
      const prior = seen.get(clue.answer);
      if (prior) problems.push(`${where}.answer: ${clue.answer} already used in ${prior}`);
      seen.set(clue.answer, meta.id);
      if ((meta.title ?? "").toUpperCase().includes(clue.answer) || meta.id.toUpperCase().includes(clue.answer)) problems.push(`${meta.id}: id/title spoils ${clue.answer}`);
    });
  }
  for (const ex of HELP_EXAMPLES) {
    if (seen.has(ex.answer)) problems.push(`help example ${ex.answer} collides with an answer in ${seen.get(ex.answer)}`);
  }
  const need: Record<string, number> = { gentle: 12, standard: 12, expert: 18, master: 16 };
  for (const d of Object.keys(need)) if ((per[d] ?? 0) < need[d]) problems.push(`only ${per[d] ?? 0} ${d} rounds; at least ${need[d]} required`);
  return problems;
}

export function validateContent(): string[] {
  return validateRounds(allRounds);
}
