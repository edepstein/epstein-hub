"use client";

import type { SaveStatus } from "@/hooks/useGameSession";

const LABEL: Record<SaveStatus, string> = {
  idle: "Not saved yet",
  saving: "Saving…",
  saved: "Saved on this device",
  unavailable: "Temporary play · saving unavailable",
  error: "Not saved",
};

export function SaveIndicator({ status, message }: { status: SaveStatus; message?: string | null }) {
  return (
    <span className="save-indicator" data-status={status} data-testid="save-indicator" title={message ?? undefined}>
      <span aria-hidden="true">{status === "saved" ? "✓" : status === "error" || status === "unavailable" ? "!" : "•"}</span>
      {LABEL[status]}
    </span>
  );
}
