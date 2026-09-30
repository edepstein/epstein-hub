"use client";

import type { ReactNode } from "react";
import { useMembership } from "@/hooks/useMembership";

/** Renders children once the word list has loaded; designed loading and failure states otherwise. */
export function WordListGate({ children }: { children: (words: ReadonlySet<string>) => ReactNode }) {
  const m = useMembership();
  if (m.status === "loading") return <div className="empty" role="status">Loading the word list…</div>;
  if (m.status === "error" || !m.words)
    return (
      <div className="wc-banner" data-tone="error" role="alert" data-testid="wordlist-error">
        The word list could not be loaded ({m.error}). Check your connection and try again; your saved progress is safe.
        <span className="spacer" />
        <button type="button" className="btn small" onClick={m.retry}>
          Try again
        </button>
      </div>
    );
  return <>{children(m.words)}</>;
}
