"use client";

import { useState } from "react";
import { familyFetch } from "./client-api";

/**
 * Passwordless sign-in: email, then either the emailed link or the one-time code.
 * With `disabled` (no Supabase configuration) the form still validates input but sends nothing.
 */
export function SignInForm({ next, disabled = false, linkError = false }: { next: string; disabled?: boolean; linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? "That sign-in link has expired or was already used. Send yourself a new one below." : null);
  const [info, setInfo] = useState<string | null>(null);

  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  if (step === "code") {
    return (
      <form
        className="family-panel family-form"
        aria-labelledby="code-title"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/^\d{6,10}$/.test(code.replace(/\s+/g, ""))) {
            setError("Enter the code from the email (digits only).");
            return;
          }
          setBusy(true);
          const r = await familyFetch<{ next: string }>("/api/auth/verify", { method: "POST", json: { email, code, next } });
          setBusy(false);
          if (r.ok) window.location.assign(r.data.next);
          else setError(r.fields?.code ?? r.message);
        }}
      >
        <h2 id="code-title">Check your email</h2>
        <p>{info}</p>
        <p>Select the link in the email on this device, or type the code from the same email here.</p>
        <label htmlFor="signin-code">Code from the email</label>
        <input
          id="signin-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "signin-error" : undefined}
        />
        {error ? (
          <p id="signin-error" className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="toolbar">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setStep("email");
              setError(null);
              setCode("");
            }}
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="family-panel family-form"
      aria-labelledby="signin-title"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!emailOk(email)) {
          setError("Enter a valid email address, like name@example.com.");
          document.getElementById("signin-email")?.focus();
          return;
        }
        if (disabled) {
          setError("Sign-in is not available until the family space is set up. Nothing was sent.");
          return;
        }
        setBusy(true);
        setError(null);
        const r = await familyFetch<{ message: string }>("/api/auth/sign-in", { method: "POST", json: { email, next } });
        setBusy(false);
        if (r.ok) {
          setInfo(r.data.message);
          setStep("code");
        } else setError(r.fields?.email ?? r.message);
      }}
    >
      <h2 id="signin-title">Sign in with your email</h2>
      <p>Use the address your invitation was sent to. We will email you a sign-in link and a code; there is no password to remember.</p>
      <label htmlFor="signin-email">Email address</label>
      <input
        id="signin-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "signin-error" : undefined}
      />
      {error ? (
        <p id="signin-error" className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="toolbar">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
      </div>
      <p className="form-hint">Your device stays signed in until you sign out. If you change device, just sign in again with the same email.</p>
    </form>
  );
}
