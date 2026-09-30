import type { Metadata } from "next";

export const metadata: Metadata = { title: "About Word Club" };

export default function Page() {
  return (
    <>
      <div className="hero">
        <div>
          <h1>About Word Club</h1>
        </div>
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: "<p>Word Club is an original collection of word puzzles made as a birthday gift, with a private family space alongside it. Every puzzle here is original; nothing is copied from newspaper or app puzzles.</p>\n<h2>What “practice preview” means</h2>\n<p>Each playable game has a complete rules engine, hints, results, saving and replay. The rounds are original and machine-validated but have not yet been through independent human editorial review, so they are labelled practice. Daily editions will appear only once a reviewed bank exists.</p>\n<h2>Difficulty</h2>\n<p>Gentle, Standard and Expert are separately authored rounds. The labels are the author's intention until real players have tried them; they are not calibrated measurements.</p>" }} />
    </>
  );
}
