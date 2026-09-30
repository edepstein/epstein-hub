"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readIndex, storageHealth, type IndexEntry } from "@/lib/progress/storage";
import { DIFFICULTY_LABEL } from "@/lib/engine/types";
import { GAMES } from "@/games/registry";

const title = (id: string) => GAMES.find((g) => g.id === id)?.title ?? id;

export function LibraryView() {
  const [entries, setEntries] = useState<IndexEntry[] | null>(null);
  const [health, setHealth] = useState<"ok" | "unavailable" | "quota">("ok");
  useEffect(() => {
    setHealth(storageHealth());
    setEntries(readIndex());
  }, []);
  if (entries === null) return <div className="empty" role="status">Loading your library…</div>;
  if (health === "unavailable")
    return <div className="wc-banner" data-tone="warn">Saving is unavailable in this browser, so there is no library to show. You can still play every game.</div>;
  const sections: { heading: string; items: IndexEntry[] }[] = [
    { heading: "Continue playing", items: entries.filter((e) => e.outcome === "playing") },
    { heading: "Completed", items: entries.filter((e) => e.outcome === "completed") },
    { heading: "Revealed or not solved", items: entries.filter((e) => e.outcome === "revealed" || e.outcome === "failed") },
    { heading: "Finished early", items: entries.filter((e) => e.outcome === "abandoned") },
  ];
  if (entries.length === 0)
    return (
      <div className="empty" data-testid="library-empty">
        <p>You have not started any puzzles yet.</p>
        <Link className="btn" href="/">See today&apos;s games</Link>
      </div>
    );
  return (
    <>
      {sections.map((s) => (
        <section key={s.heading} aria-labelledby={`lib-${s.heading}`}>
          <h2 className="section-title" id={`lib-${s.heading}`}>
            {s.heading} <small style={{ fontSize: ".9rem", color: "var(--muted)" }}>{s.items.length}</small>
          </h2>
          {s.items.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Nothing here yet.</p>
          ) : (
            <div className="round-grid">
              {s.items.map((e) => (
                <Link key={`${e.gameId}:${e.roundId}`} className="round-card" href={e.gameId === "hexabble" || e.gameId === "shared-word-board" ? `/play/${e.gameId}/match` : `/play/${e.gameId}/${e.roundId}`}>
                  <strong>{title(e.gameId)}</strong>
                  <small>
                    {e.title} · {DIFFICULTY_LABEL[e.difficulty]} · {e.practice ? "practice" : "daily"}
                    {e.assisted ? " · assisted" : ""}
                    {e.summary ? ` · ${e.summary}` : ""}
                    <br />
                    Last played {new Date(e.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </small>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
