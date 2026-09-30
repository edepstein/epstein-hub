import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "word-families",
  title: "Word Families",
  tagline: "Four groups. Connections worth discovering.",
  category: "Connections",
  phase: "launch",
  kind: "puzzle",
  theme: {
    accent: "#91435c",
    wash: "#f7e4ea",
    kicker: "The connection collection",
    strap: "Small discoveries, satisfying connections.",
    emblem: "\u25a6",
    poster: "groups",
  },
  rules: {
    summary: "Four groups. Connections worth discovering.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
