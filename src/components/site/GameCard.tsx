import Link from "next/link";
import type { CSSProperties } from "react";
import type { GameDefinition } from "@/games/types";
import { Poster } from "./Poster";

export function GameCard({ game, roundCount }: { game: GameDefinition; roundCount?: number }) {
  const style = { "--accent": game.theme.accent, "--wash": game.theme.wash } as CSSProperties;
  const playable = game.availability === "playable-preview";
  const inner = (
    <>
      <Poster theme={game.theme} />
      <div className="card-copy">
        <span className="card-kicker">{game.theme.kicker}</span>
        <h2>{game.title}</h2>
        <p>{game.tagline}</p>
        <span className="card-link">
          {playable ? (
            <>
              <span>
                Play{roundCount ? ` · ${roundCount} practice round${roundCount === 1 ? "" : "s"}` : ""}
                {game.kind === "match" ? " · local match" : ""}
              </span>
              <b aria-hidden="true">↗</b>
            </>
          ) : (
            <span className="preview-pill coming-pill">Coming soon</span>
          )}
        </span>
      </div>
    </>
  );
  return playable ? (
    <Link className="card game-card" href={`/games/${game.id}`} style={style} data-testid={`card-${game.id}`}>
      {inner}
    </Link>
  ) : (
    <div className="card game-card" style={{ ...style, opacity: 0.8 }} aria-disabled="true" data-testid={`card-${game.id}`}>
      {inner}
    </div>
  );
}
