import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { GAMES, getGame, getRounds } from "@/games/registry";
import { RulesView } from "@/components/game/RulesView";
import { DIFFICULTIES, DIFFICULTY_LABEL } from "@/lib/engine/types";
import { RoundProgress } from "./RoundProgress";

export function generateStaticParams() {
  return GAMES.map((g) => ({ gameId: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const { gameId } = await params;
  const g = getGame(gameId);
  return { title: g?.title ?? "Game" };
}

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = getGame(gameId);
  if (!game) notFound();
  const rounds = getRounds(game.id);
  const playable = game.availability === "playable-preview";
  const style = { "--accent": game.theme.accent, "--wash": game.theme.wash } as CSSProperties;
  return (
    <div data-game={game.id} style={style}>
      <div className="hero">
        <div>
          <div className="eyebrow">{game.theme.kicker}</div>
          <h1>{game.title}</h1>
          <p>{game.tagline}</p>
        </div>
        <span className={playable ? "preview-pill" : "preview-pill coming-pill"}>
          {playable ? "Playable · practice preview" : "Coming soon"}
        </span>
      </div>

      {playable && game.kind === "match" ? (
        <div className="toolbar">
          <Link className="btn" href={`/play/${game.id}/match`}>
            Set up or resume a local match
          </Link>
        </div>
      ) : null}

      {playable && game.kind === "puzzle" ? (
        <>
          <div className="toolbar">
            <Link className="btn" href={`/practice/${game.id}`}>
              Play the next practice round
            </Link>
          </div>
          <p className="notice">
            No daily editions of {game.title} are published yet. These are practice rounds: original, machine-validated and
            clearly labelled, but not yet through human editorial review. Difficulty labels are the author&apos;s intention, not
            calibrated evidence.
          </p>
          {DIFFICULTIES.map((d) => {
            const list = rounds.filter((r) => r.meta.difficulty === d);
            return (
              <section key={d} aria-labelledby={`diff-${d}`}>
                <h2 className="section-title" id={`diff-${d}`}>
                  {DIFFICULTY_LABEL[d]}{" "}
                  <small style={{ fontSize: ".9rem", color: "var(--muted)" }}>
                    {list.length} round{list.length === 1 ? "" : "s"}
                    {list.length > 0 && list.length < 10 ? " · limited preview" : ""}
                  </small>
                </h2>
                {list.length === 0 ? (
                  <p className="empty">No {DIFFICULTY_LABEL[d].toLowerCase()} rounds are available yet.</p>
                ) : (
                  <div className="round-grid">
                    {list.map((r) => (
                      <Link key={r.meta.id} className="round-card" href={`/play/${game.id}/${r.meta.id}`} data-testid={`round-${r.meta.id}`}>
                        <strong>{r.meta.title ?? r.meta.id}</strong>
                        <small>
                          {r.meta.status === "demo" ? "Original demo round" : "Practice round"} · <RoundProgress gameId={game.id} roundId={r.meta.id} />
                        </small>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      ) : null}

      {!playable ? (
        <div className="empty">
          {game.title} is not playable yet. Its rules are below so you know what is coming.
        </div>
      ) : null}

      <section className="prose" style={{ marginTop: 32 }} aria-labelledby="rules-heading">
        <h2 id="rules-heading">How to play</h2>
        <RulesView rules={game.rules} />
      </section>

      <details style={{ marginTop: 24 }}>
        <summary>Release status for {game.title}</summary>
        <ul>
          {game.releaseGates.map((g) => (
            <li key={g.gate}>
              {g.gate}: <strong>{g.status}</strong>
              {g.note ? ` · ${g.note}` : ""}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
