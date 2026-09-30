import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
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
    emblem: "\u25bd",
    poster: "shrink",
  },
  rules: {
    summary: "Remove one letter. Keep a real word.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
