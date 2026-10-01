"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { pickFreshRound, type GameChoice } from "@/lib/progress/next-round";
import { readIndex } from "@/lib/progress/storage";

/** Sends the player to a round they have never played, in the game they played least recently. */
export function SurpriseRedirect({ games }: { games: (GameChoice & { title: string })[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const [none, setNone] = useState(false);
  useEffect(() => {
    const avoid = search.get("not") ?? readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.gameId ?? null;
    const pick = pickFreshRound(games, avoid);
    if (pick) router.replace(`/play/${pick.gameId}/${pick.round.id}`);
    else setNone(true);
  }, [games, router, search]);
  if (!none) return <div className="empty" role="status">Finding something fresh…</div>;
  return (
    <div className="empty" data-testid="surprise-exhausted">
      <h1 className="section-title" style={{ marginTop: 0 }}>You have played every round we have</h1>
      <p>Every practice round in every playable game has been played on this device. New rounds are added only after they are validated. You can replay anything from the Library or any game page.</p>
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <Link className="btn" href="/library">Open the library</Link>
        <Link className="btn secondary" href="/games">Browse games</Link>
      </div>
    </div>
  );
}
