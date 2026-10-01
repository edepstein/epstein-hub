import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "word-weave",
  title: "Word Weave",
  tagline: "Let shared letters unlock linked clues.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#256678",
    wash: "#e0f0f3",
    kicker: "The weaving room",
    strap: "Where one answer meets another.",
    emblem: "⌗",
    poster: "weave",
  },
  rules: {
    summary: "Solve a small network of crossing clued answers. Where lanes cross, they share one square, so every answer helps another.",
    sections: [
      {
        heading: "The weave",
        points: [
          "The grid holds numbered lanes reading across or down. Each lane has a clue and its length in brackets.",
          "Where an across lane meets a down lane they share one square, which holds a single letter for both answers. Changing it changes both.",
          "Blank spaces are not part of the puzzle.",
        ],
      },
      {
        heading: "Filling it in",
        points: [
          "Select a square or a clue, then type. Letters move forward along the selected lane.",
          "Arrow keys move between squares; Space switches between Across and Down at a crossing (or use the Across and Down buttons); Backspace deletes; Enter submits the grid.",
          "You can also type a whole answer for the selected lane in the answer box. It must have the right number of letters.",
          "Nothing is locked when you complete a lane: you can change any letter you typed. Only revealed letters are fixed.",
        ],
      },
      {
        heading: "Submitting and scoring",
        points: [
          "When every square is filled, press Submit grid. If any square is wrong you are told only that something is wrong, not where, and your letters stay.",
          "Your score is 100 multiplied by the share of squares you solved yourself, rounded down. Shared squares count once. Revealed squares do not score.",
          "There is no timer and no penalty for submitting more than once.",
        ],
      },
      {
        heading: "Help",
        points: [
          "Check this lane marks wrong letters in the selected lane. It changes nothing else but is recorded as help.",
          "Suggest a lane points to the unsolved lane whose crossings already give it the most support.",
          "Reveal a letter fills one square; Reveal the lane fills a whole lane, including squares it shares with crossing lanes. Revealed squares are marked and do not score.",
          "Reveal everything fills the grid and records the round as revealed rather than solved.",
          "Gentle rounds also offer a word bank listing every answer in alphabetical order. Using it is recorded as a hint.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: three or four lanes, direct definitions and an optional word bank.",
          "Standard: six five-letter lanes woven together, crossing at nine squares.",
          "Expert: seven lanes (three of seven letters, four of five) crossing at twelve squares, with clues that need the crossings to pin them down.",
          "Master: eight or nine lanes of seven to nine letters (sixteen to twenty crossings). Clues are terse definitions or cryptic-style (a definition plus wordplay such as a charade or anagram), and answers come from fuller vocabulary, including less common words. Each lane is meant to be fixed by its clue together with its crossings; where another word would fit the crossing letters, the clue is written to rule it out.",
          "Each difficulty is a different set of grids. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "CRANE (a long-legged wading bird) runs across; BARK (the outer covering of a tree trunk) runs down through its A; KITE then starts on BARK's K.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine; tests for crossings, shared squares, alternates, checks, reveals, scoring and invariants" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/word-weave.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
