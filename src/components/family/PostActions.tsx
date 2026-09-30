"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { familyFetch } from "./client-api";

type Action = "submit" | "unsubmit" | "delete" | "approve" | "withdraw";

const LABELS: Record<Action, string> = {
  submit: "Submit for review",
  unsubmit: "Back to draft",
  delete: "Delete",
  approve: "Approve and publish",
  withdraw: "Withdraw",
};

const DONE: Record<Action, string> = {
  submit: "Sent for review.",
  unsubmit: "Moved back to your drafts.",
  delete: "Deleted.",
  approve: "Published to the family.",
  withdraw: "Withdrawn. It no longer appears in the Family Window.",
};

/** Buttons for post state changes; each carries the version it was shown with (conflict-safe). */
export function PostActions({ familyId, postId, version, actions }: { familyId: string; postId: string; version: number; actions: Action[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!actions.length) return null;
  async function run(action: Action) {
    setBusy(action);
    const r = await familyFetch(`/api/family/${familyId}/posts/${postId}`, { method: "PATCH", json: { action, version } });
    setBusy(null);
    setConfirmDelete(false);
    if (r.ok) {
      setMessage({ tone: "ok", text: DONE[action] });
      router.refresh();
    } else {
      setMessage({ tone: "error", text: r.message });
      if (r.code === "version_conflict") router.refresh();
    }
  }
  return (
    <div>
      <div className="small-btns">
        {actions.map((a) =>
          a === "delete" && !confirmDelete ? (
            <button key={a} type="button" className="btn secondary" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
              Delete…
            </button>
          ) : (
            <button key={a} type="button" className={a === "approve" || a === "submit" ? "btn" : "btn secondary"} disabled={!!busy} onClick={() => void run(a)}>
              {busy === a ? "Working…" : a === "delete" ? "Yes, delete it" : LABELS[a]}
            </button>
          ),
        )}
        {confirmDelete ? (
          <button type="button" className="btn secondary" onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
        ) : null}
      </div>
      <p className="status-line" data-tone={message?.tone} role="status" aria-live="polite">
        {message?.text}
      </p>
    </div>
  );
}
