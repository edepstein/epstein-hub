"use client";

import Link from "next/link";
import { useState } from "react";
import { familyFetch } from "./client-api";
import { SignOutButton } from "./SignOutButton";

const HEADINGS: Record<string, string> = {
  invite_expired: "This invitation has expired",
  invite_used: "This invitation has already been used",
  invite_revoked: "This invitation was cancelled",
  invite_not_found: "This invitation link is not valid",
  invite_email_mismatch: "This invitation is for a different email address",
  email_unverified: "Please confirm your email first",
  rate_limited: "Too many attempts",
};

export function AcceptInvite({ token, email }: { token: string; email: string | null }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | { code: string; message: string }>("idle");
  if (state === "done") {
    return (
      <section className="family-panel" aria-labelledby="accept-done">
        <h2 id="accept-done">Welcome to the family space</h2>
        <p>Your invitation is accepted.</p>
        <div className="toolbar">
          <Link className="btn" href="/family">
            Open the family space
          </Link>
        </div>
      </section>
    );
  }
  const failed = typeof state === "object" ? state : null;
  return (
    <section className="family-panel" aria-labelledby="accept-title" data-state={failed ? failed.code : "ready"}>
      <h2 id="accept-title">{failed ? (HEADINGS[failed.code] ?? "The invitation could not be accepted") : "You have been invited"}</h2>
      {failed ? (
        <p role="alert">{failed.message}</p>
      ) : (
        <p>
          Accept to join the private family space{email ? ` as ${email}` : ""}. You can read updates and the Birthday Book; posting is always optional.
        </p>
      )}
      <div className="toolbar">
        {!failed || failed.code === "rate_limited" || failed.code === "service_unavailable" || failed.code === "network" ? (
          <button
            type="button"
            className="btn"
            disabled={state === "busy"}
            onClick={async () => {
              setState("busy");
              const r = await familyFetch("/api/family/invites/accept", { method: "POST", json: { token } });
              setState(r.ok ? "done" : { code: r.code, message: r.message });
            }}
          >
            {state === "busy" ? "Joining…" : failed ? "Try again" : "Accept invitation"}
          </button>
        ) : null}
        {failed?.code === "invite_email_mismatch" ? <SignOutButton label="Sign out and use another email" /> : null}
        {failed?.code === "invite_used" ? (
          <Link className="btn secondary" href="/family">
            Go to the family space
          </Link>
        ) : null}
      </div>
    </section>
  );
}
