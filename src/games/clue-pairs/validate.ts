import { rounds } from "./rounds";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";

/** British spellings that must never be accepted for the listed senses (docs/05 DRAFT/DRAUGHT regression). */
const UK_SPELLING_TRAPS: { wrong: string; right: string; senses: RegExp }[] = [
  { wrong: "DRAFT", right: "DRAUGHT", senses: /current of (cold )?air|draughts|chequered board|drink from a barrel|swallow of/i },
];

/**
 * Clue Pairs content checks: five cards per round, unique card ids, alphabetic accepted answers of the
 * stated length (every variant too), answers in the membership list (practice answers also familiar),
 * no duplicate answers in a round, two distinct non-empty clues that do not contain the answer,
 * a usage example with a blank that never spells the answer, an explanation, spoiler-free ids/titles,
 * and UK-spelling traps (DRAFT is never accepted for DRAUGHT senses).
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const membership = loadMembershipSync();
  const familiar = loadFamiliarSync();
  const perDifficulty: Record<string, number> = {};
  const roundIds = new Set<string>();
  for (const { meta, payload: p } of rounds) {
    const at = (f: string) => `${meta.id}.${f}`;
    if (roundIds.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    roundIds.add(meta.id);
    perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (p.cards.length !== 5) problems.push(`${at("cards")}: expected 5 cards, found ${p.cards.length}`);
    if (new Set(p.cards.map((c) => c.id)).size !== p.cards.length) problems.push(`${at("cards")}: duplicate card id`);
    const answers = p.cards.map((c) => c.accepted[0]);
    if (new Set(answers).size !== answers.length) problems.push(`${at("cards")}: duplicate answer in the round`);
    p.cards.forEach((c, i) => {
      const cf = (f: string) => at(`cards[${i}].${f}`);
      if (!c.accepted.length) problems.push(`${cf("accepted")}: needs at least one accepted answer`);
      for (const a of c.accepted) {
        if (!/^[A-Z]+$/.test(a)) problems.push(`${cf("accepted")}: ${a} must be upper-case A-Z`);
        if (a.length !== c.length) problems.push(`${cf("accepted")}: ${a} is not ${c.length} letters`);
        if (!membership.has(a)) problems.push(`${cf("accepted")}: ${a} is not in the membership list`);
        if (meta.status !== "demo" && !familiar.has(a)) problems.push(`${cf("accepted")}: ${a} is not in the familiar (size-35) layer`);
        for (const trap of UK_SPELLING_TRAPS)
          if (a === trap.wrong && c.clues.some((cl) => trap.senses.test(cl))) problems.push(`${cf("accepted")}: ${trap.wrong} cannot answer a British "${c.clues.join(" / ")}" clue; use ${trap.right}`);
      }
      if (c.clues.length !== 2 || c.clues.some((cl) => cl.trim().length < 5)) problems.push(`${cf("clues")}: needs two definitions`);
      if (c.clues[0].trim().toLowerCase() === c.clues[1].trim().toLowerCase()) problems.push(`${cf("clues")}: the two definitions are identical`);
      const token = (s: string) => new RegExp(`\\b${c.accepted.join("|")}\\b`, "i").test(s);
      if (c.clues.some(token)) problems.push(`${cf("clues")}: a clue contains the answer`);
      if (!c.example.includes("____")) problems.push(`${cf("example")}: needs a ____ blank`);
      if (token(c.example)) problems.push(`${cf("example")}: usage example spells the answer`);
      if (c.explanation.trim().length < 20) problems.push(`${cf("explanation")}: missing explanation of both senses`);
    });
    for (const h of p.fixtureHints ?? []) {
      // Early hint text must not contain a full answer token (fixture hints are metadata only).
      if (answers.some((a) => new RegExp(`\\b${a}\\b`).test(h))) problems.push(`${at("fixtureHints")}: "${h}" spells an answer`);
    }
    const spoil = answers.some((a) => (meta.title ?? "").toUpperCase().includes(a) || meta.id.toUpperCase().includes(a));
    if (spoil) problems.push(`${meta.id}: id/title may spoil an answer`);
  }
  const owner = new Map<string, string>();
  for (const { meta, payload: p } of rounds)
    for (const c of p.cards) {
      const a = c.accepted[0];
      if (owner.has(a)) problems.push(`${meta.id}: answer ${a} is already used in ${owner.get(a)}`);
      else owner.set(a, meta.id);
    }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 12) problems.push(`fewer than 12 ${d} rounds`);
  return problems;
}
