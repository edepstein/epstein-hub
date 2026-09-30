"use client";

import type { Feedback } from "@/hooks/useGameSession";

/** Polite live region for submission results. Never announces keystrokes. */
export function LiveFeedback({ feedback, id = "game-feedback" }: { feedback: Feedback | null; id?: string }) {
  return (
    <div
      id={id}
      className="feedback"
      role="status"
      aria-live="polite"
      data-ok={feedback ? String(feedback.ok) : undefined}
      data-code={feedback?.code}
      data-testid="feedback"
    >
      {feedback ? <span key={feedback.seq}>{feedback.message}</span> : null}
    </div>
  );
}
