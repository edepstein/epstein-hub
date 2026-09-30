"use client";

import { useState } from "react";
import { useSettings } from "@/components/settings/SettingsProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { clearAllProgress } from "@/lib/progress/storage";

export function SettingsForm() {
  const { settings, update, reset } = useSettings();
  const [confirm, setConfirm] = useState<null | "progress" | "prefs">(null);
  const [status, setStatus] = useState("");
  return (
    <form className="playbox form" style={{ minHeight: 0, maxWidth: 720 }} onSubmit={(e) => e.preventDefault()}>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="side-kicker">Text size</legend>
        {(["100", "115", "130", "150"] as const).map((s) => (
          <label key={s} style={{ display: "inline-flex", gap: 6, marginRight: 16, fontWeight: 400 }}>
            <input type="radio" name="textScale" checked={settings.textScale === s} onChange={() => update({ textScale: s })} style={{ width: "auto" }} /> {s}%
          </label>
        ))}
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, marginTop: 18 }}>
        <legend className="side-kicker">Motion</legend>
        {(
          [
            ["system", "Follow my device"],
            ["reduce", "Reduce motion"],
            ["full", "Allow gentle motion"],
          ] as const
        ).map(([v, l]) => (
          <label key={v} style={{ display: "inline-flex", gap: 6, marginRight: 16, fontWeight: 400 }}>
            <input type="radio" name="motion" checked={settings.motion === v} onChange={() => update({ motion: v })} style={{ width: "auto" }} /> {l}
          </label>
        ))}
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, marginTop: 18 }}>
        <legend className="side-kicker">Contrast</legend>
        <label style={{ display: "inline-flex", gap: 6, fontWeight: 400 }}>
          <input type="checkbox" checked={settings.contrast === "more"} onChange={(e) => update({ contrast: e.target.checked ? "more" : "normal" })} style={{ width: "auto" }} /> Stronger borders and text
        </label>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, marginTop: 18 }}>
        <legend className="side-kicker">Optional extras (off by default)</legend>
        <label style={{ display: "flex", gap: 6, fontWeight: 400 }}>
          <input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} style={{ width: "auto" }} /> Sounds (no game currently plays sound; this is reserved)
        </label>
        <label style={{ display: "flex", gap: 6, fontWeight: 400 }}>
          <input type="checkbox" checked={settings.showStreaks} onChange={(e) => update({ showStreaks: e.target.checked })} style={{ width: "auto" }} /> Show streaks (none are counted until daily editions exist)
        </label>
      </fieldset>
      <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>Settings save automatically on this device.</p>
      <h2 className="section-title">Clear data</h2>
      <p style={{ lineHeight: 1.6 }}>
        These only affect this browser. They do not touch any family-space content or account, which live on the server.
      </p>
      <div className="toolbar">
        <button type="button" className="btn secondary" onClick={() => setConfirm("progress")}>
          Clear puzzle progress
        </button>
        <button type="button" className="btn secondary" onClick={() => setConfirm("prefs")}>
          Reset preferences
        </button>
      </div>
      <p role="status">{status}</p>
      <ConfirmDialog
        open={confirm === "progress"}
        onClose={() => setConfirm(null)}
        title="Clear all puzzle progress?"
        body="This removes saved attempts, drafts, your library and local Hexabble matches from this browser. It cannot be undone. Preferences are kept."
        confirmLabel="Clear progress"
        onConfirm={() => {
          clearAllProgress(false);
          setStatus("Puzzle progress on this device was cleared.");
        }}
      />
      <ConfirmDialog
        open={confirm === "prefs"}
        onClose={() => setConfirm(null)}
        title="Reset preferences?"
        body="Text size, motion and contrast return to their defaults. Puzzle progress is kept."
        confirmLabel="Reset preferences"
        onConfirm={() => {
          reset();
          setStatus("Preferences were reset.");
        }}
      />
    </form>
  );
}
