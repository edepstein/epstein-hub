import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
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
    emblem: "\u25ce",
    poster: "dossier",
  },
  rules: {
    summary: "Spot the word before the clues give it away.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
