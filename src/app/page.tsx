import Link from "next/link";
import { GAMES, LAUNCH_IDS, getGame, getRounds } from "@/games/registry";
import { GameCard } from "@/components/site/GameCard";
import { Poster } from "@/components/site/Poster";

export default function Home() {
  const featured = getGame("letter-wheel")!;
  const launch = LAUNCH_IDS.map((id) => getGame(id)!);
  const hex = getGame("hexabble")!;
  const playableCount = GAMES.filter((g) => g.availability === "playable-preview").length;
  return (
    <>
      <section className="welcome">
        <div className="welcome-copy">
          <div className="eyebrow">The good kind of brain teaser</div>
          <h1>
            Words to play with.
            <br />
            <em>Moments to keep.</em>
          </h1>
          <p>Your own little puzzle club. Find a satisfying challenge, follow an unexpected connection, then catch up with the family.</p>
          <Link className="btn" href={`/games/${featured.id}`}>
            Start with {featured.title} <span aria-hidden="true">↗</span>
          </Link>
          <span className="welcome-note">
            Practice preview · no daily editions are published yet, so every round here is a labelled practice round.
          </span>
        </div>
        <Link className="welcome-art" href={`/games/${featured.id}`} aria-label={`Play ${featured.title}`}>
          <Poster theme={featured.theme} />
          <span className="edition-tag">
            A world of words
            <br />
            <strong>in nine letters.</strong>
          </span>
        </Link>
      </section>
      <div className="section-heading">
        <h2 className="section-title">Pick your kind of challenge</h2>
        <span>Four lovely places to start</span>
      </div>
      <div className="cards">
        {launch.map((g) => (
          <GameCard key={g.id} game={g} roundCount={getRounds(g.id).length} />
        ))}
      </div>
      <Link className="family-invite" href="/family">
        <span className="envelope" aria-hidden="true">
          ♡
        </span>
        <div>
          <span className="eyebrow">Family space · invitation required</span>
          <h2>A window into the family.</h2>
          <p>A private place for everyday photographs, favourite memories and a birthday book. Members sign in to see it.</p>
        </div>
        <span className="invite-link">Come on in ↗</span>
      </Link>
      <Link className="hexabble-invite" href={`/games/${hex.id}`}>
        <Poster theme={hex.theme} />
        <div>
          <span className="eyebrow">Play together · on one device</span>
          <h2>Make room at the hexagonal table.</h2>
          <p>Hexabble brings word-building, clever moves and friendly competition to a full local game for two to four people.</p>
          <span className="card-link">Set up a game ↗</span>
        </div>
      </Link>
      <details className="all-games">
        <summary className="section-title">
          Find your next favourite · all {GAMES.length} games ({playableCount} playable now)
        </summary>
        <div className="cards">
          {GAMES.map((g) => (
            <GameCard key={g.id} game={g} roundCount={getRounds(g.id).length} />
          ))}
        </div>
      </details>
      <p style={{ marginTop: 24 }}>
        <Link href="/archive">Browse the archive</Link> · <Link href="/games">Search all games</Link>
      </p>
    </>
  );
}
