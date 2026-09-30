import Link from "next/link";

export default function RoundNotFound() {
  return (
    <div className="empty" data-testid="round-unavailable">
      <h1 className="section-title" style={{ marginTop: 0 }}>This round is not available</h1>
      <p>It may have been withdrawn or corrected, or the link is incomplete. Your saved progress for other rounds is unaffected.</p>
      <Link className="btn" href="/games">Choose a game</Link>
    </div>
  );
}
