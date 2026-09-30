"use client";

import { useState } from "react";
import { familyFetch } from "./client-api";

export function SignOutButton({ className = "btn secondary", label = "Sign out" }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await familyFetch("/api/auth/sign-out", { method: "POST" });
          // Full reload on purpose: drops any private data held in the client router cache.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          if (r.ok) window.location.assign("/family");
          else {
            setError(r.message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : label}
      </button>
      {error ? (
        <span role="alert" className="form-error">
          {error}
        </span>
      ) : null}
    </>
  );
}
