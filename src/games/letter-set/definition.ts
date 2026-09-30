import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "letter-set",
  title: "Letter Set",
  tagline: "Seven letters. Repeat them. Find the pangram.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#31694e",
    wash: "#e4efcc",
    kicker: "The word garden",
    strap: "Seven letters. Plenty of room to grow.",
    emblem: "\u2726",
    poster: "petals",
  },
  rules: {
    summary: "Seven letters. Repeat them. Find the pangram.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
