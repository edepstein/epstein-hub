import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "phrase-repair",
  title: "Phrase Repair",
  tagline: "Put the familiar expression back together.",
  category: "Connections",
  phase: "deferred",
  kind: "puzzle",
  theme: {
    accent: "#8c5638",
    wash: "#faebdb",
    kicker: "The phrase press",
    strap: "A familiar saying, freshly rearranged.",
    emblem: "“",
    poster: "tickets",
  },
  rules: {
    summary: "Swap neighbouring word tiles to restore the familiar phrase described by the clue. Any correct repair completes the round; fewer swaps score more.",
    sections: [
      {
        heading: "Repairing the phrase",
        points: [
          "The clue describes a familiar British phrase or proverb. The numbers show the letters in each word, in order.",
          "The words are on tiles in the wrong order. Use a tile's left or right arrow to swap it with its neighbour: one move is always one swap of two tiles next to each other.",
          "Tiles that are not next to each other cannot swap in one move; move a tile step by step instead. No dragging is needed.",
          "Repeated words (for example two THEs) are separate tiles, and either one can go in either place.",
          "Press Check phrase when you think the tiles read correctly. A wrong check costs nothing and leaves the tiles where they are.",
          "Some phrases accept more than one order when both are genuinely in use; any accepted order completes the round.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "A correct repair scores 60 points, plus 40 × (minimum swaps ÷ your swaps), rounded down. Repairing in the minimum scores 100.",
          "The minimum is worked out exactly from the starting order: it is the number of word pairs that start the wrong way round relative to each other.",
          "Undo swaps the last pair back. Because it changes the board, it counts as another swap.",
          "Restart begins a fresh attempt with a fresh count; your best earlier result on this device is still shown.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "First word: shows how the phrase begins.",
          "A tile in place: marks one tile that is already in its final position. It is not locked.",
          "Efficient next move: names a neighbouring swap that brings the phrase one step closer. You can ask again at any time; your swaps still count.",
          "Reveal the phrase: puts every tile in place and records the round as revealed, scoring 0.",
          "Hints do not cost points, but the result shows how many you used.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: short phrases of three to five words with direct clues.",
          "Standard: proverbs of four to six words with less direct clues.",
          "Expert: up to eight words with repeated words and fewer obvious anchors; one phrase accepts either of its two common orders.",
          "Master: eight to twelve words, always with repeated words, taken from proverbs, idioms and well-known quotations. Only the exact wording is accepted, plus any order the round says is also in common use; a plausible rearrangement that is not the real saying will not count. Long boards can take many swaps, and the minimum is still worked out exactly.",
          "Each difficulty is a different set of phrases. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "SPILT OVER MILK CRY becomes CRY OVER SPILT MILK in four swaps, the minimum, for 100 points. Doing it in eight swaps scores 60 + 40 × 4 ÷ 8 = 80.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure adjacent-swap engine with token identities, exact minimum (inversions with order-preserving duplicate matching, checked by exhaustive search), undo counting and alternate endpoints" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/phrase-repair.spec.ts" },
    { gate: "Independent semantic review of alternative phrase orders (deferred-release warning)", status: "open" },
    ...STANDARD_OPEN_GATES,
  ],
};
