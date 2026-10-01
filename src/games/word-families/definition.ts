import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "word-families",
  title: "Word Families",
  tagline: "Four groups. Connections worth discovering.",
  category: "Connections",
  phase: "launch",
  kind: "puzzle",
  theme: {
    accent: "#91435c",
    wash: "#f7e4ea",
    kicker: "The connection collection",
    strap: "Small discoveries, satisfying connections.",
    emblem: "▦",
    poster: "groups",
  },
  rules: {
    summary: "Sort the tiles into groups of four that share one precise connection. Every tile belongs to exactly one group.",
    sections: [
      {
        heading: "Making a group",
        points: [
          "Select exactly four tiles, then press Check group. Order does not matter.",
          "Tap a selected tile again to deselect it, or press Clear selection.",
          "A correct group moves into a solved row with its category and an explanation.",
          "Solved tiles leave the board and cannot be selected again.",
          "A tile may contain more than one word (for example FULL STOP); it is still one tile.",
        ],
      },
      {
        heading: "Mistakes",
        points: [
          "Checking four tiles that are not a group costs one mistake. Your selection stays so you can adjust it.",
          "If exactly three of your four tiles belong to the same unsolved group, you are told you are one away. Nothing else about the wrong group is revealed.",
          "Checking a group you have already tried (in any order) costs nothing and tells you so.",
          "Selecting fewer or more than four tiles is never a mistake.",
          "You have four mistakes (three on Master boards). When they are used you can continue (your result is marked as an assisted continuation), take a hint or reveal the answers. The round never ends by force.",
        ],
      },
      {
        heading: "Hints and revealing",
        points: [
          "Name a category: shows the category of one unsolved group.",
          "Two that belong together: names two tiles from that same group.",
          "Reveal a group: solves that group for you. It counts as revealed, not found.",
          "Reveal answers: shows every remaining group after you confirm. The round then ends as revealed.",
          "Every hint is recorded in your result.",
        ],
      },
      {
        heading: "Result",
        points: [
          "Your result shows groups found by you, groups revealed, mistakes and hints. There is no timer and no speed bonus.",
          "Every connection is explained at the end, including the full compound words.",
          "The share text shows one dot per group (● found, ○ revealed) and no answers.",
        ],
      },
      {
        heading: "Keyboard",
        points: [
          "Tab to the board, then use the arrow keys to move between tiles.",
          "Space selects or deselects a tile. Enter checks the group. Escape clears the selection.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle boards have three direct groups of twelve tiles (the original starter demo has four).",
          "Standard boards have four groups, mixing ordinary categories with a word-building one such as words before BALL, and a few tiles that seem to fit two groups.",
          "Expert boards are built around deliberate overlaps: several tiles fit two groups, and only one complete arrangement uses all sixteen.",
          "Master boards are built for crossword-fluent players: hidden smaller words, anagrams, words that gain a letter, sound-alikes and compound words. Many tiles fit two or more groups (some groups have five or more candidates), yet exactly one complete arrangement uses all sixteen, checked by exhaustive search. Master boards allow three mistakes instead of four.",
          "Each difficulty is a different set of boards. Labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example:
      "ROBIN, CRANE, EAGLE and SWAN are all birds. CRANE is also a lifting machine, but there is no machine group, so it belongs with the birds.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine; exact-size, mixed, repeated, one-away, budget, hints, reveal and replay tests" },
    { gate: "Mechanical partition validation", status: "passed", note: "Exact cover, unique labels, spoiler-free titles; semantic uniqueness still needs editors" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/word-families.spec.ts" },
    { gate: "Two independent editors solve blind and propose rival partitions", status: "open", note: "Red herrings logged in docs/REVIEW-LOG.md" },
    ...STANDARD_OPEN_GATES.filter((g) => g.gate !== "Approved dictionary membership layer"),
    { gate: "Approved dictionary membership layer", status: "not-applicable", note: "Tiles are authored terms, not typed words" },
  ],
};
