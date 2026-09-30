import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "cryptic-workshop",
  title: "Cryptic Workshop",
  tagline: "Solve the clue. Understand the trick.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#8a5233",
    wash: "#f5e7d4",
    kicker: "The clue workshop",
    strap: "Unpick the clue. Enjoy the penny dropping.",
    emblem: "✎",
    poster: "notes",
  },
  rules: {
    summary: "A workshop session of three cryptic clues. Each clue has a definition at one end and wordplay that builds the same answer. Solve them in any order; hints teach the trick step by step.",
    sections: [
      {
        heading: "How a cryptic clue works",
        points: [
          "Every clue has two parts: a definition (a plain meaning of the answer, always at the start or the end) and wordplay (a second route to the same letters).",
          "An indicator word tells you which kind of wordplay, or device, is in use. For example \"upset\" or \"broken\" often signals an anagram, and \"returned\" a reversal.",
          "The numbers in brackets give the answer's length, for example (6), or (4,3) for two words.",
          "Read the surface for its meaning, then read it again as a set of instructions.",
        ],
      },
      {
        heading: "Devices you will meet",
        points: [
          "Anagram: rearrange the letters of some words in the clue.",
          "Hidden word: the answer sits inside consecutive letters of the clue, often across a space.",
          "Reversal: write a word backwards.",
          "Charade: join parts one after another.",
          "Container: put one part inside another.",
          "Deletion: remove a letter, for example the first (\"headless\").",
          "Initial letters: take the first letter of several words.",
          "Double definition: two different meanings of one word, side by side.",
          "Homophone: the answer sounds like another word (\"we hear\"). These are kept to standard UK pronunciation.",
          "Only a few familiar abbreviations are used: TA for thanks, O for ring, E for energy, T for time, P for quiet.",
        ],
      },
      {
        heading: "Playing a workshop",
        points: [
          "Choose a clue from the tabs, type your answer and press Submit (or Enter). Clues can be solved in any order.",
          "Your answer must have exactly the number of letters in the brackets. Spaces, capitals and hyphens are ignored when checking.",
          "A wrong answer is not recorded against you: it is simply not accepted, and your letters stay so you can adjust them.",
          "When a clue is solved or revealed, its explanation card opens: definition, device, indicator, wordplay material and the exact letter operation.",
          "Move on with Next clue when you are ready. Nothing advances automatically and there is no timer.",
        ],
      },
      {
        heading: "Hints, step by step",
        points: [
          "Each clue has its own ladder, taken in order: 1 identify the definition, 2 name the device, 3 highlight the indicator, 4 show the wordplay material, 5 show some letters.",
          "Highlights appear in the clue itself: the definition is underlined, the indicator is boxed and the wordplay material has a wavy underline, each also labelled in words.",
          "Hints never cost points. Your result records how many you took.",
          "Reveal the answer is available at any time after a confirmation. A revealed clue scores 0 and marks the round as assisted.",
          "Reveal all remaining ends the workshop with a revealed result.",
        ],
      },
      {
        heading: "Naming the device (optional practice)",
        points: [
          "Gentle clues name their device for you.",
          "Standard clues offer a list of devices to practise naming before or after you solve. It never blocks answering.",
          "Expert clues keep that list closed until you ask for it.",
          "A correct guess also counts as knowing the device, so the hint ladder skips that step. Guesses earn no points and cost nothing.",
        ],
      },
      {
        heading: "Scoring and difficulty",
        points: [
          "Each clue is worth an equal share of 100, rounded once at the end. Only clues you solve yourself score.",
          "Gentle: direct definitions and a single named device (anagram, hidden word, reversal or initial letters).",
          "Standard: no device label, smoother surface readings, and charades, containers and double definitions join in.",
          "Expert: subtler indicators and definitions, and at most two devices combined in one clue.",
          "Each difficulty is a different set of clues. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "\"Quiet: listen, upset (6)\". The definition is \"Quiet\"; \"upset\" signals an anagram of LISTEN, giving SILENT.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine and construction checker with unit tests (anagram, hidden offset, reversal, charade, container, deletion, initials)" },
    { gate: "Mechanical clue validation", status: "passed", note: "Every clue's wordplay is recomputed by validate.ts; semantic review is still open" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/cryptic-workshop.spec.ts" },
    { gate: "Second-editor semantic review of every clue (docs/05)", status: "open", note: "All 36 original clues are listed in docs/REVIEW-LOG.md" },
    ...STANDARD_OPEN_GATES,
  ],
};
