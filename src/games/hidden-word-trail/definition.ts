import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "hidden-word-trail",
  title: "Hidden Word Trail",
  tagline: "Trace the theme through every square.",
  category: "Word building",
  phase: "expansion",
  kind: "puzzle",
  theme: {
    accent: "#326b54",
    wash: "#e3efdd",
    kicker: "The garden path",
    strap: "Follow a thought through the garden.",
    emblem: "\u219d",
    poster: "path",
  },
  rules: {
    summary: "Trace the theme through every square.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
