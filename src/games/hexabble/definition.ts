import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "hexabble",
  title: "Hexabble",
  tagline: "A strategic hexagonal word game to play together.",
  category: "Play together",
  phase: "family-bonus",
  kind: "match",
  theme: {
    accent: "#845a15",
    wash: "#fff0cc",
    kicker: "The hexagonal table",
    strap: "A whole game to share.",
    emblem: "\u2b22",
    poster: "hex",
  },
  rules: {
    summary: "A strategic hexagonal word game to play together.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
