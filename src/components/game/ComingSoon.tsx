import Link from "next/link";
import type { GameDefinition } from "@/games/types";

export function ComingSoon({ game }: { game: GameDefinition }) {
  return (
    <div className="empty" data-testid="coming-soon">
      <h2 className="section-title" style={{ marginTop: 0 }}>{game.title} is not playable yet</h2>
      <p>Its engine and reviewed rounds are still being built. Nothing here pretends to work in the meantime.</p>
      <Link className="btn" href="/games" style={{ textDecoration: "none", display: "inline-block" }}>
        Choose another game
      </Link>
    </div>
  );
}
