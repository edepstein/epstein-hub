import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

export const definition: GameDefinition = {
  id: "definition-detective",
  title: "Definition Detective",
  tagline: "Spot the word before the clues give it away.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#536341",
    wash: "#edf0df",
    kicker: "The word dossier",
    strap: "Follow the evidence, then make your case.",
    emblem: "◎",
    poster: "dossier",
  },
  rules: {
    summary:
      "Each case file holds three short sentences, each with a highlighted word. Choose the definition that fits the word in that sentence, then the phrase in the sentence that most directly proves it.",
    sections: [
      {
        heading: "A case",
        points: [
          "Read the sentence. The target word is shown in bold and named above the sentence.",
          "Choose one of four definitions: the one that best fits the word as it is used in this sentence. Some words have several meanings; the sentence decides.",
          "Then choose one of three evidence phrases taken from the sentence: the one that most directly supports your definition.",
          "Press Check to submit both together. Evidence is optional: you can check a definition on its own and add evidence later.",
          "Work on the three cases in any order using the case buttons. Nothing moves on automatically.",
        ],
      },
      {
        heading: "Checking",
        points: [
          "A wrong definition gets a neutral “try again” message. It costs nothing, but you cannot submit the same wrong choice twice.",
          "A right definition is locked in. If your evidence was weaker, choose a different phrase; you keep the definition points.",
          "Correctness never depends on where an option appears: options are shuffled for each attempt and checked by their identity.",
        ],
      },
      {
        heading: "Scoring",
        points: [
          "Right definition: 80 points for the case. Right evidence: 20 more.",
          "The file score is the average of the three case scores, rounded down, out of 100.",
          "Solving all three definitions completes the file, even without evidence (80 points). You can still add evidence afterwards to raise the score.",
          "This is a practice score for this file only, not a measure of reading ability.",
        ],
      },
      {
        heading: "Hints and reveals",
        points: [
          "Hints apply to the case you have open and come in order.",
          "Where to look: points to the part of the sentence that matters.",
          "Rule out a definition: explains why one wrong definition does not fit.",
          "Reveal: shows the definition and evidence with an explanation. A revealed case scores 0 but counts as completed. If you have already solved the definition, the reveal shows only the evidence and your 80 points stand.",
          "Hints never change what you have selected. The result shows which cases you solved independently, which with help, and which were revealed.",
          "After a case is closed, Learn more gives a plain definition and a fresh example sentence.",
        ],
      },
      {
        heading: "Difficulty",
        points: [
          "Gentle: familiar words with clear context and one tempting near-miss.",
          "Standard: distinctions of intensity, register and nearby meanings.",
          "Expert: words with several senses or common confusions, where one decisive phrase settles the meaning.",
          "Master: rare and precise vocabulary of the kind a word-game expert has met, in sentences where the wrong definitions are near-synonyms or look-alike words (for example enormity, imminent versus immanent). One phrase settles the meaning; others only hint at it.",
          "Every difficulty keeps four definitions and three evidence phrases. Each has its own case files; the labels are the author's intention and have not yet been calibrated with players.",
        ],
      },
    ],
    example:
      "“Nora felt ambivalent: she wanted the promotion but dreaded leaving her team.” Ambivalent means having conflicting feelings, not indifference; the evidence is “wanted the promotion but dreaded leaving her team”.",
  },
  availability: "playable-preview",
  productionEnabled: false,
  releaseGates: [
    { gate: "Engine rules and tests", status: "passed", note: "Pure engine, 21 unit/property tests; fixture meanings, evidence text, seeded order and scoring" },
    { gate: "Browser walkthrough (keyboard, touch, refresh, hint, completion)", status: "passed", note: "tests/e2e/definition-detective.spec.ts" },
    ...STANDARD_OPEN_GATES,
  ],
};
