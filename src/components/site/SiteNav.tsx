"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Play", match: (p: string) => p === "/" || p.startsWith("/games") || p.startsWith("/play") || p.startsWith("/practice") },
  { href: "/library", label: "Library", match: (p: string) => p.startsWith("/library") || p.startsWith("/archive") },
  { href: "/family", label: "Family", match: (p: string) => p.startsWith("/family") || p.startsWith("/sign-in") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export function SiteNav() {
  const path = usePathname() ?? "/";
  return (
    <nav className="nav" aria-label="Main navigation">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.match(path) ? "active" : undefined} aria-current={l.match(path) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function AsideNav({ games }: { games: { id: string; title: string; playable: boolean }[] }) {
  const path = usePathname() ?? "/";
  const active = (id: string) => path === `/games/${id}` || path.startsWith(`/play/${id}/`) || path.startsWith(`/practice/${id}`);
  const launch = games.slice(0, 4);
  const rest = games.slice(4);
  return (
    <aside className="aside" aria-label="Game navigation">
      <Link href="/" className={path === "/" ? "active" : undefined}>
        Today&apos;s selection
      </Link>
      <Link href="/games" className={path === "/games" ? "active" : undefined}>
        All games
      </Link>
      <h2>Daily favourites</h2>
      {launch.map((g) => (
        <Link key={g.id} href={`/games/${g.id}`} className={active(g.id) ? "active" : undefined}>
          {g.title}
        </Link>
      ))}
      <h2>Explore</h2>
      {rest.map((g) => (
        <Link key={g.id} href={`/games/${g.id}`} className={active(g.id) ? "active" : undefined}>
          {g.title}
          {g.playable ? null : <span className="sr-only"> (coming soon)</span>}
        </Link>
      ))}
      <h2>Your club</h2>
      <Link href="/library" className={path === "/library" ? "active" : undefined}>
        Library
      </Link>
      <Link href="/archive" className={path === "/archive" ? "active" : undefined}>
        Archive
      </Link>
      <Link href="/family" className={path.startsWith("/family") ? "active" : undefined}>
        Family space
      </Link>
    </aside>
  );
}
