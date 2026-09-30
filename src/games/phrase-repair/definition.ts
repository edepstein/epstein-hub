import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "phrase-repair",
  title: "Phrase Repair",
  tagline: "Put the familiar expression back together.",
  category: "Connections",
  phase: "deferred",
  kind: "puzzle",
  theme: {
    accent: "#8c5638",
    wash: "#faebdb",
    kicker: "The phrase press",
    strap: "A familiar saying, freshly rearranged.",
    emblem: "\u201c",
    poster: "tickets",
  },
  rules: {
    summary: "Put the familiar expression back together.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
