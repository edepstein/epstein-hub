/* Runs every game validator plus shared registry checks. Exit code 1 on any problem. */
import { GAMES, getRounds } from "../../src/games/registry";
import { contentHash } from "../../src/lib/hash";
import { validateContent as anagramRelay } from "../../src/games/anagram-relay/validate";
import { validateContent as cluePairs } from "../../src/games/clue-pairs/validate";
import { validateContent as crypticWorkshop } from "../../src/games/cryptic-workshop/validate";
import { validateContent as dailyCrossword } from "../../src/games/daily-crossword/validate";
import { validateContent as definitionDetective } from "../../src/games/definition-detective/validate";
import { validateContent as hexabble } from "../../src/games/hexabble/validate";
import { validateContent as hiddenWordTrail } from "../../src/games/hidden-word-trail/validate";
import { validateContent as letterCircuit } from "../../src/games/letter-circuit/validate";
import { validateContent as letterSet } from "../../src/games/letter-set/validate";
import { validateContent as letterWheel } from "../../src/games/letter-wheel/validate";
import { validateContent as missingLinks } from "../../src/games/missing-links/validate";
import { validateContent as phraseRepair } from "../../src/games/phrase-repair/validate";
import { validateContent as sharedWordBoard } from "../../src/games/shared-word-board/validate";
import { validateContent as shrinkingStaircase } from "../../src/games/shrinking-staircase/validate";
import { validateContent as wordDeduction } from "../../src/games/word-deduction/validate";
import { validateContent as wordFamilies } from "../../src/games/word-families/validate";
import { validateContent as wordFragments } from "../../src/games/word-fragments/validate";
import { validateContent as wordLadder } from "../../src/games/word-ladder/validate";
import { validateContent as wordWeave } from "../../src/games/word-weave/validate";

const VALIDATORS: Record<string, () => string[]> = {
  "anagram-relay": anagramRelay,
  "clue-pairs": cluePairs,
  "cryptic-workshop": crypticWorkshop,
  "daily-crossword": dailyCrossword,
  "definition-detective": definitionDetective,
  "hexabble": hexabble,
  "hidden-word-trail": hiddenWordTrail,
  "letter-circuit": letterCircuit,
  "letter-set": letterSet,
  "letter-wheel": letterWheel,
  "missing-links": missingLinks,
  "phrase-repair": phraseRepair,
  "shared-word-board": sharedWordBoard,
  "shrinking-staircase": shrinkingStaircase,
  "word-deduction": wordDeduction,
  "word-families": wordFamilies,
  "word-fragments": wordFragments,
  "word-ladder": wordLadder,
  "word-weave": wordWeave,
};

let failures = 0;
for (const game of GAMES) {
  const problems: string[] = [];
  const rounds = getRounds(game.id);
  const ids = new Set<string>();
  for (const r of rounds) {
    if (r.meta.gameId !== game.id) problems.push(`${r.meta.id}: meta.gameId is ${r.meta.gameId}`);
    if (ids.has(r.meta.id)) problems.push(`${r.meta.id}: duplicate round id`);
    ids.add(r.meta.id);
    if (r.meta.contentHash !== contentHash(r.payload)) problems.push(`${r.meta.id}: contentHash does not match payload`);
    if (r.meta.status === "published" || r.meta.status === "scheduled") problems.push(`${r.meta.id}: status ${r.meta.status} requires editorial approval records`);
  }
  if (game.availability === "playable-preview" && game.kind === "puzzle" && rounds.length === 0) problems.push("playable game has no rounds");
  if (game.availability === "playable-preview" && game.rules.sections.length === 0) problems.push("playable game has no rules sections");
  if (game.productionEnabled && game.releaseGates.some((g) => g.status === "open")) problems.push("productionEnabled with open release gates");
  problems.push(...VALIDATORS[game.id]());
  const status = problems.length ? "FAIL" : "PASS";
  console.log(`${status} ${game.id}: ${rounds.length} round(s)${game.availability === "coming-soon" ? " (coming soon)" : ""}`);
  for (const p of problems) console.log(`   - ${p}`);
  failures += problems.length;
}
if (failures) {
  console.log(`\n${failures} content problem(s). Mechanical validation does not certify editorial quality.`);
  process.exit(1);
}
console.log("\nAll content validators passed. Mechanical validation does not certify editorial quality.");
