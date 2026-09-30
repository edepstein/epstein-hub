import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "anagram-relay",
  title: "Anagram Relay",
  tagline: "Solve the scramble. Carry a letter onwards.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#4e699b",
    wash: "#e8eef8",
    kicker: "The letter relay",
    strap: "Carry a letter. Discover the next word.",
    emblem: "\u21c4",
    poster: "relay",
  },
  rules: {
    summary: "Solve the scramble. Carry a letter onwards.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
