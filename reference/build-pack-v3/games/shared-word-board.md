# Shared Word Board: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/shared-word-board.json](../content/shared-word-board.json). Supplied rounds: deterministic-three-turns.

## Scope and deterministic rules

This is a later-phase asynchronous two-player game, not a first-release dependency. The supplied demo uses a nine-by-nine board, seven tiles per rack, uniform one-point letter values, no blank tiles and no premium cells. The first move must cover row 4, column 4 using zero-based coordinates. Subsequent placements must connect orthogonally to the existing board. New tiles in a turn lie in one row or column; gaps between them must already be occupied. Every resulting horizontal or vertical word of at least two letters must belong to the agreed dictionary.

Players cannot move committed tiles, place over a filled cell or submit letters not in their rack. A single-tile placement is valid if it forms an accepted connected word. Diagonal adjacency alone does not connect a move. The move score sums the scores of every newly formed word including existing letters in those words; an intersection tile can contribute to both an across and down word. Ignore one-letter runs. No seven-tile bonus in version 1.

After a placement, consume played tiles and refill to seven from the shuffled bag, then hand over the turn. Passing changes player without drawing. Exchange selects rack tile identities, requires at least seven tiles in the bag, removes replacements from the pre-exchange bag and then returns exchanged tiles for reshuffling; it earns no points and consumes the turn. Six consecutive pass/exchange turns end the game. A placement resets that counter. When the bag is empty and a player empties their rack, the game also ends. At bag-empty end subtract each player’s remaining tile points; transfer the opponent’s remaining tile value to the player who went out. At pass/exchange end only subtract rack leftovers. Resignation awards victory to the other player without inventing a final score.

## Server authority and state

State is waiting for invite → active turn → validating transaction → next player or finished. A move request includes match id, version, player identity, unique idempotency key and proposed tiles. The server checks authentication, turn ownership, expected version, rack membership, geometry, connectivity, dictionary and score in one atomic operation. Persist board, racks, bag, score, move history, consecutive inactive count and version before notifying the opponent. Duplicate requests return the original result. A stale version returns current authoritative state for reconciliation.

Do not expose an opponent’s rack or bag order. A reconnect fetches a redacted match snapshot and restores the player’s uncommitted local proposal only when compatible. Offline placement remains a draft; it cannot be declared accepted before validation. Optimistic visual feedback must be labelled pending. Protect state-changing requests from forged identity and enforce match membership for every read, export and notification.

## Fixture and scoring proof

The supplied deterministic match starts p1 with CATSERN and p2 with ARTESOL. Bag order begins A R T B E E A. P1 places CAT across row 4, columns 3–5: score three, draws ART and holds SERNART. P2 adds S at row 4, column 6: the formed word CATS scores four, draws B and holds ARTEOLB. P1 places A, R, T down column 3, rows 5–7, extending the existing C into CART: score four, draws EEA and holds SENREEA. Totals are p1 seven and p2 four. These moves do not end the match.

This fixture establishes deterministic geometry, extension scoring, rack subtraction and refill. Its finite bag and dictionary are not a balanced public distribution. Production needs an independently specified tile distribution, fairness review and simulation of vowel/consonant starvation. Do not silently import another game’s branded board, assets or premium pattern.

### Full proposed public/practice configuration

`../content/shared-word-board-config.json` supplies a complete original candidate configuration: 9x9 board, seven-tile racks, 91 letter tiles plus two blanks, explicit frequencies/values, four double-word cells and four triple-letter cells. It is rules version `1.1-candidate`, separate from the uniform fixture's `1.0`. It makes implementation concrete without claiming competitive balance. Keep productionEnabled false until its listed gates pass; unranked local practice can use it with that label.

Blank tiles have unique IDs, value zero and a chosen A–Z face assigned when submitted; that face cannot change after commitment. Letter multipliers apply only to newly placed tiles in the current move; sum the word, then multiply by all newly covered word multipliers. A crossing uses the new tile's applicable premium in each newly formed word. Existing tiles on previously used premium cells use their base values. No seven-tile bonus. Build unit tests for both configurations; never replay the uniform fixture against premium scoring. All other placement, exchange, pass, resignation and terminal rules above apply.

Run a server-side Fisher–Yates shuffle with cryptographic random integers over tile IDs. Preserve the resulting bag securely for match replay; never expose it to either client. Generate enough local practice simulations to assess blocked boards and vowel/consonant starvation, then adjust a versioned configuration rather than mutating active matches. A fully occupied board has no placements, but pass/exchange terminal rules still finish the match. Production membership requires a reviewed two-letter-and-longer GB list, not the general candidate list wholesale.

## Difficulty, interaction and operating requirements

Gentle means practice with hints or a transparent beginner bot, Standard means familiar-human asynchronous play, and Expert means stronger search or optional rated play. The membership dictionary is agreed before the match and remains pinned throughout. Practice bots can search legal moves; difficulty changes search depth or strategic evaluation rather than secretly accessing future bag order.

Support tap rack tile then board cell, keyboard selection and drag as an alternative. Give each repeated rack tile a unique identity. Provide Recall all, Swap selected, Pass and Submit. Preview formed words and predicted score, but server response is final. Confirmation is appropriate for resigning; ordinary moves remain fluid. Explain rejected moves without consuming a turn.

Public release requires robust invitation controls, user blocking/reporting, notification preferences, rate limits, retention/deletion controls, moderation and reconnect tests. No public chat or open matchmaking in the first version. Begin with invited family contacts. Screen readers need coordinate labels and a textual move builder. Tests must cover stale requests, duplicate submissions, race conditions, illegal gaps, cross-word scoring, rack duplicates, bag exhaustion, exchanges and all terminal states.

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
