import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "word-fragments",
  title: "Word Fragments",
  tagline: "Rebuild words from their written pieces.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#9a4160",
    wash: "#fae6ee",
    kicker: "The word collage",
    strap: "Find the pieces that belong together.",
    emblem: "\u25eb",
    poster: "scraps",
  },
  rules: {
    summary: "Rebuild words from their written pieces.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
