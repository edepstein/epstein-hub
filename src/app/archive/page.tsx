import type { Metadata } from "next";
import { Suspense } from "react";
import { GAMES, getRounds } from "@/games/registry";
import { ArchiveView } from "./ArchiveView";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  const rounds = GAMES.filter((g) => g.availability === "playable-preview" && g.kind === "puzzle").flatMap((g) =>
    getRounds(g.id).map((r) => ({
      gameId: g.id,
      gameTitle: g.title,
      id: r.meta.id,
      title: r.meta.title ?? r.meta.id,
      difficulty: r.meta.difficulty,
      status: r.meta.status,
      editionDate: r.meta.editionDate ?? null,
    })),
  );
  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">Every round we can offer</div>
          <h1>Archive</h1>
          <p>
            Published daily editions appear here by date once editorial review is in place. Until then there are no historical
            editions, only clearly labelled practice rounds.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <ArchiveView rounds={rounds} games={GAMES.map((g) => ({ id: g.id, title: g.title }))} />
      </Suspense>
    </>
  );
}
