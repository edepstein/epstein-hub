"use client";

import { useEffect, useState } from "react";
import { readIndex, readSeen } from "@/lib/progress/storage";

const LABEL = { playing: "In progress", completed: "Completed", failed: "Not solved", revealed: "Revealed", abandoned: "Stopped" } as const;

export function RoundProgress({ gameId, roundId }: { gameId: string; roundId: string }) {
  const [label, setLabel] = useState("Not started");
  useEffect(() => {
    const e = readIndex().find((x) => x.gameId === gameId && x.roundId === roundId);
    if (e) setLabel(LABEL[e.outcome] + (e.assisted ? " · assisted" : ""));
    else if (readSeen(gameId)[roundId]) setLabel("Played");
  }, [gameId, roundId]);
  return <span>{label}</span>;
}
