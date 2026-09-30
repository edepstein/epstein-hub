import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "clue-pairs",
  title: "Clue Pairs",
  tagline: "Two meanings. One answer.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#674aa0",
    wash: "#ece5fa",
    kicker: "The double take",
    strap: "A single word with two lives.",
    emblem: "↔",
    poster: "pair",
  },
  rules: {
    summary: "Each card gives two different meanings. Find the one word, of the length shown, that fits both.",
    sections: [
      {
        heading: "Solving a card",
        points: [
          "Every round has five cards. Each card shows two definitions, Meaning 1 and Meaning 2, and the number of letters in the answer.",
          "Type one word that fits both meanings and press Submit (or Enter). Capitals and surrounding spaces do not matter.",
          "Answers are single words using A to Z: spaces, hyphens and apostrophes are not accepted.",
          "A word that fits only one of the meanings is not the answer, even if it is a real word.",
          "Solve the cards in any order using the numbered buttons. What you type on each card is kept when you switch.",
          "British spellings are used: a cold current of air is a DRAUGHT, not a DRAFT.",
        ],
      },
      {
        heading: "Guesses",
        points: [
          "A wrong guess of the right length is listed on its card. You are told only that it does not fit both meanings.",
          "A guess of the wrong length, with non-letters, or one you have already tried is explained and not counted.",
          "Wrong guesses never remove points.",
          "If you think a rejected answer should count, use Report an answer issue. The report is saved on this device for the editors.",
        ],
      },
      {
        heading: "Hints and revealing",
        points: [
          "Hints apply only to the card you are looking at; other cards are never spoiled.",
          "First letter, then Another letter: shows the answer's letters from the start, one at a time (never the whole word).",
          "Usage example (after a letter): a sentence using the answer in one of its meanings, with the answer blanked out.",
          "Reveal this card: shows the answer with both meanings explained. A revealed card scores 0.",
          "Reveal answers: after you confirm, every remaining card is revealed and the round ends as revealed.",
        ],
      },
      {
        heading: "Scoring and result",
        points: [
          "Each solved card is worth 100 divided by the number of cards (20 in a five-card round). The total is rounded once at the end.",
          "A card solved after hints still scores, but the round is marked Assisted.",
          "When every card is solved or revealed, the result shows each answer with both meanings explained, your wrong guesses and hints.",
          "No timer, no automatic advance: after solving a card, its explanation stays until you choose Next card.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle cards pair two concrete, everyday meanings.",
          "Standard cards pair a concrete meaning with a more abstract one.",
          "Expert cards use less obvious but established meanings, and the wording may point you the wrong way.",
          "Each difficulty is a different set of rounds. Labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "Meaning 1: A long-legged wading bird. Meaning 2: A machine used to lift heavy loads. (5 letters) The answer is CRANE. HERON fits only the first meaning, so it is not accepted.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine; both-meanings, length, alternates, case, hint/reveal separation, scoring and replay tests" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/clue-pairs.spec.ts" },
    { gate: "UK reference-dictionary support for both senses of every answer, and a blind solve", status: "open", note: "See docs/REVIEW-LOG.md" },
    ...STANDARD_OPEN_GATES.filter((g) => g.gate !== "Approved dictionary membership layer"),
    { gate: "Approved dictionary membership layer", status: "not-applicable", note: "Answers are checked against authored accepted lists" },
  ],
};
