import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "letter-set",
  title: "Letter Set",
  tagline: "Seven letters. Repeat them. Find the pangram.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#31694e",
    wash: "#e4efcc",
    kicker: "The word garden",
    strap: "Seven letters. Plenty of room to grow.",
    emblem: "✦",
    poster: "petals",
  },
  rules: {
    summary:
      "Make words of four or more letters using only the seven letters in the garden. Letters may be repeated as often as you like, and every word must include the letter in the middle.",
    sections: [
      {
        heading: "Making a word",
        points: [
          "Type, or tap the letters in the garden, then press Submit (or Enter). Backspace deletes a letter and Escape clears your word.",
          "Every word needs at least four letters and must include the required letter in the middle.",
          "Use only the seven letters shown. Unlike Letter Wheel, each letter can be used as many times as you like: with P, A, R, T, E, N and S, PEPPER and TRANSPARENT are fine.",
          "Only single words using A to Z count: no names, abbreviations, hyphens, spaces or apostrophes.",
          "Shuffle moves the six outer letters around. The required letter stays in the middle and the words available never change.",
        ],
      },
      {
        heading: "How entries are checked",
        points: [
          "Entries are checked in this order: length, letters outside the set, the required letter, the word list, then whether you have already found it.",
          "A rejected entry stays in the box with the reason, for example “This word needs P”, so you can correct it. Rejected entries cost nothing.",
          "Submitting a word you already have says “Already found” and changes nothing.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "A four-letter word scores 1 point. Longer words score one point per letter.",
          "An all-letter word uses every one of the seven letters at least once. It earns 7 extra points. It may be longer than seven letters and may repeat letters.",
          "The full word list sets the maximum possible score; the side panel shows it separately from the everyday list.",
        ],
      },
      {
        heading: "Everyday words and bonus words",
        points: [
          "Each set has a curated list of everyday words, including at least one all-letter word. Finding them all completes the round.",
          "Any other word in the game's word list is accepted as a bonus word and scores normally, but it does not count towards the everyday list.",
          "Completing the everyday list does not end the game: keep finding bonus words if you like, or finish to see your result at any time.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Length and first letter: for one everyday word you have not found.",
          "Definition: a short definition of that same word. Familiar words and plain inflections may have none; the hint then says so and gives the last letter instead.",
          "Reveal: adds the word to your list with its definition. It counts towards completion but scores 0 and is marked as revealed.",
          "All-letter nudge: the first letter and length of an all-letter word.",
          "Hints never block completion; your result shows how many you used and a saved game always remembers them.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle sets have plenty of familiar words and an all-letter word you are likely to know.",
          "Standard sets balance quick finds with deeper ones.",
          "Expert sets have fewer obvious words and a harder all-letter word, without relying on specialist vocabulary.",
          "Master sets are for strong Scrabble and crossword players: an awkward required letter (J, K, Q, V, W, X, Y, Z, F or H) and an uncommon all-letter word, with a target list that mixes familiar and less common words. Master rounds say \"target words\" instead of \"everyday words\", and every other word in the word list is still accepted as a bonus.",
          "Each difficulty is a different set of letters. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
      {
        heading: "Word list",
        points: [
          "Words are checked against a British English spellings list (ESDB). Plurals and verb forms count when the list includes them; names, abbreviations and some rare words do not.",
          "If a word you know is rejected, the rest of your game is unaffected.",
        ],
      },
    ],
    example:
      "With E, A, R, T, S, N and P, and P required: PART scores 1, PAPER scores 5, and TRANSPARENT scores 11 + 7 = 18 because it uses all seven letters. TEARS is rejected because it has no P.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine, 20 unit/property tests; fixture maximum scores and all-letter answers reproduced" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/letter-set.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
