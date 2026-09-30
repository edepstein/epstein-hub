"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { nextPracticeRound, type SiblingRound } from "@/lib/progress/next-round";
import { readIndex } from "@/lib/progress/storage";

/** Sends the player to an unfinished round, else the next unseen one; explains exhaustion honestly. */
export function PracticeRedirect({ gameId, title, siblings, playable }: { gameId: string; title: string; siblings: SiblingRound[]; playable: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const [exhausted, setExhausted] = useState(false);
  useEffect(() => {
    if (!playable || siblings.length === 0) {
      setExhausted(true);
      return;
    }
    const difficulty = search.get("difficulty") ?? undefined;
    const inProgress = readIndex().find((e) => e.gameId === gameId && e.outcome === "playing" && siblings.some((s) => s.id === e.roundId));
    if (inProgress && !difficulty) {
      router.replace(`/play/${gameId}/${inProgress.roundId}`);
      return;
    }
    const { next } = nextPracticeRound(gameId, null, siblings, difficulty);
    if (next) router.replace(`/play/${gameId}/${next.id}`);
    else setExhausted(true);
  }, [gameId, playable, router, search, siblings]);
  if (!exhausted) return <div className="empty" role="status">Finding your next {title} round…</div>;
  return (
    <div className="empty" data-testid="practice-exhausted">
      <h1 className="section-title" style={{ marginTop: 0 }}>You have played every {title} practice round</h1>
      <p>New rounds are added only after they are validated, so there is nothing fresh right now. You can replay any round from the list, or try another game.</p>
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <Link className="btn" href={`/games/${gameId}`}>See all rounds</Link>
        <Link className="btn secondary" href="/games">Try another game</Link>
      </div>
    </div>
  );
}
