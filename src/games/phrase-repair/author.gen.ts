/* Authoring helper (not imported by the app): builds content/rounds.json from a compact table and
 * computes every stored minimum with the exact solver. Run: pnpm exec tsx src/games/phrase-repair/author.gen.ts */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { bfsMinSwaps, minSwaps } from "./engine";

type Row = {
  id: string;
  title: string;
  difficulty: "gentle" | "standard" | "expert";
  status: "demo" | "practice";
  source: string | null;
  clue: string;
  targets: string[];
  start: string;
  explanation: string;
  properNouns?: string[];
};

const rows: Row[] = [
  { id: "pr-demo-1", title: "Original demo phrase 1", difficulty: "gentle", status: "demo", source: "phrase-001", clue: "Regret something that cannot now be changed", targets: ["CRY OVER SPILT MILK"], start: "SPILT OVER MILK CRY", explanation: "The target-position sequence is 2,1,3,0 and has four inversions." },
  { id: "pr-demo-2", title: "Original demo phrase 2", difficulty: "gentle", status: "demo", source: "phrase-002", clue: "Consider the consequences before taking action", targets: ["LOOK BEFORE YOU LEAP"], start: "LEAP YOU BEFORE LOOK", explanation: "The initial order reverses all four target positions, giving six inversions." },
  { id: "pr-demo-3", title: "Original demo phrase 3", difficulty: "standard", status: "demo", source: "phrase-003", clue: "A proverb saying prompt repair prevents extra work", targets: ["A STITCH IN TIME SAVES NINE"], start: "STITCH SAVES A NINE TIME IN", explanation: "The target-position sequence 1,4,0,5,3,2 has seven inversions." },
  { id: "pr-g1", title: "Gentle phrase 1", difficulty: "gentle", status: "practice", source: null, clue: "Unharmed and secure, especially after a risky journey", targets: ["SAFE AND SOUND"], start: "SOUND SAFE AND", explanation: "SAFE AND SOUND: the pairing of two words beginning with S is what makes it memorable." },
  { id: "pr-g2", title: "Gentle phrase 2", difficulty: "gentle", status: "practice", source: null, clue: "Arriving eventually is preferable to not arriving at all", targets: ["BETTER LATE THAN NEVER"], start: "NEVER LATE BETTER THAN", explanation: "BETTER LATE THAN NEVER compares two outcomes: late is better than never." },
  { id: "pr-g3", title: "Gentle phrase 3", difficulty: "gentle", status: "practice", source: null, clue: "Calm, with no noise or disturbance", targets: ["PEACE AND QUIET"], start: "AND QUIET PEACE", explanation: "PEACE AND QUIET pairs two words for calm." },
  { id: "pr-g4", title: "Gentle phrase 4", difficulty: "gentle", status: "practice", source: null, clue: "Doing something again and again leads to mastery", targets: ["PRACTICE MAKES PERFECT"], start: "PERFECT PRACTICE MAKES", explanation: "PRACTICE MAKES PERFECT uses the noun practice, spelt with a C in British English." },
  { id: "pr-g5", title: "Gentle phrase 5", difficulty: "gentle", status: "practice", source: null, clue: "Very rarely indeed", targets: ["ONCE IN A BLUE MOON"], start: "BLUE ONCE MOON A IN", explanation: "ONCE IN A BLUE MOON: a blue moon is a rare event, so this means hardly ever." },
  { id: "pr-s1", title: "Standard phrase 1", difficulty: "standard", status: "practice", source: null, clue: "When too many people take charge, the job is done badly", targets: ["TOO MANY COOKS SPOIL THE BROTH"], start: "COOKS THE TOO BROTH SPOIL MANY", explanation: "TOO MANY COOKS SPOIL THE BROTH: the verb SPOIL sits between the cooks and what they ruin." },
  { id: "pr-s2", title: "Standard phrase 2", difficulty: "standard", status: "practice", source: null, clue: "A task becomes easy when everyone shares it", targets: ["MANY HANDS MAKE LIGHT WORK"], start: "LIGHT MAKE WORK MANY HANDS", explanation: "MANY HANDS MAKE LIGHT WORK: LIGHT describes WORK, so they stay together at the end." },
  { id: "pr-s3", title: "Standard phrase 3", difficulty: "standard", status: "practice", source: null, clue: "Those who start promptly get the advantage", targets: ["THE EARLY BIRD CATCHES THE WORM"], start: "WORM THE CATCHES EARLY THE BIRD", explanation: "THE EARLY BIRD CATCHES THE WORM has two THE tiles; either can go first, so they never cost extra swaps." },
  { id: "pr-s4", title: "Standard phrase 4", difficulty: "standard", status: "practice", source: null, clue: "What is gained without effort is lost without regret", targets: ["EASY COME EASY GO"], start: "COME GO EASY EASY", explanation: "EASY COME EASY GO repeats EASY. Matching the repeated tiles in order gives a minimum of three swaps, not four." },
  { id: "pr-s5", title: "Standard phrase 5", difficulty: "standard", status: "practice", source: null, clue: "Some good comes out of every misfortune", targets: ["EVERY CLOUD HAS A SILVER LINING"], start: "A SILVER CLOUD LINING EVERY HAS", explanation: "EVERY CLOUD HAS A SILVER LINING: the silver lining belongs to the cloud." },
  { id: "pr-e1", title: "Expert phrase 1", difficulty: "expert", status: "practice", source: null, clue: "A motto of shared loyalty, each for the group and the group for each", targets: ["ONE FOR ALL AND ALL FOR ONE", "ALL FOR ONE AND ONE FOR ALL"], start: "FOR ONE AND ALL ONE ALL FOR", explanation: "Both orders of the motto are accepted: ONE FOR ALL AND ALL FOR ONE, or ALL FOR ONE AND ONE FOR ALL. The minimum is measured to whichever is nearer." },
  { id: "pr-e2", title: "Expert phrase 2", difficulty: "expert", status: "practice", source: null, clue: "Once you are committed, you may as well go all the way", targets: ["IN FOR A PENNY IN FOR A POUND"], start: "A POUND FOR IN PENNY A IN FOR", explanation: "IN FOR A PENNY IN FOR A POUND: the small coin comes first, the larger one last." },
  { id: "pr-e3", title: "Expert phrase 3", difficulty: "expert", status: "practice", source: null, clue: "We soon forget what we no longer see", targets: ["OUT OF SIGHT OUT OF MIND"], start: "MIND OF OUT SIGHT OF OUT", explanation: "OUT OF SIGHT OUT OF MIND: seeing comes before remembering." },
  { id: "pr-e4", title: "Expert phrase 4", difficulty: "expert", status: "practice", source: null, clue: "Your actions will eventually come back to you", targets: ["WHAT GOES AROUND COMES AROUND"], start: "AROUND COMES WHAT AROUND GOES", explanation: "WHAT GOES AROUND COMES AROUND: going out comes before coming back." },
  { id: "pr-e5", title: "Expert phrase 5", difficulty: "expert", status: "practice", source: null, clue: "When abroad, follow the local customs", targets: ["WHEN IN ROME DO AS THE ROMANS DO"], start: "DO ROMANS IN AS WHEN DO THE ROME", properNouns: ["ROME", "ROMANS"], explanation: "WHEN IN ROME DO AS THE ROMANS DO: the two DO tiles are interchangeable." },
];

