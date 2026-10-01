import type { RoundMeta } from "@/lib/engine/types";
import { solveAllocations, textSignature, type FragPayload } from "./engine";

const tileMap = (p: FragPayload) => Object.fromEntries(p.tiles.map((t) => [t.id, t.text]));

/** Distinct fragment-text allocations that spell accepted answers in every lane, using every tile once. */
export function acceptedTextAllocations(p: FragPayload): string[] {
  const tiles = tileMap(p);
  const order = p.lanes.map((l) => l.id);
  const sols = solveAllocations(p.lanes, tiles, (l) => p.acceptedAnswers[l.id] ?? [], { limit: 50000 });
  return [...new Set(sols.map((a) => textSignature(a, tiles, order)))];
}

/**
 * Rival boards: full allocations where every lane spells SOME membership word of the right length
 * (ignoring clues). These are the boards an editor must rule out through the clues.
 */
export function rivalBoards(p: FragPayload, membership: ReadonlySet<string>, limit = 50): string[] {
  const tiles = tileMap(p);
  const ids = Object.keys(tiles);
  const options: Record<string, string[][]> = {};
  for (const lane of p.lanes) {
    const found: string[][] = [];
    const seq: string[] = [];
    const used = new Set<string>();
    const walk = (len: number, text: string) => {
      if (len === lane.length) {
        if (membership.has(text)) found.push(seq.slice());
        return;
      }
      for (const id of ids) {
        if (used.has(id) || len + tiles[id].length > lane.length) continue;
        used.add(id);
        seq.push(id);
        walk(len + tiles[id].length, text + tiles[id]);
        seq.pop();
        used.delete(id);
      }
    };
    walk(0, "");
    options[lane.id] = found;
  }
  const out = new Set<string>();
  const used = new Set<string>();
  const cur: Record<string, string[]> = {};
  const order = p.lanes.map((l) => l.id);
  const rec = (i: number) => {
    if (out.size >= limit) return;
    if (i === p.lanes.length) {
      if (used.size === ids.length) out.add(textSignature(cur, tiles, order));
      return;
    }
    for (const opt of options[p.lanes[i].id]) {
      if (opt.some((id) => used.has(id))) continue;
      opt.forEach((id) => used.add(id));
      cur[p.lanes[i].id] = opt;
      rec(i + 1);
      opt.forEach((id) => used.delete(id));
    }
  };
  rec(0);
  // Ignore boards that only move whole accepted answers between lanes of equal length: the clues settle those.
  const words = (sig: string) => sig.split(" | ").map((x) => x.replace(/\+/g, "")).sort().join(" ");
  const accepted = new Set(acceptedTextAllocations(p).map(words));
  return [...out].filter((s) => !accepted.has(words(s)));
}

/**
 * Semantic checks (docs/04 exact token solver): tile identity, letter totals, answer lengths and
 * membership, every example allocation uses each tile exactly once and spells accepted answers, the
 * solver finds a full allocation, and a uniqueness claim is made only when the solver proves it.
 */
export function checkFragmentsRound(meta: Pick<RoundMeta, "id" | "status" | "title">, p: FragPayload, membership: ReadonlySet<string>, familiar: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const at = (f: string) => `${meta.id}.${f}`;
  const ids = p.tiles.map((t) => t.id);
  if (new Set(ids).size !== ids.length) problems.push(`${at("tiles")}: tile ids must be unique`);
  for (const t of p.tiles) if (!/^[A-Z]+$/.test(t.text)) problems.push(`${at("tiles")}: ${t.id} text must be upper-case A-Z`);
  const laneIds = p.lanes.map((l) => l.id);
  if (new Set(laneIds).size !== laneIds.length) problems.push(`${at("lanes")}: lane ids must be unique`);
  const letters = p.tiles.reduce((n, t) => n + t.text.length, 0);
  const needed = p.lanes.reduce((n, l) => n + l.length, 0);
  if (letters !== needed) problems.push(`${at("tiles")}: fragments hold ${letters} letters but the lanes need ${needed}`);
  for (const lane of p.lanes) {
    const answers = p.acceptedAnswers[lane.id] ?? [];
    if (!answers.length) problems.push(`${at(`acceptedAnswers.${lane.id}`)}: no accepted answer`);
    if (/—/.test(lane.clue)) problems.push(`${at(`lanes.${lane.id}`)}: clue contains an em dash`);
    for (const w of answers) {
      if (w.length !== lane.length) problems.push(`${at(`acceptedAnswers.${lane.id}`)}: ${w} does not match the enumeration (${lane.length})`);
      if (!membership.has(w)) problems.push(`${at(`acceptedAnswers.${lane.id}`)}: ${w} is not in gameplay membership`);
      if (meta.status !== "demo" && !familiar.has(w)) problems.push(`${at(`acceptedAnswers.${lane.id}`)}: ${w} is not in the familiar (size-35) layer`);
    }
  }
  p.allocations.forEach((a, k) => {
    const where = at(`allocations[${k}]`);
    const all = Object.values(a).flat();
    if (all.length !== ids.length || new Set(all).size !== all.length || !all.every((id) => ids.includes(id)))
      problems.push(`${where}: must use every tile exactly once (no duplicates, no unused fragments)`);
    for (const lane of p.lanes) {
      const word = (a[lane.id] ?? []).map((id) => p.tiles.find((t) => t.id === id)?.text ?? "?").join("");
      if (!(p.acceptedAnswers[lane.id] ?? []).includes(word)) problems.push(`${where}.${lane.id}: ${word} is not an accepted answer (no inserted letters allowed)`);
    }
  });
  const textAllocs = acceptedTextAllocations(p);
  if (!textAllocs.length) problems.push(`${meta.id}: the solver found no full allocation`);
  if (p.claimsUnique && textAllocs.length !== 1) problems.push(`${meta.id}: claims a unique solution but the solver found ${textAllocs.length}`);
  const title = (meta.title ?? "").toUpperCase();
  for (const w of Object.values(p.acceptedAnswers).flat()) if (new RegExp(`\\b${w}\\b`).test(title) || meta.id.toUpperCase().includes(w)) problems.push(`${meta.id}: id or title may spoil ${w}`);
  return problems;
}

