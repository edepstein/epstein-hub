import type { Metadata } from "next";
import { ESDB_NOTICE } from "./notice";

export const metadata: Metadata = { title: "Credits" };

export default function CreditsPage() {
  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">Provenance</div>
          <h1>Credits and notices</h1>
        </div>
      </div>
      <div className="prose">
        <h2>Puzzles</h2>
        <p>All puzzles, clues, categories and explanations are original to Word Club. None are copied from published newspaper or app puzzles.</p>
        <h2>Word list</h2>
        <p>
          Word validation uses a list of about 253,000 words, built by merging three sources: the English Speller Database (ESDB,
          formerly SCOWL) at size 95 with British -ise, British -ize and American spellings (revision
          1e5b7d3a72f47a71da5d28686c1dd4b397178485); the public-domain ENABLE word list; and the 127 two-letter words of Collins
          Scrabble Words. Like Collins Scrabble Words, it accepts American spellings as well as British ones, but puzzle answers
          always use British spellings. It is not a copy of Collins Scrabble Words, which is licensed and not included. A small
          exclusion list removes slurs only. The list has not yet been reviewed by an editor.
        </p>
        <p>
          <a href="/dictionaries/wc-membership-v2.txt">Word list</a> · <a href="/dictionaries/wc-membership-v2.manifest.json">Build manifest</a> ·{" "}
          <a href="/dictionaries/ESDB-Copyright.txt">Full ESDB notice</a>
        </p>
        <h2>Hexabble</h2>
        <p>
          Hexabble&apos;s rules engine is migrated from a family-supplied reference implementation, preserved unchanged in the
          project&apos;s reference folder. That original shipped with a merged word list of unverified provenance, which Word Club does
          not use; this site validates Hexabble words against the word list above instead. Publication permission for the Hexabble
          name, board and code is recorded as an open release gate.
        </p>
        <h2>ESDB / SCOWL notice</h2>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: ".8rem", background: "var(--card)", padding: 16, borderRadius: 12, border: "1px solid var(--line)" }}>
          {ESDB_NOTICE}
        </pre>
      </div>
    </>
  );
}
