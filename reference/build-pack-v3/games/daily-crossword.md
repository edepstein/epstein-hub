# Daily Crossword: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/daily-crossword.json](../content/daily-crossword.json). Supplied rounds: ball-square, sand-square.

## Rules and entry states

A crossword consists of a rectangular grid with explicit blocked cells, across/down entries and clues. Each unblocked cell contains one letter in version 1. Rebus cells and punctuation inside cells are out of scope. Answers use the common normalization policy, with original spacing represented in enumeration or explanation rather than in cell contents. Every across/down intersection must agree.

State tracks filled cells, active entry, active cell, pencil marks, checked/revealed cells and assistance. Tapping an unblocked cell activates its entry; tapping it again switches direction if both apply. Typing fills the active cell and advances within that entry. Backspace clears the current filled cell or moves backwards if empty. Tab advances to the next clue; Shift+Tab goes backwards. Arrow keys move spatially. Enter switches direction where possible. Provide an accessible clue-first entry form so nonvisual users do not need to navigate a spatial grid.

A fully filled grid triggers solution validation. If every cell matches, mark complete. If not, say that some entries need another look without locating errors unless the player requested checking. Wrong letters are allowed during ordinary solving; do not immediately expose correctness on every keystroke. Check cell/entry/grid is optional assistance. Reveal cell/entry/grid also marks assistance. Pencil mode is visually distinct and stores tentative letters; determine completion only after they are inked or confirmed.

## Editions, difficulty and score

Quick and cryptic are separate editions. Gentle uses direct clues and familiar answers. Standard mixes direct definitions with fair misdirection. Expert quick clues demand interpretation; Expert cryptics have defensible definitions, indicators and letter operations. A small grid is not automatically easy, and a cryptic is not simply a difficult quick crossword.

Track completion and assistance; an optional timer can be hidden or paused when the tab is inactive. Do not rank a revealed solution with an unassisted one. A daily compact puzzle and a larger weekend edition can share the same engine. Larger puzzles need saved place, clue filters and an easy return to the active entry.

## Numbering and fixtures

Compute conventional entry numbering from grid geometry: enumerate cells row-major; give a number to any cell starting an across or down entry, sharing the number when both start there. The supplied fixture entry ids are stable identifiers, not display clue numbers. Directional start detection must not invent one-letter entries. The grid data determines which consecutive runs form entries; the fixture entries must cover those runs exactly.

The two original 4×4 word-square demos have BALL/AREA/LEAD/LADY and SAND/AREA/NEAT/DATE as rows. Their columns produce the same four words respectively. Every crossing is correct, each entry has a clue and enumeration, and there are no blocked cells. Identical across/down answers are deliberate minimal engine fixtures, not acceptable production crossword quality. Use them to verify navigation, shared-cell updates, numbering and completion, then replace them with independently edited grids.

## Editorial production and validator

A production crossword requires a grid builder and clue editor. Validate dimensions, blocked-cell representation, answer lengths, letter agreement at intersections, entry coverage and numbering. Check connectedness of the open grid and sufficient checking letters according to the chosen house style. Document symmetry, minimum entry length and unchecked-cell limits rather than assuming another publisher’s style. Reject accidental orphan cells and duplicate clue/answer patterns unless explicitly editorially justified.

Every clue is independently authored or sourced under an appropriate licence. Quick definitions must be accurate in UK English; cryptic clues require an explanatory parse. Two editors solve without seeing the answer sheet. Review regional references and proper nouns for fairness; the house policy must state when names are allowed. Run a printable proof as well as an interactive preview so visual truncation does not conceal content errors.

## Layout

On wider screens put grid and clue lists side by side. On mobile pin the active clue above a comfortably sized grid and open the list beneath. Never shrink letters until the puzzle becomes unreadable; allow a controlled zoom with a clear overview. Selected cell, active entry, pencil state, error check and revealed status need distinct non-colour cues. Keep clue text selectable and expose answer length before the player starts typing.

## Shared dictionary and release contract

Treat these specifications as build instructions, not certification of a released implementation. Follow [product and site](../docs/01-product-and-site.md), [design system](../docs/02-design-system.md), [architecture and API](../docs/03-architecture-data-api.md), [dictionary/content policy](../docs/04-dictionaries-and-content.md), [testing and release](../docs/05-testing-and-release.md) and [build batches](../docs/06-build-batches.md). Where the game’s exact mechanics differ, the explicit game rule takes precedence; shared privacy, accessibility and content gates remain mandatory.

