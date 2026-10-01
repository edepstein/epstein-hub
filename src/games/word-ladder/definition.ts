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
          "Completing scores 60 points, plus 40 × (par ÷ your moves), rounded down, to a maximum of 100. Beating par scores 100.",
          "Moves means the steps in your final route; steps you took back do not count against you.",
          "Par is worked out by a computer search. In Gentle, Standard and Expert rounds it is the shortest route using everyday words, and any word in the game's full word list is a legal step, so you may find a shorter route through less common words; that beats par and scores 100.",
          "In Master rounds par is the shortest route over the whole word list, Scrabble-grade words included, so it cannot be beaten. The round tells you which kind of par it uses.",
          "Your result shows your route, an example par route, your moves and efficiency.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Hints are worked out from the word you are on now, not from a stored answer, so they still help after a detour.",
          "Which letter to change: marks a letter of your current word that changes on a par route from where you are.",
          "Next word: names a word one step along a par route from where you are. In Master rounds this may be an uncommon word.",
          "Insert the next word: adds it to your route for you. It counts as a move, is marked as a hinted step, and you can still take it back.",
          "Reveal the whole route: completes a par route from where you are and ends the round as revealed, with no score.",
          "Hints do not deduct points (an inserted step still counts as a move), but any hint marks your result as assisted. If no route forward avoids the words already used, the hint says so and suggests going back.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: three- and four-letter everyday words, three or four moves, and an optional word bank you can show.",
          "Standard: four- and five-letter words, four to six moves, and more side turnings.",
          "Expert: longer routes of six to eight moves where you must change some letters away from the destination before coming back.",
          "Master: four- to six-letter ladders, five to nine moves, where par is the shortest route over the whole word list. Everyday words alone cannot match par (they need at least two more moves, or cannot get there at all), so you need real vocabulary: words like ERGS, BESOM or GANTRY. There is no word bank, and the example route shown afterwards uses only familiar and uncommon words.",
          "Outside Master, par is always a route of everyday words only. Each difficulty is a different set of ladders; the labels have not yet been calibrated with players.",
        ],
      },
      {
        heading: "Word list",
        points: [
          "Words are checked against a British English spellings list (ESDB). The optional word bank shows some useful words; it is not the full list.",
          "The original demo ladders came with small word lists; here par is recalculated over everyday words (or over the full list in Master rounds), and any word in the full list is a legal step.",
        ],
      },
    ],
    example: "COLD → CORD → CARD → WARD → WARM takes four moves, which is par. COLD → CORD → WORD → WORM → WARM is just as good. COLD → WARM in one step is rejected because it changes four letters.",
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
