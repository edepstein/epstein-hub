"use client";

import Link from "next/link";

/** Private-area error boundary: a plain recovery message, never error details. */
export default function FamilyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="family-panel family-state" data-state="error" aria-labelledby="family-error-title">
      <h2 id="family-error-title">Something went wrong loading this page</h2>
      <p>Nothing has been lost. Please try again; if it keeps happening, the family space may be briefly unavailable.</p>
      <div className="toolbar">
        <button type="button" className="btn" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn secondary" href="/family">
          Family space home
        </Link>
      </div>
    </section>
  );
}
