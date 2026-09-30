import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "word-weave",
  title: "Word Weave",
  tagline: "Let shared letters unlock linked clues.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#256678",
    wash: "#e0f0f3",
    kicker: "The weaving room",
    strap: "Where one answer meets another.",
    emblem: "\u2317",
    poster: "weave",
  },
  rules: {
    summary: "Let shared letters unlock linked clues.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
