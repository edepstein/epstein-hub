import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "daily-crossword",
  title: "Daily Crossword",
  tagline: "A small daily ritual. A bigger weekly challenge.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#4a4c50",
    wash: "#eeeae1",
    kicker: "The Sunday desk",
    strap: "Fresh clues. A familiar ritual.",
    emblem: "\uff0b",
    poster: "cross",
  },
  rules: {
    summary: "A small daily ritual. A bigger weekly challenge.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
