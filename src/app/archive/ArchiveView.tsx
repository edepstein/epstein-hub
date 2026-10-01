"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_LABEL, type Difficulty } from "@/lib/engine/types";

interface Row {
  gameId: string;
  gameTitle: string;
  id: string;
  title: string;
  difficulty: Difficulty;
  status: string;
  editionDate: string | null;
}

/** Filters live in the URL so Back restores them. */
export function ArchiveView({ rounds, games }: { rounds: Row[]; games: { id: string; title: string }[] }) {
  const search = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  // Filters live in a ref updated synchronously, so rapid successive changes compose even though
  // router.replace updates the URL asynchronously. The URL stays the shareable/back-button record.
  const initial = { game: search.get("game") ?? "all", difficulty: search.get("difficulty") ?? "all" };
  const [filters, setFilters] = useState(initial);
  const latest = useRef(initial);
  useEffect(() => {
    const fromUrl = { game: search.get("game") ?? "all", difficulty: search.get("difficulty") ?? "all" };
    latest.current = fromUrl;
    setFilters(fromUrl);
  }, [search]);
  const game = filters.game;
  const diff = filters.difficulty;
  const set = (k: "game" | "difficulty", v: string) => {
    const next = { ...latest.current, [k]: v };
    latest.current = next;
    setFilters(next);
    const p = new URLSearchParams();
    if (next.game !== "all") p.set("game", next.game);
    if (next.difficulty !== "all") p.set("difficulty", next.difficulty);
    router.replace(`${path}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };
  const published = rounds.filter((r) => r.status === "published");
  const practice = rounds.filter((r) => r.status !== "published" && (game === "all" || r.gameId === game) && (diff === "all" || r.difficulty === diff));
  return (
    <>
      <div className="filter-bar">
        <label>
          Game
          <select value={game} onChange={(e) => set("game", e.target.value)}>
            <option value="all">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select value={diff} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="all">Any</option>
            <option value="gentle">Gentle</option>
            <option value="standard">Standard</option>
            <option value="expert">Expert</option>
          </select>
        </label>
      </div>
      <h2 className="section-title">Published editions</h2>
      {published.length === 0 ? (
        <div className="empty" data-testid="archive-empty">
          No daily editions have been published yet. <Link href="/">Play today&apos;s practice games</Link>.
        </div>
      ) : null}
      <h2 className="section-title">
        Practice rounds <small style={{ fontSize: ".9rem", color: "var(--muted)" }}>{practice.length}</small>
      </h2>
      {practice.length === 0 ? (
        <div className="empty">No practice rounds match those filters.</div>
      ) : (
        <div className="round-grid">
          {practice.map((r) => (
            <Link key={`${r.gameId}:${r.id}`} className="round-card" href={`/play/${r.gameId}/${r.id}`}>
              <strong>{r.gameTitle}</strong>
              <small>
                {r.title} · {DIFFICULTY_LABEL[r.difficulty]} · {r.status === "demo" ? "original demo" : "practice"}
              </small>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
