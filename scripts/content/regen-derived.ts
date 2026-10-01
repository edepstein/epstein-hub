/**
 * Regenerates content values derived from the pinned word lists after a membership change
 * (e.g. an exclusion-list update). Run, then `pnpm validate:content` re-proves everything.
 *  - Letter Circuit: each round's stored parPool (everyday pool, or the Master pool for pool:"master" rounds).
 *  - Word Ladder: content/familiar.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadFamiliarSync, loadMembershipSync, loadUncommonSync } from "../../src/lib/dictionary/node";
import { EXCLUDED_WORDS } from "../../src/lib/dictionary/exclusions";
import { makeBoard, playableWords } from "../../src/games/letter-circuit/solver";
import { everydayPool, masterPool } from "../../src/games/letter-circuit/pool";

const membership = loadMembershipSync();
const familiar = loadFamiliarSync();

const circuitPath = "src/games/letter-circuit/content/rounds.json";
const circuit = JSON.parse(readFileSync(circuitPath, "utf8"));
const pool = everydayPool(familiar, membership);
const mPool = masterPool(familiar, loadUncommonSync(), membership, EXCLUDED_WORDS);
let changed = 0;
for (const r of circuit.rounds) {
  const p = r.payload ?? r;
  const next = playableWords(makeBoard(p.sides), p.pool === "master" ? mPool : pool, p.minimumWordLength).map((e: { word: string }) => e.word).join(" ");
  if (next !== p.parPool) changed++;
  p.parPool = next;
}
writeFileSync(circuitPath, JSON.stringify(circuit, null, 1) + "\n");
console.log(`letter-circuit: ${changed} parPool value(s) updated`);

const ladderPath = "src/games/word-ladder/content/familiar.json";
const list = [...familiar].filter((w) => w.length >= 3 && w.length <= 5 && membership.has(w)).sort();
writeFileSync(ladderPath, JSON.stringify(list) + "\n");
console.log(`word-ladder: familiar.json has ${list.length} words`);
