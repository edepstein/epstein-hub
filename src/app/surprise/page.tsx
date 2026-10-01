import type { Metadata } from "next";
import { Suspense } from "react";
import { GAMES, getRounds } from "@/games/registry";
import { SurpriseRedirect } from "./SurpriseRedirect";

export const metadata: Metadata = { title: "Play something new" };

export default function SurprisePage() {
  const games = GAMES.filter((g) => g.availability === "playable-preview" && g.kind === "puzzle").map((g) => ({
    gameId: g.id,
    title: g.title,
    rounds: getRounds(g.id).map((r) => ({ id: r.meta.id, title: r.meta.title, difficulty: r.meta.difficulty })),
  }));
  return (
    <Suspense fallback={<div className="empty">Finding something fresh…</div>}>
      <SurpriseRedirect games={games} />
    </Suspense>
  );
}
