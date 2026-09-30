# Daily Crossword: editorial grid and full solving upgrade

## Before → after

The supplied BALL/AREA/LEAD/LADY and SAND/AREA/NEAT/DATE examples are valid four-by-four word squares with identical across and down answers. They test intersections but do not constitute engaging production crosswords. Upgrade to independently authored connected grids, a complete cell/clue editor interaction and human-reviewed quick/cryptic content. Retain both squares as regression fixtures, never promote them simply because their validator passes.

## Whole engine and solving loop

Derive entries and conventional shared clue numbering from grid geometry. An entry’s stable data id is not its display number. Activate a cell and direction, type letters, advance within the entry and propagate changes at intersections. Allow incorrect letters while solving; correctness is revealed only on deliberate check/reveal or completed-grid submission. Preserve pencil entries separately. A filled grid triggers verification; wrong completion prompts another look without disclosing locations unless requested.

Check and reveal operate at cell, entry or whole-grid scope and record assistance. Completing the verified grid opens a result containing edition, assistance and optional elapsed time, then clue explanations and replay/archive choices. Refresh retains cell contents, pencil state, active clue and help history. A timer is optional, pausable and hidden by preference. Practice replay never replaces the original daily assistance record.

## Content and genuine difficulty

Quick and cryptic are separate editions. Gentle quick uses clear familiar definitions; Standard offers fair misdirection and richer vocabulary; Expert quick has demanding interpretation with adequate crossings. Cryptic difficulty comes from devices, indicator subtlety and multi-step constructions, with a complete fair parse. A small grid is not inherently easy, and a rare answer alone does not make a clue interesting.

Specify independent house rules for symmetry, connectivity, minimum answer length, checking density, unchecked runs, names and abbreviations. Generate or construct a grid meeting those rules, then author original clues. Ordinary spelling candidates support fill search, while editorial answer choices and proper names need separately approved policy. Every clue must match enumeration and crossing letters. Two independent editors solve without answers and inspect definition/parse correctness. Pilot distinguishes clue difficulty from frustrating fill obscurity.

Production needs a clue database, versioned grid editor, printable proof and responsive preview. Do not scrape newspaper clues. Candidate dictionary licensing does not grant rights to another publisher’s crossword selection. Publish corrections transparently and freeze a live round’s original scoring.

## Complete UI states and acceptance

Design loading, selected cell/direction, typing, pencil mode, clue list navigation, incomplete submission, incorrect completion, checked cell/entry/grid, revealed cell/entry/grid, won, result, explanation, archive, restored/offline run and unavailable-round fallback. Mobile pins the active clue and supports controlled zoom; a textual clue-entry form enables nonvisual solving. Arrow, Tab, Shift+Tab, Backspace and Enter interactions must be deterministic.

Acceptance: both word-square fixtures validate all crossings and display conventional numbering. A new production-like blocked grid proves connectedness and entry coverage. Changing a crossing letter updates both entries. Filling a wrong grid never shows success. Check/reveal marks assistance and survives refresh. Keyboard-only completion works with the clue list; 200% zoom retains controls. At least one genuinely edited Quick and one Cryptic round pass independent solving before those editions can launch. This is full playable puzzle parity, not a picture of a crossword.

Preserve [the original game brief](../games/daily-crossword.md) and [its original fixtures](../content/daily-crossword.json). Implement alongside the shared architecture, dictionary, design and release documents in `../docs/`. Record any rules change rather than silently merging contradictory versions.