Use two pinned datasets: an approved membership lexicon for playable words, and a narrower curated answer/common-target list. A generator may not treat every dictionary entry as an appropriate daily answer. Production sourcing must record provenance, redistribution rights, version, transformations and all required notices. The project’s shared policy may build a UK candidate list from ESDB/SCOWL; a human editor still decides common-answer suitability. Do not scrape newspaper puzzles, copy published clue sets or assume a word list licence covers another publisher’s puzzle selection. These authored fixtures are a finite engine test vocabulary and are clearly marked demo.

Normalize letter-game input to upper-case ASCII A–Z under an explicit locale policy. Leading/trailing whitespace can be removed, but do not silently strip internal punctuation into a different word. Crossword clues and group tiles can include readable punctuation, multiword labels and accented text; answer normalization is separate from displayed content. Publish the policy for inflections, proper names, UK/US variants, abbreviations, archaic vocabulary and offensive terms. Reject excluded entries with a useful reason. Never make difficulty depend on surprising unwritten exclusions.

Pin rulesVersion and dictionaryVersion to a round. A daily release uses the site’s documented Europe/London date, not a viewer’s device clock. Reload and device handover retain the same round and assistance. A dictionary amendment creates a new version; do not alter live accepted answers halfway through a day. An erratum can preserve original scores while publishing a transparent correction. Keep edits auditable and preserve the original authored solution for diagnosis.

## Common user experience and accessibility

Before a first round, show a concise rules card and one interactive example; experienced players can skip it and reopen it later. Offer Gentle, Standard and Expert without age-based assumptions. Remember the chosen mode, font size and reduced-motion preference. Explain the difference between a mode that changes assistance and one that supplies a different puzzle. Never compare those results without a labelled cohort.

The main screen includes game name, date/edition, difficulty, rules/help, active puzzle, progress, undo where applicable and a visible save indicator. Empty, loading, saving, offline, corrupted-save and unavailable-round states need designed messages and a recovery route. Invalid input must not erase work. Feedback should be descriptive, restrained and never depend on vibration, sound or colour. Large adjustable text, generous touch targets, visible keyboard focus and logical tab order are acceptance requirements. Celebrate progress quietly; no intrusive streak pressure or forced timer.

Announce submission results through a concise live region, not every typed character. Test screen-reader names, current selection and instructions with a real accessible workflow. Provide sufficient contrast and zoom to 200% without losing controls. Avoid placing essential buttons behind the mobile keyboard. Reduced motion removes transitions without concealing state updates.

## Persistence, integrity and editorial workflow

A persisted run contains roundId, versions, mode, accepted actions, assistance and lastUpdatedAt. Recompute derived score from accepted actions rather than trusting a client-supplied total. Local guest saving is sufficient for private unranked play; account sync and public comparisons require server reconciliation, authorization and idempotent writes. Save after each accepted action and retain a local draft when network saving fails. Never silently overwrite more recent progress from another device.

Do not publish raw future solutions to clients if the product promises spoiler resistance. Separate public puzzle payloads from editorial answers and reviewer metadata. Editors work through draft → generated → machine-validated → independently solved → accessibility-previewed → approved → scheduled → published → archived. The fixtures start as demo and cannot be scheduled merely because JSON parses. Machine checks prove structural claims; independent review judges clue fairness, challenge and alternative interpretations.

Maintain at least four weeks of approved content before a recurring public launch. Exercise a missed-content fallback that serves a clearly labelled archive round rather than an unchecked AI-generated puzzle. Gather completion, assistance, abandonment and reporting signals with proportionate privacy; no invasive behavioural tracking. Pilot with experienced word-game players as well as first-time users. A passing software test does not demonstrate enjoyment. Release requires editorial sign-off, device testing, accessible completion, reliable saving and a rollback path.

## Fixture contract and acceptance

The sibling JSON uses schemaVersion, gameId, locale and rounds. Each round pins status=demo, rulesVersion=1.0 and dictionaryVersion=demo-uk-v1. Coordinates are zero-based. Fields vary by game deliberately; an implementation must validate its own tagged game schema rather than guess from field names. The complete answer material is included for reproducible local engine tests and must not be shipped unchanged as hidden competitive content.

Implement positive and negative tests from the fixture, not only happy-path screenshots. Verify that every disclosed total, route and answer derives from data. Test refresh mid-round, assist then complete, invalid input then correction, keyboard-only completion, touch selection, screen-reader instructions and result sharing without spoilers. Content validators should emit actionable round ids and field paths. A failure blocks publication rather than being caught and ignored. Record remaining uncertainty explicitly in the completion report.
