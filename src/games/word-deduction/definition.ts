import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "word-deduction",
  title: "Word Deduction",
  tagline: "Find the hidden five-letter word.",
  category: "Deduction",
  phase: "launch",
  kind: "puzzle",
  theme: {
    accent: "#315bd1",
    wash: "#e7edff",
    kicker: "The code room",
    strap: "Every guess brings the answer into focus.",
    emblem: "?",
    poster: "code",
  },
  rules: {
    summary: "Find the hidden five-letter word.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