const rounds = rows.map((r) => {
  const words = r.start.split(" ");
  const targets = r.targets.map((t) => t.split(" "));
  const mins = targets.map((t) => minSwaps(words, t));
  if (mins.some((m) => m === null)) throw new Error(`${r.id}: tiles do not match a target`);
  const minimum = Math.min(...(mins as number[]));
  const bfs = bfsMinSwaps(words, targets);
  if (bfs !== minimum) throw new Error(`${r.id}: inversion minimum ${minimum} but BFS ${bfs}`);
  console.log(r.id, "minimum", minimum, "tokens", words.length);
  return {
    id: r.id,
    title: r.title,
    difficulty: r.difficulty,
    status: r.status,
    sourceFixtureId: r.source,
    payload: {
      clue: r.clue,
      enumeration: targets[0].map((w) => w.length),
      tokens: words.map((text, i) => ({ id: `t${i + 1}`, text })),
      acceptedTargets: targets,
      minimumAdjacentSwaps: minimum,
      ...(r.properNouns ? { properNouns: r.properNouns } : {}),
      explanation: r.explanation,
    },
  };
});

writeFileSync(
  join(process.cwd(), "src/games/phrase-repair/content/rounds.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      gameId: "phrase-repair",
      rulesVersion: "1.0",
      note: "Demo rounds import the pack fixtures (sourceFixtureId) with their original tile order and ids. Practice rounds are original to this build; every stored minimum is recomputed by inversion counting with order-preserving matching of repeated words and confirmed by exhaustive search. Clues are original and not yet human-reviewed.",
      rounds,
    },
    null,
    2,
  ) + "\n",
);
