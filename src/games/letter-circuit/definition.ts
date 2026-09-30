import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "letter-circuit",
  title: "Letter Circuit",
  tagline: "Cross sides. Link words. Use every letter.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#166c79",
    wash: "#def2f0",
    kicker: "The circuit studio",
    strap: "A good word leads to another.",
    emblem: "□",
    poster: "circuit",
  },
  rules: {
    summary: "Make a chain of words from twelve letters on four sides. Consecutive letters must come from different sides, each word starts with the last letter of the one before, and the chain must use every letter.",
    sections: [
      {
        heading: "Making a word",
        points: [
          "Twelve different letters sit on four sides of a square: top, right, bottom and left, three on each.",
          "Words need at least three letters and may use only letters on the board.",
          "Consecutive letters in a word must come from different sides. HAT is fine if H, A and T are on three different sides, but not if A and T share a side.",
          "You may reuse a letter, even within one word, as long as each step changes side.",
          "Type the word, or tap the letters. Letters on the same side as the one you just used are marked as unavailable. Press Submit or Enter.",
          "Words are checked against a British English word list. A rejected word is kept so you can correct it, and nothing is lost.",
        ],
      },
      {
        heading: "Building the chain",
        points: [
          "After the first word, every word must start with the last letter of the previous word. That letter is filled in for you.",
          "The aim is to use all twelve letters at least once across the whole chain. The letters still to use are listed under the board.",
          "A word does not have to add a new letter: a bridge word that only moves you to a better ending letter is allowed.",
          "Undo removes the last word. Any letter that only that word used goes back on the to-use list.",
          "Start a new chain clears the current chain. Your best completed chain is always kept.",
        ],
      },
      {
        heading: "Par and your result",
        points: [
          "Fewer words is better. Ties are broken by fewer letters in total.",
          "Par is the fewest words a computer search could complete the circuit with, using only a list of everyday words of three to eight letters. The search checks every possible chain, so par is exact for that list.",
          "Because you may use any word in the full word list, it is sometimes possible to beat par.",
          "When you complete the circuit, your result shows your chain, word count and par. You can then try for fewer words; your best is kept, and Back to my best returns to it.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Letters to aim for: the first letter, length and new letters of a word that starts where your chain ends and lies on a shortest everyday route to the finish.",
          "Show the word: shows that word. You still type it in.",
          "Play it for me: adds that word to your chain, marked as played for you.",
          "Any hint marks the chain you finish as helped. Hints never block you from finishing.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle boards have hundreds of everyday words and many routes; par is two.",
          "Standard boards have fewer everyday words, no two-word finish, and need planning around the letters left over.",
          "Expert boards have awkward letters and only a few everyday routes; par is four.",
          "Each difficulty is a different set of boards. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "With sides ADT, EFR, CIL and NOS, the chain COLD → DRAFT → TRAIN → NEST uses all twelve letters in four words. TAD is rejected because T and A are both on the top side.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine with breadth-first par proof; unit and property tests for sides, chaining, bridges, undo, best-chain retention and hints" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/letter-circuit.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
