import type { RoundMeta } from "@/lib/engine/types";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { rounds } from "./rounds";
import { bfsMinSwaps, minSwaps, type PhrasePayload } from "./engine";

const MAX_TOKENS = 8;

/**
 * Semantic checks for one Phrase Repair round (docs/04: token identity and minimum swap computation,
 * including duplicates): unique tile ids, target/tile multisets equal, every accepted target fits the
 * enumeration, the stored minimum equals the inversion count under order-preserving matching of
 * repeated words AND an exhaustive breadth-first search, the board does not start solved, the launch
 * cap of eight words holds, and every word is a recognised UK spelling in membership.
 */
export function checkPhraseRound(meta: Pick<RoundMeta, "id" | "status" | "title">, p: PhrasePayload, membership: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const at = (f: string) => `${meta.id}.${f}`;
  const ids = p.tokens.map((t) => t.id);
  if (new Set(ids).size !== ids.length) problems.push(`${at("tokens")}: tile ids must be unique`);
  if (p.tokens.length < 3) problems.push(`${at("tokens")}: at least three tiles are needed`);
  if (p.tokens.length > MAX_TOKENS) problems.push(`${at("tokens")}: more than ${MAX_TOKENS} words (launch cap)`);
  const words = p.tokens.map((t) => t.text);
  for (const w of words) {
    if (!/^[A-Z]+$/.test(w)) problems.push(`${at("tokens")}: ${w} must be upper-case A-Z`);
    else if (w.length > 1 && !membership.has(w) && !(p.properNouns ?? []).includes(w)) problems.push(`${at("tokens")}: ${w} is not a recognised spelling in membership`);
  }
  if (!p.acceptedTargets.length) problems.push(`${at("acceptedTargets")}: no accepted target`);
  const sorted = [...words].sort().join(" ");
  p.acceptedTargets.forEach((t, i) => {
    if ([...t].sort().join(" ") !== sorted) problems.push(`${at(`acceptedTargets[${i}]`)}: words differ from the tiles (token multisets must be equal)`);
    if (t.length !== p.enumeration.length || t.some((w, k) => w.length !== p.enumeration[k]))
      problems.push(`${at(`acceptedTargets[${i}]`)}: ${t.join(" ")} does not fit the enumeration (${p.enumeration.join(", ")})`);
    if (t.join(" ") === words.join(" ")) problems.push(`${at("tokens")}: the board starts already solved`);
  });
  if (new Set(p.acceptedTargets.map((t) => t.join(" "))).size !== p.acceptedTargets.length) problems.push(`${at("acceptedTargets")}: duplicate target`);
  const mins = p.acceptedTargets.map((t) => minSwaps(words, t)).filter((m): m is number => m !== null);
  if (mins.length === p.acceptedTargets.length) {
    const inv = Math.min(...mins);
    if (inv !== p.minimumAdjacentSwaps) problems.push(`${at("minimumAdjacentSwaps")}: stored ${p.minimumAdjacentSwaps}, computed ${inv}`);
    const bfs = bfsMinSwaps(words, p.acceptedTargets);
    if (bfs !== inv) problems.push(`${at("minimumAdjacentSwaps")}: inversion count ${inv} disagrees with exhaustive search ${bfs}`);
  }
  if (/—/.test(p.clue)) problems.push(`${at("clue")}: contains an em dash`);
  const title = (meta.title ?? "").toUpperCase();
  for (const w of new Set(words)) if (w.length >= 4 && new RegExp(`\\b${w}\\b`).test(title)) problems.push(`${meta.id}: title may spoil ${w}`);
  return problems;
}

export function validateContent(): string[] {
  const membership = loadMembershipSync();
  const problems: string[] = [];
  const perDifficulty: Record<string, number> = {};
  const seen = new Set<string>();
  for (const { meta, payload } of rounds) {
    if (seen.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    seen.add(meta.id);
    if (meta.status === "practice") perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    if (meta.status === "demo" && !meta.sourceFixtureId) problems.push(`${meta.id}: demo round without sourceFixtureId`);
    problems.push(...checkPhraseRound(meta, payload, membership));
  }
  for (const d of ["gentle", "standard", "expert"]) if ((perDifficulty[d] ?? 0) < 4) problems.push(`fewer than 4 practice rounds at ${d}`);
  return problems;
}
