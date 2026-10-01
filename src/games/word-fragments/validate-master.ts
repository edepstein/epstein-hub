import type { RoundMeta } from "@/lib/engine/types";
import type { FragPayload } from "./engine";

/**
 * Number of distinct ways each lane's (first) accepted answer can be spelled from the shared tile texts
 * (respecting how many tiles carry each text), regardless of what the other lanes need. More than one
 * parse means the lane has a misleading alternative chunking that only the whole-board count rules out.
 */
export function laneParseCounts(p: FragPayload): Record<string, number> {
  const counts = new Map<string, number>();
  for (const t of p.tiles) counts.set(t.text, (counts.get(t.text) ?? 0) + 1);
  const out: Record<string, number> = {};
  for (const lane of p.lanes) {
    const word = (p.acceptedAnswers[lane.id] ?? [])[0] ?? "";
    let n = 0;
    const rec = (i: number) => {
      if (i === word.length) {
        n++;
        return;
      }
      for (const [text, c] of counts) {
        if (c === 0 || !word.startsWith(text, i)) continue;
        counts.set(text, c - 1);
        rec(i + text.length);
        counts.set(text, c);
      }
    };
    rec(0);
    out[lane.id] = n;
  }
  return out;
}

/** Master-only checks: long answers, short fragments, a proved unique allocation and deliberately misleading chunks. */
export function checkMasterFragments(meta: Pick<RoundMeta, "id">, p: FragPayload): string[] {
  const problems: string[] = [];
  const at = (f: string) => `${meta.id}.${f}`;
  if (p.lanes.length < 3 || p.lanes.length > 4) problems.push(`${at("lanes")}: master boards have three or four lanes`);
  for (const lane of p.lanes) {
    if (lane.length < 9 || lane.length > 14) problems.push(`${at(`lanes.${lane.id}`)}: master answers have 9 to 14 letters, found ${lane.length}`);
    if (lane.clue.split(/\s+/).length > 9) problems.push(`${at(`lanes.${lane.id}`)}: master clues are crossword-terse (nine words at most)`);
    if ((p.acceptedAnswers[lane.id] ?? []).length !== 1) problems.push(`${at(`acceptedAnswers.${lane.id}`)}: master lanes accept exactly one answer`);
  }
  for (const t of p.tiles) if (t.text.length < 2 || t.text.length > 4) problems.push(`${at("tiles")}: ${t.id} (${t.text}) must have 2 to 4 letters`);
  if (!p.claimsUnique) problems.push(`${meta.id}: master boards must have a solver-proved unique allocation`);
  const parses = Object.values(laneParseCounts(p));
  if (parses.filter((n) => n >= 2).length < 2) problems.push(`${meta.id}: at least two lanes need a second, misleading way to chunk the answer from the tray`);
  const texts = p.tiles.map((t) => t.text);
  if (new Set(texts).size === texts.length) problems.push(`${meta.id}: master boards need at least one repeated fragment text`);
  return problems;
}
