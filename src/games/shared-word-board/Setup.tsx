"use client";

import { useId, useState, type FormEvent } from "react";
import { RULES_1_0, RULES_1_1_CANDIDATE, totalTiles, type RulesVersion } from "./rules";

const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

/** Local match setup: 2-4 named players and a pinned rules version. */
export function Setup({ onStart }: { onStart(opts: { players: string[]; rulesVersion: RulesVersion }): { ok: boolean; message: string } }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES.slice());
  const [rulesVersion, setRulesVersion] = useState<RulesVersion>("1.0");
  const [error, setError] = useState<string | null>(null);
  const uid = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const players = names.slice(0, count).map((n) => n.trim());
    const r = onStart({ players, rulesVersion });
    if (!r.ok) setError(r.message);
  };

  return (
    <div className="game-layout">
      <section className="playbox" aria-labelledby={`${uid}-h`}>
        <div className="board-heading">
          <span>Good company. Thoughtful words.</span>
          <span className="board-emblem" aria-hidden="true">
            ▧
          </span>
        </div>
        <form className="puzzle-stage swb-setup" onSubmit={submit} data-testid="setup">
          <h2 id={`${uid}-h`} className="section-title" style={{ marginTop: 0 }}>
            Set up a local match
          </h2>
          <div className="wc-banner" data-tone="info" data-testid="online-note">
            Online play needs the server set up. It is not available yet, so this edition is pass-and-play: everyone shares this device and takes turns. There is no computer opponent.
          </div>

          <fieldset>
            <legend>How many players?</legend>
            <div className="swb-choice-row">
              {[2, 3, 4].map((n) => (
                <label key={n} className="swb-choice">
                  <input type="radio" name={`${uid}-count`} value={n} checked={count === n} onChange={() => setCount(n)} />
                  {n} players
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Player names, in turn order</legend>
            {Array.from({ length: count }, (_, i) => (
              <label key={i} className="swb-name">
                <span>Player {i + 1}</span>
                <input
                  type="text"
                  value={names[i]}
                  maxLength={24}
                  autoComplete="off"
                  onChange={(e) => {
                    const next = names.slice();
                    next[i] = e.target.value;
                    setNames(next);
                    setError(null);
                  }}
                />
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Rules</legend>
            <label className="swb-rule-choice">
              <input type="radio" name={`${uid}-rules`} value="1.0" checked={rulesVersion === "1.0"} onChange={() => setRulesVersion("1.0")} />
              <span>
                <strong>Rules 1.0 · uniform short match</strong>
                <br />
                Every letter scores 1, no blanks or premium squares, {totalTiles(RULES_1_0)} tiles. The pack&apos;s worked example uses these rules.
              </span>
            </label>
            <label className="swb-rule-choice">
              <input type="radio" name={`${uid}-rules`} value="1.1-candidate" checked={rulesVersion === "1.1-candidate"} onChange={() => setRulesVersion("1.1-candidate")} />
              <span>
                <strong>Rules 1.1 candidate · proposed, not yet balanced</strong>
                <br />
                Letter values, 2 blanks, double word and triple letter squares, {totalTiles(RULES_1_1_CANDIDATE)} tiles. A draft configuration awaiting balance review; fine for friendly practice.
              </span>
            </label>
          </fieldset>

          {error ? (
            <p className="wc-banner" data-tone="error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn">
            Start the match
          </button>
          <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>
            The match is saved on this device after every move. Racks are hidden between turns, but this is not a secure online game.
          </p>
        </form>
      </section>
      <aside className="sidebox" aria-label="About local play">
        <div className="side-section">
          <h3>Before you start</h3>
          <p style={{ margin: 0 }}>
            Sit where you can pass the device around. After each turn a handover screen hides the rack until the next player is ready.
          </p>
        </div>
      </aside>
    </div>
  );
}
