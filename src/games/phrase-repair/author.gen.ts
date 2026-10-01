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
  { id: "pr-g6", title: "Gentle phrase 6", difficulty: "gentle", status: "practice", source: null, clue: "Only the future will show whether something was right", targets: ["TIME WILL TELL"], start: "TELL TIME WILL", explanation: "Time comes first, then the verb, and tell finishes the saying." },
  { id: "pr-g7", title: "Gentle phrase 7", difficulty: "gentle", status: "practice", source: null, clue: "It is wiser to take care now than to regret it later", targets: ["BETTER SAFE THAN SORRY"], start: "SAFE SORRY THAN BETTER", explanation: "BETTER SAFE THAN SORRY compares two outcomes: safe is better than sorry." },
  { id: "pr-g8", title: "Gentle phrase 8", difficulty: "gentle", status: "practice", source: null, clue: "What you do counts for more than what you say", targets: ["ACTIONS SPEAK LOUDER THAN WORDS"], start: "SPEAK THAN WORDS ACTIONS LOUDER", explanation: "ACTIONS SPEAK LOUDER THAN WORDS: the comparison LOUDER THAN WORDS ends the saying." },
  { id: "pr-g9", title: "Gentle phrase 9", difficulty: "gentle", status: "practice", source: null, clue: "You trust a thing once you have seen it for yourself", targets: ["SEEING IS BELIEVING"], start: "IS BELIEVING SEEING", explanation: "SEEING IS BELIEVING: seeing leads to believing." },
  { id: "pr-g10", title: "Gentle phrase 10", difficulty: "gentle", status: "practice", source: null, clue: "Give away a secret by accident or on purpose", targets: ["SPILL THE BEANS"], start: "THE BEANS SPILL", explanation: "SPILL THE BEANS: the verb comes first, then the thing spilt." },
  { id: "pr-g11", title: "Gentle phrase 11", difficulty: "gentle", status: "practice", source: null, clue: "Pouring with rain", targets: ["RAINING CATS AND DOGS"], start: "DOGS CATS AND RAINING", explanation: "RAINING CATS AND DOGS: the pair CATS AND DOGS follows the weather word." },
  { id: "pr-g12", title: "Gentle phrase 12", difficulty: "gentle", status: "practice", source: null, clue: "Stay composed and continue as normal", targets: ["KEEP CALM AND CARRY ON"], start: "CALM AND CARRY ON KEEP", explanation: "KEEP CALM AND CARRY ON: two instructions joined by AND." },
  { id: "pr-s1", title: "Standard phrase 1", difficulty: "standard", status: "practice", source: null, clue: "When too many people take charge, the job is done badly", targets: ["TOO MANY COOKS SPOIL THE BROTH"], start: "COOKS THE TOO BROTH SPOIL MANY", explanation: "TOO MANY COOKS SPOIL THE BROTH: the verb SPOIL sits between the cooks and what they ruin." },
  { id: "pr-s2", title: "Standard phrase 2", difficulty: "standard", status: "practice", source: null, clue: "A task becomes easy when everyone shares it", targets: ["MANY HANDS MAKE LIGHT WORK"], start: "LIGHT MAKE WORK MANY HANDS", explanation: "MANY HANDS MAKE LIGHT WORK: LIGHT describes WORK, so they stay together at the end." },
  { id: "pr-s3", title: "Standard phrase 3", difficulty: "standard", status: "practice", source: null, clue: "Those who start promptly get the advantage", targets: ["THE EARLY BIRD CATCHES THE WORM"], start: "WORM THE CATCHES EARLY THE BIRD", explanation: "THE EARLY BIRD CATCHES THE WORM has two THE tiles; either can go first, so they never cost extra swaps." },
  { id: "pr-s4", title: "Standard phrase 4", difficulty: "standard", status: "practice", source: null, clue: "What is gained without effort is lost without regret", targets: ["EASY COME EASY GO"], start: "COME GO EASY EASY", explanation: "EASY COME EASY GO repeats EASY. Matching the repeated tiles in order gives a minimum of three swaps, not four." },
  { id: "pr-s5", title: "Standard phrase 5", difficulty: "standard", status: "practice", source: null, clue: "Some good comes out of every misfortune", targets: ["EVERY CLOUD HAS A SILVER LINING"], start: "A SILVER CLOUD LINING EVERY HAS", explanation: "EVERY CLOUD HAS A SILVER LINING: the silver lining belongs to the cloud." },
  { id: "pr-s6", title: "Standard phrase 6", difficulty: "standard", status: "practice", source: null, clue: "Those who arrive earliest are dealt with before the rest", targets: ["FIRST COME FIRST SERVED"], start: "SERVED COME FIRST FIRST", explanation: "FIRST COME FIRST SERVED repeats FIRST. Matching the repeated tiles in order gives the minimum." },
  { id: "pr-s7", title: "Standard phrase 7", difficulty: "standard", status: "practice", source: null, clue: "You cannot improve without some effort or discomfort", targets: ["NO PAIN NO GAIN"], start: "GAIN NO NO PAIN", explanation: "NO PAIN NO GAIN repeats NO; the two NO tiles are interchangeable." },
  { id: "pr-s8", title: "Standard phrase 8", difficulty: "standard", status: "practice", source: null, clue: "Patient, regular effort beats hasty bursts", targets: ["SLOW AND STEADY WINS THE RACE"], start: "AND WINS RACE THE SLOW STEADY", explanation: "SLOW AND STEADY WINS THE RACE: the winner comes before the race." },
  { id: "pr-s9", title: "Standard phrase 9", difficulty: "standard", status: "practice", source: null, clue: "Something that looks splendid may not be valuable", targets: ["ALL THAT GLITTERS IS NOT GOLD"], start: "GLITTERS IS ALL NOT GOLD THAT", explanation: "ALL THAT GLITTERS IS NOT GOLD: the shiny thing comes first, the denial follows." },
  { id: "pr-s10", title: "Standard phrase 10", difficulty: "standard", status: "practice", source: null, clue: "Someone who never settles builds up nothing", targets: ["A ROLLING STONE GATHERS NO MOSS"], start: "MOSS ROLLING GATHERS A NO STONE", explanation: "A ROLLING STONE GATHERS NO MOSS: the stone, then what it gathers." },
  { id: "pr-s11", title: "Standard phrase 11", difficulty: "standard", status: "practice", source: null, clue: "Being apart increases affection", targets: ["ABSENCE MAKES THE HEART GROW FONDER"], start: "MAKES THE ABSENCE FONDER HEART GROW", explanation: "ABSENCE MAKES THE HEART GROW FONDER: the cause comes first, the result last." },
  { id: "pr-s12", title: "Standard phrase 12", difficulty: "standard", status: "practice", source: null, clue: "The place you belong is wherever your feelings lie", targets: ["HOME IS WHERE THE HEART IS"], start: "IS IS HEART HOME THE WHERE", explanation: "HOME IS WHERE THE HEART IS repeats IS; the two IS tiles are interchangeable." },
  { id: "pr-s13", title: "Standard phrase 13", difficulty: "standard", status: "practice", source: null, clue: "Time drags when you wait anxiously for something", targets: ["A WATCHED POT NEVER BOILS"], start: "NEVER BOILS WATCHED A POT", explanation: "A WATCHED POT NEVER BOILS: the pot, then the verb that never happens." },
  { id: "pr-e1", title: "Expert phrase 1", difficulty: "expert", status: "practice", source: null, clue: "A motto of shared loyalty, each for the group and the group for each", targets: ["ONE FOR ALL AND ALL FOR ONE", "ALL FOR ONE AND ONE FOR ALL"], start: "FOR ONE AND ALL ONE ALL FOR", explanation: "Both orders of the motto are accepted: ONE FOR ALL AND ALL FOR ONE, or ALL FOR ONE AND ONE FOR ALL. The minimum is measured to whichever is nearer." },
  { id: "pr-e2", title: "Expert phrase 2", difficulty: "expert", status: "practice", source: null, clue: "Once you are committed, you may as well go all the way", targets: ["IN FOR A PENNY IN FOR A POUND"], start: "A POUND FOR IN PENNY A IN FOR", explanation: "IN FOR A PENNY IN FOR A POUND: the small coin comes first, the larger one last." },
  { id: "pr-e3", title: "Expert phrase 3", difficulty: "expert", status: "practice", source: null, clue: "We soon forget what we no longer see", targets: ["OUT OF SIGHT OUT OF MIND"], start: "MIND OF OUT SIGHT OF OUT", explanation: "OUT OF SIGHT OUT OF MIND: seeing comes before remembering." },
  { id: "pr-e4", title: "Expert phrase 4", difficulty: "expert", status: "practice", source: null, clue: "Your actions will eventually come back to you", targets: ["WHAT GOES AROUND COMES AROUND"], start: "AROUND COMES WHAT AROUND GOES", explanation: "WHAT GOES AROUND COMES AROUND: going out comes before coming back." },
  { id: "pr-e5", title: "Expert phrase 5", difficulty: "expert", status: "practice", source: null, clue: "When abroad, follow the local customs", targets: ["WHEN IN ROME DO AS THE ROMANS DO"], start: "DO ROMANS IN AS WHEN DO THE ROME", properNouns: ["ROME", "ROMANS"], explanation: "WHEN IN ROME DO AS THE ROMANS DO: the two DO tiles are interchangeable." },
  { id: "pr-e6", title: "Expert phrase 6", difficulty: "expert", status: "practice", source: null, clue: "Talking over a worry makes it easier to bear", targets: ["A PROBLEM SHARED IS A PROBLEM HALVED"], start: "HALVED SHARED PROBLEM IS A A PROBLEM", explanation: "A PROBLEM SHARED IS A PROBLEM HALVED repeats A and PROBLEM; repeated tiles are matched in order." },
  { id: "pr-e7", title: "Expert phrase 7", difficulty: "expert", status: "practice", source: null, clue: "Words can achieve more than violence", targets: ["THE PEN IS MIGHTIER THAN THE SWORD"], start: "THAN IS THE PEN THE MIGHTIER SWORD", explanation: "THE PEN IS MIGHTIER THAN THE SWORD has two THE tiles; either can go first, so they never cost extra swaps." },
  { id: "pr-e8", title: "Expert phrase 8", difficulty: "expert", status: "practice", source: null, clue: "Rumours usually have some cause behind them", targets: ["WHERE THERE IS SMOKE THERE IS FIRE"], start: "THERE THERE WHERE FIRE IS SMOKE IS", explanation: "WHERE THERE IS SMOKE THERE IS FIRE repeats THERE and IS; repeated tiles are matched in order." },
  { id: "pr-e9", title: "Expert phrase 9", difficulty: "expert", status: "practice", source: null, clue: "Someone who helps in hard times is a true friend", targets: ["A FRIEND IN NEED IS A FRIEND INDEED"], start: "IN NEED A IS A FRIEND INDEED FRIEND", explanation: "A FRIEND IN NEED IS A FRIEND INDEED repeats A and FRIEND; repeated tiles are matched in order." },
  { id: "pr-e10", title: "Expert phrase 10", difficulty: "expert", status: "practice", source: null, clue: "A single good sign proves nothing", targets: ["ONE SWALLOW DOES NOT MAKE A SUMMER"], start: "NOT ONE A DOES SWALLOW MAKE SUMMER", explanation: "ONE SWALLOW DOES NOT MAKE A SUMMER: the bird comes first, the season last." },
  { id: "pr-e11", title: "Expert phrase 11", difficulty: "expert", status: "practice", source: null, clue: "Answering one bad deed with another does not help", targets: ["TWO WRONGS DO NOT MAKE A RIGHT"], start: "NOT DO RIGHT TWO MAKE A WRONGS", explanation: "TWO WRONGS DO NOT MAKE A RIGHT: the wrongs come before the right." },
  { id: "pr-e12", title: "Expert phrase 12", difficulty: "expert", status: "practice", source: null, clue: "An image can say more than a long description", targets: ["A PICTURE IS WORTH A THOUSAND WORDS"], start: "IS A WORTH THOUSAND WORDS PICTURE A", explanation: "A PICTURE IS WORTH A THOUSAND WORDS repeats A; the two A tiles are interchangeable." },
  { id: "pr-e13", title: "Expert phrase 13", difficulty: "expert", status: "practice", source: null, clue: "Do not decide what something is like from its outward look", targets: ["NEVER JUDGE A BOOK BY ITS COVER"], start: "JUDGE ITS BOOK COVER BY A NEVER", explanation: "NEVER JUDGE A BOOK BY ITS COVER: the warning comes first, the book and its cover last." },
  { id: "pr-e14", title: "Expert phrase 14", difficulty: "expert", status: "practice", source: null, clue: "If a problem cannot be fixed, you have to put up with it", targets: ["WHAT CANNOT BE CURED MUST BE ENDURED"], start: "BE CURED BE WHAT ENDURED CANNOT MUST", explanation: "WHAT CANNOT BE CURED MUST BE ENDURED repeats BE; the two BE tiles are interchangeable." },
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
