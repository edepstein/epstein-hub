import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "letter-wheel",
  title: "Letter Wheel",
  tagline: "One essential letter. A whole world of words.",
  category: "Word building",
  phase: "launch",
  kind: "puzzle",
  theme: {
    accent: "#6845a5",
    wash: "#eee5ff",
    kicker: "The letter observatory",
    strap: "A little orbit of possibilities.",
    emblem: "A",
    poster: "orbit",
  },
  rules: {
    summary: "Make words of four or more letters from the nine on the wheel. Every word must use the centre letter, and each wheel letter once at most.",
    sections: [
      {
        heading: "Making a word",
        points: [
          "Type, or tap the letters on the wheel, then press Submit (or Enter).",
          "Every word needs at least four letters and must include the centre letter.",
          "Each of the nine positions can be used once per word. If the wheel shows two of a letter, you may use it twice.",
          "Only single words using A to Z count: no names, abbreviations, hyphens, spaces or apostrophes.",
          "Shuffle rearranges the display only; it never changes which words are possible.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "Each word scores one point per letter.",
          "A nine-letter word, using every position, earns a further nine points.",
          "Rejected and repeated entries cost nothing; the reason is shown and your letters stay so you can correct them.",
        ],
      },
      {
        heading: "Everyday words and bonus words",
        points: [
          "Each wheel has a curated list of everyday words. Finding them all completes the round.",
          "Any other word in the game's word list is accepted as a bonus word and scores normally.",
          "After completing, you can keep hunting for bonus words; your result updates as you go.",
          "Finish at any time to see what you found and how much was left unexplored.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Starting letter: the first letter and length of an everyday word you have not found.",
          "First half: the first half of that same word.",
          "Reveal: adds the word to your list. It counts towards completion but scores 0.",
          "Nine-letter nudge: the first letter of a nine-letter answer.",
          "Hints never block completion; your result shows how many you used.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle wheels have fewer everyday words and a vowel in the centre.",
          "Standard wheels have more words to find.",
          "Expert wheels put an awkward consonant in the centre, so familiar words are harder to spot.",
          "Each difficulty is a different wheel. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
      {
        heading: "Word list",
        points: [
          "Words are checked against a British English spellings list (ESDB). British -ise and recognised -ize spellings are accepted.",
          "The list is large but not every word you know may be in it; the rest of your game is unaffected if a word is rejected.",
        ],
      },
    ],
    example: "On a wheel with E D U C A T I O N and A in the centre, ACTION scores 6 and EDUCATION scores 9 + 9 = 18. DUCT is rejected because it has no A.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine, 15 unit/property tests, fixture maximum scores reproduced" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/letter-wheel.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
