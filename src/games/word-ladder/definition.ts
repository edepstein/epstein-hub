import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
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
    emblem: "\u219f",
    poster: "stairs",
  },
  rules: {
    summary: "Change one letter. Find the shortest route.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
