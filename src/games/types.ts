import type { RoundMeta } from "@/lib/engine/types";

export type PosterKind =
  | "orbit" | "petals" | "code" | "groups" | "path" | "circuit" | "cross" | "stairs" | "pair" | "weave"
  | "notes" | "shrink" | "scraps" | "bridge" | "tickets" | "relay" | "dossier" | "hex" | "table";

export interface GameTheme {
  accent: string;
  wash: string;
  /** e.g. "The letter observatory" */
  kicker: string;
  /** Board heading strap line */
  strap: string;
  /** Decorative emblem glyph */
  emblem: string;
  poster: PosterKind;
}

export interface RulesSection {
  heading: string;
  points: string[];
}

export interface RulesContent {
  /** One sentence summary shown on cards and landing pages. */
  summary: string;
  sections: RulesSection[];
  /** Short worked example. */
  example?: string;
}

export type GameCategory = "Word building" | "Deduction" | "Connections" | "Clues" | "Play together";

/**
 * playable-preview: complete engine-driven loop with labelled practice content.
 * coming-soon: not yet playable; no Play CTA.
 * productionEnabled stays false until every docs/08 gate (editorial review, calibrated
 * content bank, provenance, observed accessibility) actually passes.
 */
export type Availability = "playable-preview" | "coming-soon";

export interface ReleaseGate {
  gate: string;
  status: "passed" | "open" | "not-applicable";
  note?: string;
}

export interface GameDefinition {
  id: string;
  title: string;
  tagline: string;
  category: GameCategory;
  phase: "launch" | "expansion" | "multiplayer" | "deferred" | "family-bonus";
  kind: "puzzle" | "match";
  theme: GameTheme;
  rules: RulesContent;
  availability: Availability;
  productionEnabled: boolean;
  releaseGates: ReleaseGate[];
}

export interface RoundBundle<P = unknown> {
  meta: RoundMeta;
  payload: P;
}

/** Standard open gates every game carries until real evidence exists. */
export const STANDARD_OPEN_GATES: ReleaseGate[] = [
  { gate: "Human editorial review of every round", status: "open" },
  { gate: "Reviewed practice bank (10+ rounds per advertised difficulty)", status: "open" },
  { gate: "30 scheduled reviewed daily editions", status: "open" },
  { gate: "Approved dictionary membership layer", status: "open" },
  { gate: "Observed player pilot and difficulty calibration", status: "open" },
  { gate: "Manual screen-reader and real-device checks", status: "open" },
];
