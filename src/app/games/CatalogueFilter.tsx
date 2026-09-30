"use client";

import { useMemo, useState } from "react";
import { GameCard } from "@/components/site/GameCard";
import { GAMES } from "@/games/registry";

interface Item {
  id: string;
  title: string;
  tagline: string;
  category: string;
  playable: boolean;
  roundCount: number;
}

const CATEGORIES = ["All", "Word building", "Deduction", "Connections", "Clues", "Play together"];

export function CatalogueFilter({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [onlyPlayable, setOnlyPlayable] = useState(false);
  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (cat === "All" || i.category === cat) &&
          (!onlyPlayable || i.playable) &&
          (q.trim() === "" || `${i.title} ${i.tagline}`.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [items, q, cat, onlyPlayable],
  );
  return (
    <>
      <div className="filter-bar" role="search">
        <label>
          Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. ladder" />
        </label>
        <label>
          Kind of puzzle
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
          <input type="checkbox" checked={onlyPlayable} onChange={(e) => setOnlyPlayable(e.target.checked)} /> Playable now
        </label>
      </div>
      <p role="status" style={{ color: "var(--muted)" }}>
        {shown.length} of {items.length} games
      </p>
      {shown.length === 0 ? (
        <div className="empty">No games match those filters.</div>
      ) : (
        <div className="cards">
          {shown.map((i) => (
            <GameCard key={i.id} game={GAMES.find((g) => g.id === i.id)!} roundCount={i.roundCount} />
          ))}
        </div>
      )}
    </>
  );
}
