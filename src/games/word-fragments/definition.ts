import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "word-fragments",
  title: "Word Fragments",
  tagline: "Rebuild words from their written pieces.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#9a4160",
    wash: "#fae6ee",
    kicker: "The word collage",
    strap: "Find the pieces that belong together.",
    emblem: "◫",
    poster: "scraps",
  },
  rules: {
    summary: "Share one tray of spelling fragments between several clued answers. Every fragment is used exactly once, and each answer is its fragments joined in order.",
    sections: [
      {
        heading: "Building the answers",
        points: [
          "Each board has three to four clued answer lanes, with the number of letters shown, and one shared tray of fragment tiles.",
          "An answer is its fragments joined together in order, with nothing added. Fragments are spelling chunks, not syllables.",
          "Every fragment must be used exactly once across the whole board, so placing a fragment in one answer means it is not available for another.",
          "Two tiles can look the same (for example two KEY tiles). They are separate tiles and either can go where that text belongs.",
          "Select a fragment, then choose Place in an answer. Select a placed fragment to move it earlier or later, into another answer, or back to the tray. No dragging is needed.",
          "A lane cannot take more letters than its answer has.",
          "Undo reverses your last move. Return all to tray asks for confirmation first.",
        ],
      },
      {
        heading: "Finishing",
        points: [
          "Press Submit board when every fragment is placed. A correct board scores 100.",
          "If something is wrong, Submit says so without pointing at which answer; your board stays as it is.",
          "Checking a single answer is optional and counts as assistance in your result.",
          "Any sharing-out that spells every accepted answer wins, not only the one the author had in mind. Boards marked One solution have been checked by a solver.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Which lane next: suggests an answer to work on and how many fragments it needs.",
          "First fragment: places the right first fragment in that lane and says where it was taken from.",
          "Complete a lane: fills one answer and locks it. Any fragments it needs are moved visibly from other lanes or the tray. Undo history is cleared at that point.",
          "Reveal the board: places every fragment and records the round as revealed, scoring 0.",
          "No hint ever uses up a fragment without telling you.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: three compound words made of whole words, such as TEA + POT.",
          "Standard: fragments split inside words, with openings and endings that look as if they could swap.",
          "Expert: four lanes with repeated fragments (several identical tiles) and pieces that could start one word or end another.",
          "Each difficulty is a different set of boards. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "With BANK, NOTE, RAIN, BOW, SUN, FLOW and ER: BANK + NOTE = BANKNOTE, RAIN + BOW = RAINBOW, SUN + FLOW + ER = SUNFLOWER. Every tile is used once.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine with tile identity, single use, finite shared inventory, undo, lane locks; exact allocation solver proves solvability and uniqueness claims" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/word-fragments.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
