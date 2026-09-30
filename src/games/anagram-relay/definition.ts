import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "anagram-relay",
  title: "Anagram Relay",
  tagline: "Add one letter. Discover the next word.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#4e699b",
    wash: "#e8eef8",
    kicker: "The letter relay",
    strap: "Carry every letter. Add one more.",
    emblem: "⇄",
    poster: "relay",
  },
  rules: {
    summary: "Start from the given word. At each of three stages, keep every letter, add exactly one more, and rearrange them all to answer the clue.",
    sections: [
      {
        heading: "Running a stage",
        points: [
          "A relay has a start word and three clued stages. Each answer is exactly one letter longer than the word before it.",
          "Use every letter of the previous word, plus exactly one new letter, and rearrange them into the clued answer.",
          "You may never drop, swap or leave out a letter. Rearranging the same letters without adding one is not a move.",
          "The new letter may be one that is already there, for example a second R.",
          "Your answer must fit the clue as well as the letters: another word made from the same letters is not accepted.",
          "Only the current stage takes answers. Type your answer, or choose the added letter and tap tiles to build it, then press Submit.",
          "A rejected answer stays in the box so you can rearrange it. Wrong answers never cost points.",
        ],
      },
      {
        heading: "More than one right answer",
        points: [
          "Some stages accept two answers that both fit the clue, for example two words for the same idea made from the same letters.",
          "Every accepted answer has been checked to lead on to the end of the relay, and later stages follow the answer you chose.",
        ],
      },
      {
        heading: "Changing an earlier answer",
        points: [
          "Use Revise on a finished stage to reopen it. Later answers depend on it, so they are cleared after you confirm.",
          "One wrong attempt never disturbs stages you have already solved.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "Each stage you solve earns one third of 100 points; the total is rounded once at the end.",
          "A stage filled by a hint scores 0. Revealing the whole relay ends the round as revealed.",
          "The result lists every letter that was added and shows the whole chain.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Letter to add: names the new letter for the current stage (Gentle rounds show it from the start).",
          "Opening letters: shows the first two letters of the answer.",
          "Where the new letter goes: shows the pattern with the opening letters and the new letter in place.",
          "Fill this stage: completes the current stage (it scores 0). Reveal the whole relay: shows every remaining answer.",
          "Hints never change what you have typed, and they follow the answers you chose.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: short start words, direct clues, and the letter to add is shown. A simple plural may appear as a learning step.",
          "Standard: you work out the added letter yourself, and the rearrangements are less obvious.",
          "Expert: repeated letters, precise but less obvious clues, and some stages with two accepted answers.",
          "Each difficulty is a different set of relays. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "STARE plus N makes ASTERN (behind a ship); ASTERN plus P makes PARENTS; PARENTS plus a second R makes PARTNERS. STARE to ALERT is not allowed: it swaps S for L instead of adding.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure add-one multiset engine, exchange-one rejected, branch-aware hints, revision and reveal; exact chain validator" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/anagram-relay.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
