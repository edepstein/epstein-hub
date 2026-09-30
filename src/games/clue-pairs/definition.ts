import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "clue-pairs",
  title: "Clue Pairs",
  tagline: "Two meanings. One answer.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#674aa0",
    wash: "#ece5fa",
    kicker: "The double take",
    strap: "A single word with two lives.",
    emblem: "\u2194",
    poster: "pair",
  },
  rules: {
    summary: "Two meanings. One answer.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
