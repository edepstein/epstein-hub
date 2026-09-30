"use client";

import { PLAY_COMPONENTS } from "@/games/play-components";
import type { PlayProps } from "@/games/play-types";

export function PlayMount({ gameId, ...props }: PlayProps & { gameId: string }) {
  const Play = PLAY_COMPONENTS[gameId];
  if (!Play) return <div className="empty">This game is not available.</div>;
  return <Play {...props} />;
}
