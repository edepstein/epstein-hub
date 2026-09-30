"use client";

import type { HintOffer } from "@/lib/engine/types";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Lists the current hint ladder. Each offer says what will be revealed and its cost
 * BEFORE the player commits; reveals need an explicit second click.
 */
export function HintDialog({
  open,
  onClose,
  offers,
  onTake,
  log,
}: {
  open: boolean;
  onClose(): void;
  offers: HintOffer[];
  onTake(tier: number): void;
  /** Hints already shown, newest last. */
  log?: string[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title="A helpful nudge" closeLabel="Back to the puzzle">
      <p style={{ lineHeight: 1.6 }}>Hints are optional and never block completion. Each one says what it reveals before you take it.</p>
      {offers.length === 0 ? <p>No hints are available for the current position.</p> : null}
      <ul className="hint-list">
        {offers.map((o) => (
          <li key={o.tier}>
            <div className="hint-head">
              <strong>{o.label}</strong>
              <button
                type="button"
                className={o.reveal ? "btn secondary small" : "btn small"}
                disabled={!o.available}
                onClick={() => {
                  onTake(o.tier);
                  onClose();
                }}
              >
                {o.reveal ? "Reveal" : "Take hint"}
              </button>
            </div>
            <p>{o.description}</p>
            {o.cost ? <p><em>{o.cost}</em></p> : null}
            {!o.available && o.reason ? <p><small>{o.reason}</small></p> : null}
          </li>
        ))}
      </ul>
      {log && log.length ? (
        <div className="hint-log" aria-label="Hints taken">
          <strong>Hints so far</strong>
          <ul>
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Dialog>
  );
}
