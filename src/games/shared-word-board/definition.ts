import { STANDARD_OPEN_GATES, type GameDefinition } from "../types";

/** Placeholder definition: replace rules and set availability once the engine/UI are complete. */
export const definition: GameDefinition = {
  id: "shared-word-board",
  title: "Shared Word Board",
  tagline: "A friendly board. A thoughtful move.",
  category: "Play together",
  phase: "multiplayer",
  kind: "match",
  theme: {
    accent: "#76563d",
    wash: "#f1e7d9",
    kicker: "The shared table",
    strap: "Good company. Thoughtful words.",
    emblem: "\u25a7",
    poster: "table",
  },
  rules: {
    summary: "A friendly board. A thoughtful move.",
    sections: [],
  },
  availability: "coming-soon",
  productionEnabled: false,
  releaseGates: STANDARD_OPEN_GATES,
};
