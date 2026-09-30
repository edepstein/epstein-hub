import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return (
    <>
      <div className="hero">
        <div>
          <h1>Privacy</h1>
        </div>
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: '<p>Public puzzles need no account. Puzzle progress and preferences are stored only in your browser on this device; Word Club does not send them anywhere.</p>\n<h2>Family space</h2><p>The family space is private and invitation-only. Its photographs and messages are held on the server behind sign-in and per-request permission checks, are never cached for public or offline use, and never appear in public pages, search or shared results.</p>\n<h2>No tracking</h2><p>There are no adverts, no third-party trackers and no behavioural profiling.</p>' }} />
    </>
  );
}
