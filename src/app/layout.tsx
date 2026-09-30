import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { AsideNav, SiteNav } from "@/components/site/SiteNav";
import { TextSizeButton } from "@/components/site/TextSizeButton";
import { SETTINGS_BOOT_SCRIPT } from "@/lib/settings";
import { GAMES, LAUNCH_IDS } from "@/games/registry";

export const metadata: Metadata = {
  title: { default: "Word Club", template: "%s · Word Club" },
  description: "An original collection of word puzzles, with a private family space.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ordered = [
    ...LAUNCH_IDS.map((id) => GAMES.find((g) => g.id === id)!),
    ...GAMES.filter((g) => !(LAUNCH_IDS as readonly string[]).includes(g.id)),
  ].map((g) => ({ id: g.id, title: g.title, playable: g.availability === "playable-preview" }));
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
      </head>
      <body>
        <SettingsProvider>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <header className="top">
            <div className="header">
              <Link className="brand" href="/">
                <span className="mark" aria-hidden="true">
                  w
                </span>
                Word Club
              </Link>
              <SiteNav />
              <TextSizeButton />
            </div>
          </header>
          <div className="shell">
            <AsideNav games={ordered} />
            <main id="main" tabIndex={-1}>
              {children}
              <footer className="footer">
                Word Club · UK English · made for curious minds · original puzzles, practice preview
                <br />
                <Link href="/about">About</Link> · <Link href="/help">Help</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
                <Link href="/terms">Terms</Link> · <Link href="/credits">Credits &amp; word-list notices</Link>
              </footer>
            </main>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
