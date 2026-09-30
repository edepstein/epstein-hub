# Letter Wheel: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/letter-wheel.json](../content/letter-wheel.json). Supplied rounds: education, reactions, dangerous.

## Rules and transitions

The board contains exactly nine physical letter positions. One is marked required. A word must contain at least four letters, contain the required letter, and use each physical position no more than once. Therefore two copies of A permit two As, while one A does not. Case does not matter. Rearranging the display changes no rules or solution set. Words with apostrophes, spaces or hyphens are not accepted in version 1. Reject them with a reason rather than silently removing punctuation.

The state machine is ready → composing → submitted → composing, with optional complete. Submission branches into accepted new word, already found, missing required letter, too short, letter unavailable, or not in dictionary. An invalid submission preserves the typed input for correction. A successful submission records the word, clears input, announces points and updates progress. There is no failed terminal state. Completing the common-word target unlocks a celebration; the player may keep finding further accepted words. A nine-letter target is always present but never required to enjoy partial completion.

Maintain input, found words, score, shuffled display permutation, revealed hints and common-target status. No countdown or compulsory turn cap. Enter submits, Backspace removes one letter, Escape clears the current input after a reversible interaction. A virtual alphabet composed only of available letters is optional. Tapping letter buttons appends that letter only if a corresponding unused instance remains. When two instances exist, show remaining availability accessibly.

## Difficulty, points and content

Gentle, Standard and Expert describe the curated rack and clue support, not a different dictionary hidden behind the same board. Gentle racks should yield several immediately recognisable words. Expert racks demand transformations and less obvious placements while retaining familiar answers. Difficulty is estimated through answer frequency, word-length distribution, number of common starting discoveries and pilot behaviour. Nine-letter answers alone do not make a rack hard.

Each accepted word scores its length. A nine-letter word earns a further nine points. Total possible score is computed from the pinned accepted lexicon. Progress towards the separately pinned common-word list is shown as “8 of 20 everyday words”; exhaustive completion has its own display. Do not promise “all words” while leaving the dictionary undefined. The demo fixtures contain finite accepted lists and their totals are complete only within those lists.

Hints progress from a broad meaning or starting letter to a definition and then a revealed word. Revealing a word marks it assisted and scores zero for that word; it still counts towards completion. Invalid guesses and repeated submissions carry no penalty. A word report can be submitted without interrupting the game.

## Generator and fixture requirements

Select a familiar nine-letter target; derive the rack and candidate required letters; enumerate the approved lexicon by multiset containment. Require a useful number of common answers and reject racks dominated by inflections or controversial vocabulary. Select the central letter using solution breadth and pilot difficulty. An editor checks that excluded obvious words have a defensible published policy.

The three original rounds are education, reactions and dangerous. The reactions rack also admits creations as a nine-letter target. This intentional multiple-target case must be accepted. Assert every accepted word has the required letter and that its character counts fit the rack. Recompute maximumScore from the data. Property tests should cover duplicated rack letters even though these three fixture racks have distinct letters. A production dictionary upgrade triggers regeneration and editorial review, never silent modification of a live daily.

## Layout and completion

Place the nine large letter buttons above a prominent input field; show the required letter using shape/text as well as colour. On desktop, the found-word list occupies a side panel; on mobile it follows the controls. Sort found words by length or alphabetically at the player’s choice. Avoid animated rearrangements while the player is typing. Result sharing contains progress and assistance, never the rack’s unrevealed nine-letter answer.

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
