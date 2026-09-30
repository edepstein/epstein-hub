import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "missing-links",
  title: "Missing Links",
  tagline: "One word belongs between both.",
  category: "Connections",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#34687b",
    wash: "#e4eff5",
    kicker: "The bridge club",
    strap: "Two ends. One very good connection.",
    emblem: "\u221e",
    poster: "bridge",
  },
  rules: {
    summary: "One word belongs between both.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
