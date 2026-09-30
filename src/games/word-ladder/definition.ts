import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "word-ladder",
  title: "Word Ladder",
  tagline: "Change one letter. Find the shortest route.",
  category: "Word building",
  phase: "launch",
  kind: "puzzle",
  theme: {
    accent: "#a44430",
    wash: "#ffe8db",
    kicker: "The stepping stones",
    strap: "One little change can take you somewhere new.",
    emblem: "↟",
    poster: "stairs",
  },
  rules: {
    summary: "Climb from the starting word to the destination one step at a time. Each step changes exactly one letter, and every step must be a real word.",
    sections: [
      {
        heading: "Making a move",
        points: [
          "Type the next word and press Enter or Submit. It must change exactly one letter of your current word, in the same position.",
          "Every word has the same length as the start and destination. Adding, removing or rearranging letters is not allowed.",
          "Each step must be in the game's word list, and a route never repeats a word.",
          "A rejected word leaves your route unchanged; the reason is shown and your typing stays so you can correct it.",
        ],
      },
      {
        heading: "Going back",
        points: [
          "Back takes away your most recent step.",
          "You can also return to any earlier word on your route. You are asked to confirm first, because the later steps are removed.",
          "Once you reach the destination the route is locked.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "Any legal route that reaches the destination completes the round.",
          "Completing scores 60 points, plus 40 × (shortest possible moves ÷ your moves), rounded down, to a maximum of 100.",
          "Moves means the steps in your final route; steps you took back do not count against you.",
          "The shortest possible number of moves is worked out by a computer search over this game's whole word list, so it is exact for that list.",
          "Your result shows your route, a shortest example route, your moves and efficiency.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Hints are worked out from the word you are on now, not from a stored answer, so they still help after a detour.",
          "Which letter to change: marks a letter of your current word that changes on a shortest remaining route.",
          "Next word: names a word one step along a shortest remaining route.",
          "Insert the next word: adds it to your route for you. It counts as a move, is marked as a hinted step, and you can still take it back.",
          "Reveal the whole route: completes a shortest route from where you are and ends the round as revealed, with no score.",
          "Hints do not deduct points (an inserted step still counts as a move), but any hint marks your result as assisted. If no route forward avoids the words already used, the hint says so and suggests going back.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: three- and four-letter everyday words, three or four moves, and an optional word bank you can show.",
          "Standard: four- and five-letter words, four to six moves, and more side turnings.",
          "Expert: longer routes of six to eight moves where you must change some letters away from the destination before coming back.",
          "Every ladder has at least one shortest route using only everyday words. Each difficulty is a different set of ladders; the labels have not yet been calibrated with players.",
        ],
      },
      {
        heading: "Word list",
        points: [
          "Words are checked against a British English spellings list (ESDB). The optional word bank shows some useful words; it is not the full list.",
          "The original demo ladders came with small word lists; here they are played against the full list, and their shortest routes were rechecked against it.",
        ],
      },
    ],
    example: "COLD → CORD → CARD → WARD → WARM takes four moves, the shortest possible. COLD → CORD → WORD → WORM → WARM is just as good. COLD → WARM in one step is rejected because it changes four letters.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    {
      gate: "Engine rules and tests",
      status: "passed",
      note: "Single substitution, length, membership, no repeats, any legal route, BFS optimum on the pinned list, undo/backtrack, current-word BFS hints, reveal and replay covered by unit and property tests",
    },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/word-ladder.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
