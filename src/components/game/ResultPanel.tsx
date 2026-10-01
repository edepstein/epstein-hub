"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResultSummary } from "@/lib/engine/types";

const OUTCOME_LABEL = {
  completed: "Completed",
  failed: "Not solved this time",
  revealed: "Revealed",
  abandoned: "Stopped",
} as const;

export function ResultPanel({
  result,
  gameId,
  nextHref,
  onReplay,
  exhausted,
}: {
  result: ResultSummary;
  gameId: string;
  nextHref?: string | null;
  onReplay?(): void;
  exhausted?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <section className="result-panel" aria-labelledby="result-heading" data-testid="result-panel" data-outcome={result.outcome}>
      <span className="side-kicker">{OUTCOME_LABEL[result.outcome]}</span>
      <h2 id="result-heading" tabIndex={-1}>
        {result.headline}
      </h2>
      <div className="result-stats">
        {result.scoreText ? <span>{result.scoreText}</span> : null}
        {result.efficiency != null ? <span>Efficiency {Math.round(result.efficiency * 100)}%</span> : null}
        <span>
          {result.assistance.hints === 0 && result.assistance.reveals === 0
            ? "Unassisted"
            : `${result.assistance.hints} hint${result.assistance.hints === 1 ? "" : "s"} · ${result.assistance.reveals} reveal${result.assistance.reveals === 1 ? "" : "s"}`}
        </span>
      </div>
      {result.details.length ? (
        <ul>
          {result.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      ) : null}
      {result.explanation?.length ? (
        <details>
          <summary>How it works</summary>
          <ul>
            {result.explanation.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        {nextHref ? (
          <Link className="btn" href={nextHref}>
            Next unplayed round
          </Link>
        ) : exhausted ? (
          <span className="notice" style={{ margin: 0 }}>
            You have played every practice round available for this game. More reviewed rounds are on the way.
          </span>
        ) : null}
        {onReplay ? (
          <button type="button" className="btn secondary" onClick={onReplay}>
            Play this round again
          </button>
        ) : null}
        <button
          type="button"
          className="text-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.shareText);
              setCopied("Result copied. It contains no answers.");
            } catch {
              setCopied(result.shareText);
            }
          }}
        >
          Share result
        </button>
        <Link className="text-button" href={`/surprise?not=${gameId}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Try a different game
        </Link>
        <Link className="text-button" href={`/games/${gameId}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          All rounds
        </Link>
        <Link className="text-button" href="/library" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Library
        </Link>
      </div>
      {copied ? <p role="status">{copied}</p> : null}
    </section>
  );
}
