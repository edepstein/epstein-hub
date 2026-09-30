import type { Metadata } from "next";

export const metadata: Metadata = { title: "Family space", robots: { index: false, follow: false } };

/** Placeholder until the birthday batch lands: real auth is required before any private content. */
export default function FamilyPage() {
  return (
    <div data-game="family">
      <div className="hero">
        <div>
          <div className="eyebrow">Family space · invitation required</div>
          <h1>A private place for the family</h1>
          <p>This space needs a configured, secure sign-in before it can show anything. It never shows private content to visitors.</p>
        </div>
      </div>
    </div>
  );
}
