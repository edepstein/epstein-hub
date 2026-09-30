/**
 * Content validator for Hexabble. Hexabble is a match game with no authored rounds; its
 * content is the fixed board, the tile catalogue and the three pack opening fixtures
 * (content/opening-fixtures.json, regression inputs). Runs in `pnpm validate:content`.
 */
import { loadMembershipSync } from "@/lib/dictionary/node";
import fixtures from "./content/opening-fixtures.json";
import { KEY_LOCATIONS, TILES, allCells, analyseMove, premiumAt, type Tile } from "./engine";

export function validateContent(): string[] {
  const problems: string[] = [];
  if (allCells().length !== 217) problems.push("hexabble: board must have 217 cells");
  if (TILES.length !== 108 || new Set(TILES.map((t) => t.id)).size !== 108) problems.push("hexabble: tile catalogue must have 108 unique tiles");
  const kinds = TILES.reduce<Record<string, number>>((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {});
  if (kinds.letter !== 98 || kinds.wild !== 4 || kinds.key !== 2 || kinds.pivot !== 4) problems.push("hexabble: special tile counts differ from the source");
  if (KEY_LOCATIONS.length !== 6 || KEY_LOCATIONS.some(([q, r]) => premiumAt(q, r) !== "KEY")) problems.push("hexabble: expected six Key spaces");
  if (premiumAt(0, 0) !== "START") problems.push("hexabble: centre must be the start space");

  const membership = loadMembershipSync();
  for (const [i, round] of fixtures.rounds.entries()) {
    const where = `hexabble fixture ${round.id} (rounds[${i}])`;
    if (round.status !== "demo") problems.push(`${where}: status must stay "demo"`);
    const placements = round.placements.map((p) => ({ q: p.q, r: p.r, tile: p.tile as Tile, assigned: null }));
    // Against the fixture's own accepted words (as in the pack script) ...
    const own = analyseMove({}, placements, new Set(round.acceptedWords.map((w) => w.toUpperCase())));
    if (own.ok !== round.expected.valid || own.score !== round.expected.score)
      problems.push(`${where}: expected valid=${round.expected.valid} score=${round.expected.score}, got valid=${own.ok} score=${own.score}`);
    // ... and against the production membership list actually used in play.
    const prod = analyseMove({}, placements, membership);
    if (prod.ok !== round.expected.valid) problems.push(`${where}: ${round.expected.word} is not accepted by the production word list`);
  }
  return problems;
}
