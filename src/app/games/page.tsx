import type { Metadata } from "next";
import { GAMES, getRounds } from "@/games/registry";
import { CatalogueFilter } from "./CatalogueFilter";

export const metadata: Metadata = { title: "All games" };

export default function GamesPage() {
  const items = GAMES.map((g) => ({
    id: g.id,
    title: g.title,
    tagline: g.tagline,
    category: g.category,
    playable: g.availability === "playable-preview",
    roundCount: getRounds(g.id).length,
  }));
  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">The whole shelf</div>
          <h1>All games</h1>
          <p>Only games with a complete engine are playable. Everything else is labelled Coming soon rather than pretending to work.</p>
        </div>
      </div>
      <CatalogueFilter items={items} />
    </>
  );
}
