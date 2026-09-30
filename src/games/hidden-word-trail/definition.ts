import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "hidden-word-trail",
  title: "Hidden Word Trail",
  tagline: "Trace the theme through every square.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#326b54",
    wash: "#e3efdd",
    kicker: "The garden path",
    strap: "Follow a thought through the garden.",
    emblem: "↝",
    poster: "path",
  },
  rules: {
    summary: "Trace themed words through touching squares. Together, the theme words use every square on the grid exactly once.",
    sections: [
      {
        heading: "Tracing a trail",
        points: [
          "Start on any square, then add squares one at a time. Each new square must touch the last one: up, down, left, right or diagonally.",
          "A square cannot be used twice in the same trail, and trails cannot pass through squares that already belong to a found word.",
          "Tap squares in order, or drag across them. Tapping the last square again removes it; tapping the square before it steps back one. Clear starts the trail again.",
          "On a keyboard: arrow keys move between squares, Space adds the focused square, Backspace removes the last square, Escape clears the trail and Enter submits it.",
          "The letters of your current trail are always shown as text above the grid, with their row and column.",
          "Press Submit to check the trail. Nothing happens until you submit, and an unfinished trail is saved if you leave.",
        ],
      },
      {
        heading: "Theme words",
        points: [
          "The theme is shown above the grid. Every square belongs to exactly one theme word, so when all are found the grid is completely covered.",
          "Some rounds include a longer answer that names the theme itself. It is marked when found and explained in the result, but it scores no differently.",
          "A word may be traceable along more than one route. Any route is accepted as long as the remaining theme words can still fill the squares that are left.",
          "If your route would leave squares that the remaining theme words cannot fill, it is not accepted and you are told why; try another route for the same word.",
        ],
      },
      {
        heading: "Bonus words and hints",
        points: [
          "Real words of four or more letters that are not theme words earn one bonus credit each, once per word per round. Three bonus credits earn one free hint.",
          "The original demo rounds have no bonus words; hints there are always the ordinary kind.",
          "Starting square: marks the first square of a theme word you have not found and gives its length (and a short clue in newer rounds).",
          "Half the trail: marks the first half of that word's squares.",
          "Reveal the word: places it on the grid. Revealed words are marked as help in your result.",
          "Reveal everything: fills in the rest and records the round as revealed rather than solved.",
          "A hint paid for with bonus credits is not counted as help. Other hints are counted, but nothing ever blocks you from finishing.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: small grids, a plain theme and trails with few turns.",
          "Standard: larger grids and trails that change direction and cross row boundaries.",
          "Expert: an indirect theme with a theme-naming answer, longer trails with many turns, and letters shared between several words.",
          "Each difficulty is a different set of grids. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
      {
        heading: "Result",
        points: [
          "There is no timer and no penalty for exploring. Your result shows how many theme words you found yourself, which were revealed, your bonus words and the hints you used.",
          "Every newer grid has been checked by computer: the theme words fit together to cover every square.",
        ],
      },
    ],
    example: "On a grid whose top row reads T R E E, the trail T → R → E → E spells TREE. A trail that jumps from T to the second E is rejected because those squares do not touch.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine with exact-cover feasibility; unit tests cover adjacency, reuse, overlap, alternate and stranding routes, hints and replay" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/hidden-word-trail.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
