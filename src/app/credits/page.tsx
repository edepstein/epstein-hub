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
          Word validation uses a British English spellings list exported from the English Speller Database (ESDB, formerly SCOWL),
          revision 1e5b7d3a72f47a71da5d28686c1dd4b397178485, size 60, British and recognised -ize variants, 81,901 words. A small
          exclusion list removes clearly offensive terms. It is a spellings list, not a dictionary of definitions, and it has not yet
          been fully reviewed by an editor.
        </p>
        <p>
          <a href="/dictionaries/gb-esdb-v1.txt">Word list</a> · <a href="/dictionaries/gb-esdb-v1.manifest.json">Build manifest</a> ·{" "}
          <a href="/dictionaries/ESDB-Copyright.txt">Full upstream notice</a>
        </p>
        <h2>Hexabble</h2>
        <p>
          Hexabble&apos;s rules engine is migrated from a family-supplied reference implementation, preserved unchanged in the
          project&apos;s reference folder. That original shipped with a merged word list of unverified provenance, which Word Club does
          not use; this site validates Hexabble words against the ESDB list above instead. Publication permission for the Hexabble
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
