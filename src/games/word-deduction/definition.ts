import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "word-deduction",
  title: "Word Deduction",
  tagline: "Find the hidden five-letter word.",
  category: "Deduction",
  phase: "launch",
  kind: "puzzle",
  theme: {
    accent: "#315bd1",
    wash: "#e7edff",
    kicker: "The code room",
    strap: "Every guess brings the answer into focus.",
    emblem: "?",
    poster: "code",
  },
  rules: {
    summary: "Find the hidden five-letter word in six guesses. After each guess, every letter is marked: correct place (✓), in the word elsewhere (↔) or not in the word (×).",
    sections: [
      {
        heading: "Guessing",
        points: [
          "Type a five-letter word, or tap the on-screen keyboard, then press Enter or Submit.",
          "Each guess must be a real word from the game's word list. Anything else is rejected with a reason and does not use a guess; your letters stay so you can correct them.",
          "Guessing the same word twice is also rejected at no cost.",
          "You have six guesses. Guessing the answer wins straight away.",
        ],
      },
      {
        heading: "Reading the feedback",
        points: [
          "✓ Correct place: this letter is in the answer in exactly this position.",
          "↔ Elsewhere: this letter is in the answer, but in a different position.",
          "× Absent: there is no further copy of this letter in the answer.",
          "Repeated letters are counted exactly. Exact matches are marked first; then each remaining copy of a letter in the answer is given to the leftmost unmatched copy in your guess. So if the answer has one E and you guess two, only one of them can be marked.",
          "Every mark is shown as a symbol and in words for screen readers, as well as by colour.",
          "The keyboard shows the best thing you know about each letter: ✓ beats ↔ beats ×. A ✓ on the keyboard does not mean every copy of that letter belongs in the answer.",
        ],
      },
      {
        heading: "Running out of guesses",
        points: [
          "After six guesses without the answer, the round is recorded as not solved.",
          "You can then reveal the answer and its meaning, or keep guessing with three extra rows at a time. Extra rows are marked assisted, and a later solve never replaces the not-solved result.",
        ],
      },
      {
        heading: "Hints",
        points: [
          "A letter you have not tried: names a letter in the answer that none of your guesses has used.",
          "First letter, then a letter in place: shows the letter in the first position you have not yet confirmed.",
          "Reveal the answer: shows the word and its meaning, and ends the round as revealed.",
          "Hints never use a guess. Any hint marks your result as assisted, and that mark stays for the whole round.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: very familiar answers with mostly different letters. A first-letter clue is offered before you start, if you want it.",
          "Standard: everyday answers, some with repeated letters, and no clue offered at the start.",
          "Expert: answers from crowded word families (think of all the words ending -IGHT), played in hard mode.",
          "Hard mode: every guess must keep revealed ✓ letters in place, include every letter shown to be in the answer (as many copies as shown), and not put a letter back in a place already marked ↔. Letters marked × are not banned outright, because a repeated letter can be × in one place and ✓ elsewhere. Hint letters count as revealed too.",
          "Master: respectable but less common words (think SYLPH or FJORD, not CHAIR), with unusual letter patterns, also in hard mode. Guesses may be any word in the word list, so you can still use ordinary words to narrow the field. Master keeps the same six guesses: hard mode already limits your choices, and the word list is the same for every difficulty.",
          "You can switch hard mode off for the rest of an Expert or Master round; your result will say so.",
          "Each difficulty is a different set of answers. The labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
      {
        heading: "Result and sharing",
        points: [
          "Your result shows how many guesses you used, any hints, extra rows or reveal, and whether hard mode was kept.",
          "The shared result is a grid of ✓ ↔ × symbols with no letters, so it never gives the answer away.",
          "Words are checked against a British English spellings list (ESDB). Answers are chosen separately: everyday words, except on Master, where they are less common but real words with a stated meaning.",
        ],
      },
    ],
    example:
      "If the answer is CRANE and you guess EERIE, you see × × ↔ × ✓: the last E is in the right place, R is in the word elsewhere, and the first two Es are marked × because the answer has only one E and it was already matched.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    {
      gate: "Engine rules and tests",
      status: "passed",
      note: "Two-pass duplicate feedback (EERIE/CRANE, ALLEY/APPLE), zero-cost rejections, six-guess limit, hard-mode constraints, hints, extension and replay covered by unit and property tests",
    },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/word-deduction.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
