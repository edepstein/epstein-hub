import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GAMES, getGame, getRounds } from "@/games/registry";
import { PracticeRedirect } from "./PracticeRedirect";

export function generateStaticParams() {
  return GAMES.filter((g) => g.kind === "puzzle").map((g) => ({ gameId: g.id }));
}

export default async function PracticePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = getGame(gameId);
  if (!game || game.kind !== "puzzle") notFound();
  const siblings = getRounds(game.id).map((r) => ({ id: r.meta.id, title: r.meta.title, difficulty: r.meta.difficulty }));
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
      <PracticeRedirect gameId={game.id} title={game.title} siblings={siblings} playable={game.availability === "playable-preview"} />
    </Suspense>
  );
}
