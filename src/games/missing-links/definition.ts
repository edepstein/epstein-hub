import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "missing-links",
  title: "Missing Links",
  tagline: "One word belongs between both.",
  category: "Connections",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#34687b",
    wash: "#e4eff5",
    kicker: "The bridge club",
    strap: "Two ends. One very good connection.",
    emblem: "∞",
    poster: "bridge",
  },
  rules: {
    summary:
      "Each board shows three or four word pieces with a blank before or after them. Find the one missing word that turns every piece into a real one-word compound matching its definition.",
    sections: [
      {
        heading: "A board",
        points: [
          "Each branch shows a fixed word and a blank. The arrow and the words “blank before” or “blank after” tell you which side the missing word goes on.",
          "The same missing word completes every branch. For example, with DAY + blank, MOON + blank and blank + HOUSE, the link is LIGHT: DAYLIGHT, MOONLIGHT and LIGHTHOUSE.",
          "Each branch has a definition, and the finished compound must match it.",
          "The number of letters in the missing word is always shown.",
          "A round holds several boards. Work on them in any order using the board buttons; nothing moves on automatically.",
        ],
      },
      {
        heading: "Entering a link",
        points: [
          "Type only the missing word and press Submit (or Enter). Typing the whole compound is explained, not counted.",
          "Every compound is written as one closed word, so the link never needs a space, hyphen or apostrophe. Entries containing them are refused with a reason.",
          "The link joins on exactly as shown: no letters are added, dropped or re-ordered. HOUSELIGHT is not LIGHTHOUSE.",
          "A word of the wrong length is refused without counting as a guess, and your entry stays so you can correct it.",
          "A wrong guess costs nothing. You are told how many branches it makes a word in; you can ask to see which branches failed.",
          "Where two links genuinely fit every branch and definition (for example DOOR or GATE), either is accepted.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "Each correct link scores 100 points. Guesses, hints and word-bank use are recorded separately and do not reduce the score.",
          "A revealed board scores 0 and is recorded as revealed, distinct from a solve.",
          "The result lists each board as solved unaided, solved with help, revealed or left unexplored.",
        ],
      },
      {
        heading: "Hints and the word bank",
        points: [
          "Hints apply to the board you have selected and come in order: the first letter of the link, then one completed branch, then a full reveal.",
          "A completed branch never enters an answer for you.",
          "Gentle rounds show a word bank of possible links as part of normal play. In Standard and Expert the bank is hidden; opening it marks that board as solved with help.",
          "Tap a bank word to put it in the answer box; you still choose when to submit.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: concrete everyday compounds, three branches and a visible word bank.",
          "Standard: blanks before and after, less obvious links and a hidden bank.",
          "Expert: four branches per board, with plausible competing words that fit some branches but not all.",
          "Each difficulty has its own rounds. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
      {
        heading: "Word list",
        points: [
          "Every compound is checked against a British English spellings list (ESDB) as a single closed word. Phrases usually written as two words are not used.",
        ],
      },
    ],
    example: "NOTE + blank, blank + CASE and blank + MARK: the link is BOOK (NOTEBOOK, BOOKCASE, BOOKMARK). BOOKS is refused as the wrong length.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine, 21 unit/property tests; canonical boards, alternates and exhaustive alternative-link search" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/missing-links.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
