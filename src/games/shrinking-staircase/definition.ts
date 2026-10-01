import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "shrinking-staircase",
  title: "Shrinking Staircase",
  tagline: "Remove one letter. Keep a real word.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#885036",
    wash: "#f9e7d8",
    kicker: "The disappearing staircase",
    strap: "Less can become a little more interesting.",
    emblem: "▽",
    poster: "shrink",
  },
  rules: {
    summary: "Start from the word at the top. On each step down, remove exactly one letter, rearrange the rest and answer the clue.",
    sections: [
      {
        heading: "Stepping down",
        points: [
          "The first word is given. Each rung below has a clue and is exactly one letter shorter than the rung above.",
          "Make the answer from all the letters of the word above except one. You may rearrange them freely.",
          "You can never add a letter or swap one letter for another. If a letter appears twice, you may remove one of them and keep the other.",
          "Your answer must fit the clue as well as the letters: another word made from the same letters is not accepted.",
          "Rungs are solved in order, because each one is built from the answer above. Gentle, Standard and Expert staircases end on a familiar two-letter word; Master staircases end on a three- or four-letter word.",
          "Type your answer, or tap the letter tiles, then press Submit (or Enter). A rejected answer stays in the box so you can fix it.",
        ],
      },
      {
        heading: "More than one right answer",
        points: [
          "Some rungs accept two answers that both fit the clue, for example two spellings of the same word or two words for the same idea made from the same letters.",
          "Every accepted answer has been checked to lead all the way to the bottom, and later clues follow the answer you chose.",
        ],
      },
      {
        heading: "Changing an earlier answer",
        points: [
          "Use Revise on a solved rung to reopen it. Answers below it depend on it, so they are cleared after you confirm.",
          "Hints you have already taken stay on your record.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "Each rung you solve is worth an equal share of 100 points; the total is rounded once at the end.",
          "Wrong guesses never cost points and there is no timer.",
          "A rung filled by a hint scores 0. Revealing the whole staircase ends the round as revealed.",
          "When you finish, the result shows which letter left at each step and how the rest were rearranged.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "Letter to remove: names the letter to take out for the current rung, including which one when it appears twice.",
          "First letter: shows how the current answer begins (after the first hint).",
          "Fill this rung: completes the current rung and explains the rearrangement. That rung scores 0.",
          "Reveal the whole staircase: shows every remaining answer and ends the round.",
          "Hints always follow the answers you have chosen so far.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: five-letter starts, three rungs, direct clues, and the letter tiles are shown.",
          "Standard: six-letter starts, four rungs and tighter clues. The tiles are available if you ask for them.",
          "Expert: seven- or eight-letter starts, five or six rungs, repeated letters and some rungs with two accepted answers.",
          "Master: eight- to ten-letter starts that step down to a three- or four-letter word over five or six rungs. Clues are short and crossword-style, no tiles are shown, and answers may be uncommon words that a strong word-game player will know. Every step rearranges the letters. Where the larger word list allows a second legal word at a rung, the clue is written to point to one answer; a Master round says so when it accepts both of two spellings.",
          "Each difficulty is a different set of staircases. These labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example: "STONE, then remove S for TONE (the quality of a sound), then remove T for ONE, then remove E for ON. STONE to TUNE is not allowed: U was never there.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine with multiset checks, branch-aware hints, revision and reveal; unit tests plus exact chain validator" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/shrinking-staircase.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
