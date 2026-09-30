# Word Families: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/word-families.json](../content/word-families.json). Supplied rounds: starter-families, everyday-families.

## Rules and state

A Standard or Expert board contains sixteen distinct term tiles and exactly four intended groups of four. Gentle normally contains twelve terms and three groups; the supplied starter fixture has sixteen because it tests the full board layout. A group is accepted only when its four term identifiers equal one intended answer set. Order does not matter. Each term belongs to one intended group.

State consists of unresolved terms, up to four selected identifiers, solved groups, distinct wrong submissions, mistake count and assistance. Tapping toggles a tile. Enter submits exactly four selected tiles. A correct group moves into a labelled solved panel with its explanation. An incorrect group remains selected and increments mistakes only on its first submission as that unordered set. Repeated identical wrong sets explain “You have tried this group” without an additional penalty.

The standard budget is four mistakes. Reaching the budget presents continue, progressive help or reveal; it does not end the experience forcibly. Continue is marked assisted continuation in comparisons. “One away” feedback is optional: if shown, define it exactly as three selected identifiers belonging to any one intended group. Do not emit this feedback after a solved group’s members have left the board.

## Difficulty and meaningful ambiguity

Gentle groups are concrete and direct. Standard combines ordinary categories with a linguistic category such as words before ROOM. Expert introduces deliberate overlap, shared alternative meanings or transformations, but the intended partition must remain defendable. Do not make trivia obscurity, regional slang or arbitrary author association the sole difficulty.

The first authored fixture groups birds, instruments, gemstones and herbs. It is a tutorial-grade set, not proof of challenge. CRANE has a machine meaning but does not create a competing full group. The second fixture uses things with teeth, footwear, words before ROOM and punctuation. FULL STOP avoids an unnecessary US-first label. Editors must check that ZIP’s teeth is fair and that BED/BATH/CLASS/SHOW consistently combine with ROOM.

Score by groups solved, mistakes and assistance. Do not reward speed by default. Results can show four neutral dots indicating group completion, with optional colour plus text. Difficulty colours should not be copied from another product’s category ranking. The player should see the connection explained, including complete formed compounds when appropriate.

## Editorial validation

All terms need unique persistent identifiers independent of their labels. Multiword terms such as FULL STOP are legal single tiles. Case and whitespace normalisation cannot merge distinct intended terms. Category labels are hidden until solved, while published explanations provide the reasoning.

Automated validation checks term uniqueness, four terms per group, complete coverage, no reused identifier, display permutation and sufficient group count. It cannot prove that no alternative semantic partition exists. Require two independent human editors to solve without seeing the answer; explicitly ask each to invent rival groups and full alternative partitions. If a rival is defensible, revise terms or accept the alternative in a deliberately designed multi-solution edition. Do not silently dismiss a coherent competing solution.

Potentially contentious clues are rejected, not merely tagged. AI may draft candidate sets but never publishes them unchecked. Store editorial notes about tested alternatives, reviewer decisions and puzzle difficulty. Pilot failure patterns should distinguish reasonable wrong hypotheses from incomprehension. A frequently selected incorrect group may reveal a content flaw rather than strong difficulty.

## Controls and persistence

Use a responsive four-column board when adequate width is available; on narrow screens allow two columns while keeping the selection summary obvious. Tiles need enough space for multiword terms. Provide Shuffle, Clear selection, Submit and Help. Shuffling preserves selection and solved groups. Keyboard arrows navigate; Space toggles; Enter submits; Escape clears the selection. A screen reader announces selected count and labels each tile’s state.

Reload restores solved groups, mistakes and the order. The final completion screen explains every connection and lets the player report an ambiguity. A public daily should not leak labels or solutions through client HTML or an unprotected API before completion if spoiler resistance is promised.

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
