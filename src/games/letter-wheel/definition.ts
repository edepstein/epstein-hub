import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "letter-wheel",
  title: "Letter Wheel",
  tagline: "One essential letter. A whole world of words.",
  category: "Word building",
  phase: "launch",
  kind: "puzzle",
  theme: {
    accent: "#6845a5",
    wash: "#eee5ff",
    kicker: "The letter observatory",
    strap: "A little orbit of possibilities.",
    emblem: "A",
    poster: "orbit",
  },
  rules: {
    summary: "One essential letter. A whole world of words.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
