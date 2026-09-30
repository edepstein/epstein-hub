import type { Metadata } from "next";

export const metadata: Metadata = { title: "Help" };

export default function Page() {
  return (
    <>
      <div className="hero">
        <div>
          <h1>Help</h1>
        </div>
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: "<h2>Saving</h2><p>Progress saves in this browser after every accepted move. If your browser blocks storage (for example some private windows), you can still play but progress is lost when you leave. A damaged save is set aside rather than deleted, and a fresh attempt starts.</p>\n<h2>Rejected answers</h2><p>Every game explains why an entry was not accepted and keeps what you typed so you can correct it. Rejected entries never cost points unless a game's rules say a legal wrong guess counts (Word Deduction).</p>\n<h2>Hints</h2><p>Hints are optional and say what they reveal before you take them. Using one is recorded on your result, never hidden.</p>\n<h2>Keyboard</h2><p>Every game can be played with a keyboard. Enter submits, Escape clears or closes a dialog, Backspace edits, and arrow keys move around boards.</p>\n<h2>Text size</h2><p>Use the A+ button or Settings to enlarge text. Browser zoom to 200% is also supported.</p>" }} />
    </>
  );
}
