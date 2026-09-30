import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <h1 className="section-title" style={{ marginTop: 0 }}>We could not find that page</h1>
      <p>It may have moved, or the link may be incomplete.</p>
      <Link className="btn" href="/">Back to today&apos;s games</Link>
    </div>
  );
}
