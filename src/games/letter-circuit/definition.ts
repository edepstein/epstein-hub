import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "letter-circuit",
  title: "Letter Circuit",
  tagline: "Cross sides. Link words. Use every letter.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#166c79",
    wash: "#def2f0",
    kicker: "The circuit studio",
    strap: "A good word leads to another.",
    emblem: "\u25a1",
    poster: "circuit",
  },
  rules: {
    summary: "Cross sides. Link words. Use every letter.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
