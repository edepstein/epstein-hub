import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "cryptic-workshop",
  title: "Cryptic Workshop",
  tagline: "Solve the clue. Understand the trick.",
  category: "Clues",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#8a5233",
    wash: "#f5e7d4",
    kicker: "The clue workshop",
    strap: "Unpick the clue. Enjoy the penny dropping.",
    emblem: "\u270e",
    poster: "notes",
  },
  rules: {
    summary: "Solve the clue. Understand the trick.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
