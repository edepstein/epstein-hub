# Hidden Word Trail: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/hidden-word-trail.json](../content/hidden-word-trail.json). Supplied rounds: weather-garden, serpentine-garden, cooking.

## Rules and path transitions

A rectangular letter grid hides a fixed set of themed answer words. A path moves to any of the eight neighbouring cells, including diagonals. Within one path a cell cannot repeat. Accepted answer paths never overlap previously solved answers. The full intended answer set covers every grid cell exactly once. A theme clue appears above the grid. A longer theme-defining answer is optional in this independent edition; it is not mandatory in the simple fixtures.

State is ready → selecting path → submit → accepted answer, valid non-theme word or invalid path → selecting. Touch users may drag through adjacent cells or tap cells sequentially. Tapping the final selected cell removes it; tapping the immediately preceding cell steps back. An explicit Clear control handles other corrections. Lift-to-submit can be optional; an explicit Submit button is the safe default because accidental drag endings should not punish a player.

The selected path’s letter string is visible as ordinary text. Keyboard users navigate with arrows, add a cell with Space, remove with Backspace, clear with Escape and submit with Enter. A separate accessible list of cells labelled row, column and letter supports nonvisual play. Diagonal directions need explicit keyboard controls or a focus-plus-Space interaction rather than requiring a drag.

## Answers, alternate paths and hints

The published answer set is fixed, but a word may have multiple valid paths. Do not reject an alternative route merely because it differs from the reference path. Initially accept any legal path spelling an unfound target that avoids solved cells and leaves a feasible completion for the remaining answer set. A constraint solver must check feasibility when alternative routes exist. If a route would strand the remaining puzzle, explain that it would block another answer and keep selection reversible. Alternatively design and verify unique-path boards to avoid this issue at launch.

A valid approved non-theme word of at least four letters adds one credit only once per round. Three distinct credits earn one hint. A hint first gives a remaining answer’s definition or start cell; a second reveals its path. Revealed answers are tagged assisted. The fixture non-theme lists are deliberately empty, so paid credits cannot be earned there; free progressive help remains available. Do not require players to find unspecified off-theme words in order to continue.

## Difficulty and scoring

Gentle uses a smaller grid, explicit theme and short accessible routes. Standard uses more indirect connections and routes changing direction. Expert has richer themes, fewer obvious starts and crossing visual distractors, while its actual paths remain unambiguous and playable. Tune grid size together with route shape and theme interpretation, not merely size alone.

Track target answers found, solved cells, non-theme credits and assistance. No timer by default and no penalty for exploratory paths. Completion is the full valid partition. A theme-defining answer, when supplied, receives a distinct explanation rather than a score advantage that encourages spoilers.

## Fixtures and content solver

The first and third 4×4 fixtures have rows TREE/LEAF/RAIN/WIND and BAKE/STIR/PEEL/DICE. Their straight-row targets are tutorial engine tests. The second fixture hides GRASS, TREE and FLOWERS along a serpentine route that crosses row boundaries; all sixteen cells are covered exactly once. Reference coordinates are zero-based. This intermediate demo exercises changing direction and different answer lengths, but its difficulty is not yet calibrated for a production daily.

A production generator uses depth-first search to enumerate paths for each proposed answer, then exact-cover search to determine whole-board solutions. It must verify path adjacency, no repeated cell, spelled word, complete coverage, no intersections and remaining-board feasibility. Editors inspect accidental theme words, ambiguous theme boundaries and visually misleading repeated letters. A puzzle claiming a unique solution needs proof against all candidate target paths, not only checks of one stored reference partition.

## Presentation

Use uniform generous cell targets and clear row/column labels on request. Found answers remain visible on the grid with non-colour markings and in a textual list. The current drag line should not cover letterforms. Pin the theme near the controls, and avoid scrolling the grid under an active drag. Explain completion before inviting another puzzle.

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
