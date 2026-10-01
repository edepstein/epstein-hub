import { rounds as allRounds } from "./rounds";
import type { RoundBundle } from "../types";
import type { WorkshopPayload } from "./engine";
import { HELP_EXAMPLES, verifyClue } from "./construction";
import { loadMembershipSync } from "@/lib/dictionary/node";

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
  const seen = new Map<string, string>();
  const per: Record<string, number> = {};
  for (const { meta, payload } of rounds) {
    per[meta.difficulty] = (per[meta.difficulty] ?? 0) + 1;
    if (payload.clues.length < 3) problems.push(`${meta.id}.clues: a workshop needs at least three clues`);
    const ids = new Set<string>();
    payload.clues.forEach((clue, i) => {
      const where = `${meta.id}.clues[${i}]`;
      if (ids.has(clue.id)) problems.push(`${where}.id: duplicate clue id ${clue.id}`);
      ids.add(clue.id);
      problems.push(...verifyClue(clue, where).problems);
      if (!membership.has(clue.answer) && !ALLOWED_NON_DICTIONARY_ANSWERS.has(clue.answer)) problems.push(`${where}.answer: ${clue.answer} is not in the word list`);
      const prior = seen.get(clue.answer);
      if (prior) problems.push(`${where}.answer: ${clue.answer} already used in ${prior}`);
      seen.set(clue.answer, meta.id);
      if ((meta.title ?? "").toUpperCase().includes(clue.answer) || meta.id.toUpperCase().includes(clue.answer)) problems.push(`${meta.id}: id/title spoils ${clue.answer}`);
    });
  }
  for (const ex of HELP_EXAMPLES) {
    if (seen.has(ex.answer)) problems.push(`help example ${ex.answer} collides with an answer in ${seen.get(ex.answer)}`);
  }
  for (const d of ["gentle", "standard", "expert"]) if ((per[d] ?? 0) < 12) problems.push(`only ${per[d] ?? 0} ${d} rounds; at least 12 required`);
  return problems;
}

export function validateContent(): string[] {
  return validateRounds(allRounds);
}
