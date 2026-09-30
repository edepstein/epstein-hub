import type { RoundMeta } from "@/lib/engine/types";
import { loadFamiliarSync, loadMembershipSync } from "@/lib/dictionary/node";
import { rounds } from "./rounds";
import { extraLetters, type RelayPayload } from "./engine";

/**
 * Semantic checks for one relay round (exact multiset solver, docs/04): each accepted chain
 * starts at the supplied word and every edge keeps the whole previous multiset and adds exactly
 * one occurrence (the agreed add-one rule; the discarded exchange-one rule must fail). Stored
 * added letters must agree with the computed difference. Answers are in membership, and practice
 * answers are familiar (size-35). Branches are complete chains, so each has a verified future.
 */
export function checkRelayRound(
  meta: Pick<RoundMeta, "id" | "status" | "title">,
  p: RelayPayload,
  membership: ReadonlySet<string>,
  familiar: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  const at = (f: string) => `${meta.id}.${f}`;
  if (!/^[A-Z]+$/.test(p.start)) problems.push(`${at("start")}: must be upper-case A-Z`);
  if (p.stages.length !== 3) problems.push(`${at("stages")}: a relay has three stages, found ${p.stages.length}`);
  p.stages.forEach((st, i) => {
    if (st.length !== p.start.length + i + 1) problems.push(`${at(`stages[${i}].length`)}: expected ${p.start.length + i + 1}, found ${st.length}`);
    if (!st.clue || st.clue.trim().length < 3) problems.push(`${at(`stages[${i}].clue`)}: missing clue`);
    if (/—/.test(st.clue)) problems.push(`${at(`stages[${i}].clue`)}: contains an em dash`);
  });
  if (!p.acceptedChains.length) problems.push(`${at("acceptedChains")}: no accepted chain`);
  if (p.addedLetters.length !== p.acceptedChains.length) problems.push(`${at("addedLetters")}: one list per accepted chain is required`);
  const seen = new Set<string>();
  p.acceptedChains.forEach((chain, c) => {
    const where = at(`acceptedChains[${c}]`);
    const sig = chain.join(">");
    if (seen.has(sig)) problems.push(`${where}: duplicate chain`);
    seen.add(sig);
    if (chain[0] !== p.start) problems.push(`${where}: does not begin with ${p.start}`);
    if (chain.length !== p.stages.length + 1) {
      problems.push(`${where}: has ${chain.length - 1} answers for ${p.stages.length} stages (an accepted branch without a complete continuation)`);
      return;
    }
    if (new Set(chain).size !== chain.length) problems.push(`${where}: repeats a word`);
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const next = chain[i];
      const dropped = extraLetters(prev, next);
      const added = extraLetters(next, prev);
      if (dropped.length) problems.push(`${where}[${i}]: ${next} drops ${dropped.join(", ")} from ${prev} (letters may not be removed or exchanged)`);
      if (added.length !== 1) problems.push(`${where}[${i}]: ${prev} to ${next} adds ${added.length} letters; exactly one is required`);
      if (next.length !== prev.length + 1) problems.push(`${where}[${i}]: ${next} is not one letter longer than ${prev}`);
      const stored = p.addedLetters[c]?.[i - 1];
      if (added.length === 1 && stored !== added[0]) problems.push(`${at(`addedLetters[${c}][${i - 1}]`)}: stored ${stored ?? "nothing"}, computed ${added[0]}`);
    }
    for (const w of chain) {
      if (!membership.has(w)) problems.push(`${where}: ${w} is not in gameplay membership`);
      if (meta.status !== "demo" && !familiar.has(w)) problems.push(`${where}: ${w} is not in the familiar (size-35) layer`);
    }
    if (meta.status !== "demo") {
      const plurals = chain.slice(1).filter((w, i) => w === chain[i] + "S").length;
      if (plurals > 1) problems.push(`${where}: more than one plural-only stage`);
    }
  });
  const title = (meta.title ?? "").toUpperCase();
  for (const w of new Set(p.acceptedChains.flat())) {
    if (w.length >= 3 && w !== p.start && (new RegExp(`\\b${w}\\b`).test(title) || meta.id.toUpperCase().includes(w))) problems.push(`${meta.id}: id or title may spoil ${w}`);
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
    if (meta.difficulty !== "gentle" && payload.acceptedChains.some((c) => c.slice(1).some((w, i) => w === c[i] + "S")))
      problems.push(`${meta.id}: plural-only stages are reserved for Gentle rounds`);
    problems.push(...checkRelayRound(meta, payload, membership, familiar));
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 4) problems.push(`fewer than 4 practice rounds at ${d}`);
  return problems;
}
