import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "daily-crossword",
  title: "Daily Crossword",
  tagline: "A small daily ritual. A bigger weekly challenge.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#4a4c50",
    wash: "#eeeae1",
    kicker: "The Sunday desk",
    strap: "Fresh clues. A familiar ritual.",
    emblem: "＋",
    poster: "cross",
  },
  rules: {
    summary: "Fill the grid from the Across and Down clues. Every crossing letter is shared, so each answer helps with the next. Quick and Cryptic are separate styles, not measures of ability.",
    sections: [
      {
        heading: "The grid",
        points: [
          "Each white square holds one letter. Numbers mark where answers start; one number can start both an Across and a Down answer.",
          "The numbers in brackets give the answer's length, for example (7), or (4,3) for two words. Type letters only: spaces and hyphens are not entered in the grid.",
          "Some squares belong to only one answer. Those letters come from that clue alone.",
        ],
      },
      {
        heading: "Moving and typing",
        points: [
          "Tap or click a square to select it. Tap the selected square again, or press Space or Enter, to switch between Across and Down.",
          "Typing a letter fills the square and moves to the next square of the answer.",
          "Backspace clears the square; on an empty square it moves back and clears the one before. Delete clears without moving.",
          "Arrow keys move around the grid, jumping over black squares. Home and End go to the start or end of the answer.",
          "Tab and Shift+Tab move to the next or previous clue. The clue lists are buttons too: choose a clue to jump to it.",
          "The bar above the grid always shows the selected clue, and the list highlights it with a marker.",
        ],
      },
      {
        heading: "Answering by clue",
        points: [
          "Under the grid, the Answer the selected clue box lets you type or paste a whole answer. It must have exactly the right number of letters.",
          "Pasting into the grid fills the selected answer from the selected square onwards.",
          "Wrong letters are allowed while you solve. Nothing tells you they are wrong unless you ask for a check.",
        ],
      },
      {
        heading: "Pencil",
        points: [
          "Turn Pencil on to write tentative letters. They appear in italics with a dotted underline.",
          "A grid containing pencil letters is not marked; use Ink pencil letters when you are sure.",
        ],
      },
      {
        heading: "Checking and revealing",
        points: [
          "Check a letter, the selected answer or the whole grid. Wrong letters get a cross (✗) and a slash; right ones a small tick (✓). The mark disappears when you change the letter.",
          "Reveal a letter, the selected answer or the whole grid. Revealed letters are marked with a dot (●) and cannot be changed.",
          "Checks and reveals are optional and are recorded in your result. Revealing the whole grid ends the puzzle with a revealed result.",
        ],
      },
      {
        heading: "Finishing",
        points: [
          "When every square is filled in ink the grid is checked automatically. If something is wrong you are told that some entries need another look, without being told where.",
          "When everything is right the puzzle is complete. The result shows the style, your checks and reveals, and every answer with its clue. Cryptic answers include an explanation of the wordplay.",
          "There is no timer.",
        ],
      },
      {
        heading: "Styles and difficulty",
        points: [
          "Quick clues are straightforward definitions. Cryptic clues each combine a definition with wordplay, as in the Cryptic Workshop.",
          "Gentle: familiar words and direct clues. Standard: richer vocabulary and fair misdirection. Expert: clues that need interpretation, or multi-step cryptic wordplay.",
          "Each difficulty has both styles, and each puzzle is a different grid. A small grid is not automatically easy. These labels are the author's intention and have not yet been calibrated with players.",
          "Grids follow a house style: rotationally symmetric, answers of at least three letters, at least half the letters of each answer crossed by another answer. The two word-square demos are engine test boards from the original pack.",
        ],
      },
      {
        heading: "Zoom",
        points: ["Use the zoom buttons to enlarge the grid. A larger grid scrolls inside its own frame, so the clues and tools stay in place."],
      },
    ],
    example: "In a quick crossword, \"Head of a town council (5)\" is MAYOR. Its first letter M is shared with the Down answer that crosses it.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine, geometry, numbering and cursor tests; grid validator for crossings, coverage, connectivity and symmetry" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, check, reveal, completion)", status: "passed", note: "tests/e2e/daily-crossword.spec.ts" },
    { gate: "Two independent solves of every Quick and Cryptic grid (games/daily-crossword.md)", status: "open", note: "Grids and clues are listed in docs/REVIEW-LOG.md" },
    { gate: "Printable proof and clue database", status: "open" },
    ...STANDARD_OPEN_GATES,
  ],
};
