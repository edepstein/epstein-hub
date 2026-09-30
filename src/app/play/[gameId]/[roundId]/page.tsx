import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES, getGame, getRound, getRounds } from "@/games/registry";
import { PlayMount } from "./PlayMount";

export function generateStaticParams() {
  const params: { gameId: string; roundId: string }[] = [];
  for (const g of GAMES) {
    if (g.kind === "match") params.push({ gameId: g.id, roundId: "match" });
    for (const r of getRounds(g.id)) params.push({ gameId: g.id, roundId: r.meta.id });
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ gameId: string; roundId: string }> }): Promise<Metadata> {
  const { gameId } = await params;
  return { title: getGame(gameId)?.title ?? "Play" };
}

export default async function PlayPage({ params }: { params: Promise<{ gameId: string; roundId: string }> }) {
  const { gameId, roundId } = await params;
  const game = getGame(gameId);
  if (!game) notFound();
  if (game.kind === "match") {
    if (roundId !== "match") notFound();
    return <PlayMount gameId={game.id} />;
  }
  const bundle = getRound(game.id, roundId);
  if (!bundle) notFound();
  const siblings = getRounds(game.id).map((r) => ({ id: r.meta.id, title: r.meta.title, difficulty: r.meta.difficulty }));
  return <PlayMount gameId={game.id} bundle={bundle} siblings={siblings} />;
}
