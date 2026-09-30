import type { RoundBundle } from "./types";

/** Props every Play component receives. Match games (Hexabble, Shared Word Board) ignore `bundle`. */
export interface PlayProps {
  bundle?: RoundBundle;
  /** Other rounds of the same game, for next-round navigation (metadata only is fine). */
  siblings?: { id: string; title?: string; difficulty: string }[];
}
