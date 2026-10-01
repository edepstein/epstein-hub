import type { RoundMeta } from "@/lib/engine/types";
import { loadMembershipSync } from "@/lib/dictionary/node";
import { rounds } from "./rounds";
import { bfsMinSwaps, minSwaps, type PhrasePayload } from "./engine";

const MAX_TOKENS = 8;
const MASTER_MAX_TOKENS = 12;
/** Exhaustive search is only run when the board has at most this many distinct orderings. */
const BFS_STATE_LIMIT = 2_500_000;
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/**
 * Semantic checks for one Phrase Repair round (docs/04: token identity and minimum swap computation,
 * including duplicates): unique tile ids, target/tile multisets equal, every accepted target fits the
 * enumeration, the stored minimum equals the inversion count under order-preserving matching of
 * repeated words AND an exhaustive breadth-first search, the board does not start solved, the launch
 * cap of eight words (twelve for Master) holds, and every word is a recognised UK spelling in membership.
 */
export function checkPhraseRound(meta: Pick<RoundMeta, "id" | "status" | "title">, p: PhrasePayload, membership: ReadonlySet<string>, difficulty: string = "standard"): string[] {
  const master = difficulty === "master";
  const problems: string[] = [];
  const at = (f: string) => `${meta.id}.${f}`;
  const ids = p.tokens.map((t) => t.id);
  if (new Set(ids).size !== ids.length) problems.push(`${at("tokens")}: tile ids must be unique`);
  if (p.tokens.length < 3) problems.push(`${at("tokens")}: at least three tiles are needed`);
  const cap = master ? MASTER_MAX_TOKENS : MAX_TOKENS;
  if (p.tokens.length > cap) problems.push(`${at("tokens")}: more than ${cap} words (cap for this difficulty)`);
  if (master) {
    if (p.tokens.length < 8) problems.push(`${at("tokens")}: Master phrases need at least eight words`);
    if (new Set(p.tokens.map((t) => t.text)).size === p.tokens.length) problems.push(`${at("tokens")}: Master phrases must repeat at least one word`);
  }
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
    const orderings = factorial(words.length) / [...new Set(words)].reduce((a, w) => a * factorial(words.filter((x) => x === w).length), 1);
    const bfs = orderings > BFS_STATE_LIMIT ? inv : bfsMinSwaps(words, p.acceptedTargets);
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
  const phrases = new Map<string, string>();
  const clues = new Set<string>();
  const starts = new Set<string>();
  for (const { meta, payload } of rounds) {
    if (seen.has(meta.id)) problems.push(`${meta.id}: duplicate round id`);
    seen.add(meta.id);
    if (meta.status === "practice" || meta.status === "demo") perDifficulty[meta.difficulty] = (perDifficulty[meta.difficulty] ?? 0) + 1;
    for (const t of payload.acceptedTargets) {
      const key = t.join(" ");
      if (phrases.has(key)) problems.push(`${meta.id}: phrase already used in ${phrases.get(key)}`);
      else phrases.set(key, meta.id);
    }
    if (clues.has(payload.clue)) problems.push(`${meta.id}: duplicate clue text`);
    clues.add(payload.clue);
    const startKey = payload.tokens.map((t) => t.text).join(" ");
    if (starts.has(startKey)) problems.push(`${meta.id}: duplicate starting order`);
    starts.add(startKey);
    if (meta.status === "demo" && !meta.sourceFixtureId) problems.push(`${meta.id}: demo round without sourceFixtureId`);
    problems.push(...checkPhraseRound(meta, payload, membership, meta.difficulty));
  }
  const minimum: Record<string, number> = { gentle: 14, standard: 14, expert: 20, master: 14 };
  for (const d of Object.keys(minimum)) if ((perDifficulty[d] ?? 0) < minimum[d]) problems.push(`fewer than ${minimum[d]} rounds (practice plus demo) at ${d}`);
  return problems;
}
