"use client";

import { useState, type FormEvent } from "react";
import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, type CheckingMode } from "../engine";
import { PlayerMark } from "./panels";

export interface SetupValues {
  names: string[];
  mode: CheckingMode;
  privacy: boolean;
}

export function Setup({
  initial,
  onStart,
  onResume,
  resumeLabel,
  onRules,
}: {
  initial: SetupValues;
  onStart(v: SetupValues): void;
  onResume: (() => void) | null;
  resumeLabel?: string;
  onRules(): void;
}) {
  const [count, setCount] = useState(Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, initial.names.length)));
  const [names, setNames] = useState<string[]>(() => [...initial.names, "", "", "", ""].slice(0, MAX_PLAYERS));
  const [mode, setMode] = useState<CheckingMode>(initial.mode);
  const [privacy, setPrivacy] = useState(initial.privacy);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart({ names: names.slice(0, count), mode, privacy });
  };

  return (
    <form className="hx-setup" onSubmit={submit} aria-labelledby="hx-setup-title" data-testid="hx-setup">
      <div className="hx-logo">
        <svg viewBox="-60 -52 120 104" className="hx-logo-hex" aria-hidden="true">
          <polygon points="60,0 30,52 -30,52 -60,0 -30,-52 30,-52" />
        </svg>
        <h2 id="hx-setup-title">Set up a local match</h2>
      </div>
      <p className="hx-muted">
        Hexabble is local pass-and-play for two to four people sharing this device. There is no computer opponent and no online play.
      </p>

      <fieldset className="hx-field">
        <legend>Number of players</legend>
        <div className="hx-seg">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)}>
              {n} players
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="hx-field">
        <legend>Player names (in playing order)</legend>
        <div className="hx-names">
          {Array.from({ length: count }, (_, i) => (
            <label key={i} className="hx-name-row">
              <PlayerMark index={i} />
              <span className="sr-only">Player {i + 1} name</span>
              <input
                value={names[i]}
                maxLength={MAX_NAME_LENGTH}
                placeholder={`Player ${i + 1}`}
                autoComplete="off"
                onChange={(e) => setNames((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="hx-field">
        <legend>Word checking mode</legend>
        <p className="hx-muted small">These choose how words are checked, not how hard the game is. Both use the same rules and word list.</p>
        <div className="hx-choice">
          <label>
            <input type="radio" name="hx-mode" value="friendly" checked={mode === "friendly"} onChange={() => setMode("friendly")} />
            <span>
              <strong>Friendly checking</strong> (recommended). Words are checked as you build your move. An invalid word simply cannot be
              placed, so nobody loses a turn.
            </span>
          </label>
          <label>
            <input type="radio" name="hx-mode" value="challenge" checked={mode === "challenge"} onChange={() => setMode("challenge")} />
            <span>
              <strong>Challenge checking</strong>. Words are checked only when you place them. An invalid word loses that turn; you keep your
              tiles.
            </span>
          </label>
        </div>
      </fieldset>

      <label className="hx-check">
        <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> Hide each rack between turns (pass-the-device
        screen)
      </label>

      <div className="hx-row">
        <button type="submit" className="hx-btn primary big">
          Start match
        </button>
        {onResume ? (
          <button type="button" className="hx-btn big" onClick={onResume}>
            {resumeLabel ?? "Back to the saved match"}
          </button>
        ) : null}
      </div>
      <button type="button" className="hx-link" onClick={onRules}>
        How to play and scoring
      </button>
    </form>
  );
}
