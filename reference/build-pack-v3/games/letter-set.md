# Letter Set: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/letter-set.json](../content/letter-set.json). Supplied rounds: parents, article, teachers.

## Rules and transitions

Seven different letters form the board. One is required in every word. Words have at least four letters, use only the seven supplied letters, and may repeat a supplied letter without limit. These repetition rules deliberately differ from Letter Wheel: the rules card must make that distinction explicit. A word using every supplied letter at least once is an all-letter word. It may be longer than seven letters and may contain repetitions.

State moves ready → composing → validating → composing or complete. Validation checks length, permitted characters, required-letter presence, membership and duplication in that order. An invalid entry preserves input. A repeated accepted entry receives “Already found” without changing score. New accepted words add points, clear input and persist. Complete means the selected common-word target is reached; exploratory play continues.

The player may shuffle the six outer letters without moving the required letter or changing availability. Tap adds a character; direct typing is equally supported. Enter submits, Backspace deletes and Escape clears current input. Use a non-derivative board arrangement, for example two rows of three outer letters around a central text badge rather than recreating another product’s visual identity. No fixed honeycomb identity is required.

## Difficulty and scoring

Four-letter words score one point. Longer words score their length. An all-letter word gains seven additional points. Sum scores over the pinned accepted list to calculate total possible points. The progress target may exclude approved rare words, but the interface must label that target as curated and distinguish it from total dictionary completion.

Gentle boards have multiple familiar long discoveries and an accessible all-letter answer. Standard boards offer a balanced answer set. Expert boards have fewer obvious constructions and a more demanding all-letter answer, without relying on specialised vocabulary. Use word frequency and observed solver behaviour to calibrate; letter rarity is not sufficient. When all-letter answers include transparent, an editor should judge whether a player can reasonably derive it from the rack.

Hints can reveal an unfound word’s length, initial letter and definition, followed by the answer. A revealed answer contributes zero points and is tagged assisted. No penalty for exploring plausible spellings. Show an encouraging factual error reason, such as “This word needs H”, rather than a vague wrong-answer animation.

## Content and solver

Generate boards from common words with exactly seven unique letters. For each possible required letter, enumerate the approved lexicon using set containment and minimum length. Validate that at least one common all-letter word remains. Reject sets dominated by repeated conjugations or marginal spellings. Parent and parents can both be accepted if the global inflection policy allows them; do not make per-puzzle arbitrary exceptions.

The parents fixture uses E A R T S N P and requires P. Transparent is a valid longer all-letter word with repeated characters. The article fixture uses A C E I L R T and requires R; articles is intentionally excluded because S is absent. The teachers fixture uses E A R T H C S and requires H. These are complete rounds only within their explicitly finite demo lexicons.

Check every accepted word against the letter set, required letter and minimum length. Verify allLetterAnswers equals the computed result, and maximumScore equals the sum. Test a repeated-letter accepted word, a missing central letter, an unavailable character and duplicate submission. Pin dictionaryVersion so a resumed game never changes its accepted universe.

## Presentation and end states

Use a clear required-letter label, visibly different from outer letters. Show found words in a compact expandable list and all-letter discoveries in a separate highlighted area. Progress labels must explain their numerical denominator. Completion is a quiet optional moment, not a modal that blocks further play. Keep “Play another”, “Review hints” and “Continue finding words” available. Sharing exposes only completion and assistance, not answers.

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
