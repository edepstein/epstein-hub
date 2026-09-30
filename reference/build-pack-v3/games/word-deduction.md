# Word Deduction: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/word-deduction.json](../content/word-deduction.json). Supplied rounds: crane, plant, share.

## Rules and feedback algorithm

The standard round contains one five-letter answer and six accepted guesses. A guess must be a five-letter word in the approved guess list. The curated answer list is a stricter subset. The feedback states are correct position, present in another position and absent. Display them using words/icons/patterns as well as colour.

Feedback requires two passes. First mark exact-position matches and decrement those answer-letter counts. Then scan remaining guess positions left to right: mark present only while an unused count of that letter remains, otherwise absent. Never mark every repeated occurrence present merely because the answer contains one occurrence. The EERIE-versus-CRANE fixture yields absent, absent, present, absent, correct. This checks that the exact final E consumes the answer’s only E.

State is ready → editing row → submit → validating → resolved row → next row or won/lost. Invalid dictionary guesses never consume an attempt and preserve input. A successful guess locks the feedback row. Guessing the answer wins immediately. After the sixth valid incorrect guess, reveal the answer with a short definition and offer a fresh practice round. A daily cannot be replayed for an unassisted score, but may be practised openly.

## Modes and scores

Gentle mode offers an optional first-letter clue and additional progressive assistance; display six rows initially and let assisted practice continue after exhaustion. Standard uses six valid attempts without starting assistance. Expert keeps six guesses and enforces the revealed constraints. Hard mode requires known correct positions, previously revealed minimum letter counts and exclusion of a yellow letter from its previously incorrect position. It does not ban all grey letters indiscriminately because a grey repeated copy may coexist with a yellow/green copy.

There is no aggregate points formula. Track completion, guesses used and assistance. An assisted result is not placed in the unassisted comparison cohort. A player can switch to Gentle assistance mid-round, but cannot erase that assistance marker. Avoid forcing expert mode on subsequent days. Difficulty should be calibrated using common-answer familiarity, information branching and repeated-letter structure; an obscure answer is not a legitimate substitute.

## Keyboard and data

The on-screen keyboard shows the strongest established state for each letter: correct over present over absent, while the row retains occurrence-specific feedback. This summary must not imply that all copies of a green letter belong in the answer. Support physical typing, paste of a single five-letter word, Backspace and Enter. Screen-reader announcements should describe the row once, such as “C: absent; R: present…” without repeated chatty updates.

The three authored fixture answers are CRANE, PLANT and SHARE. Each supplies the same finite demo guess list, including EERIE, SLATE and TRACE. Additional plausible guesses are rejected only because this is a limited engine demo; production needs a much larger membership dictionary. Do not label that limited fixture as a complete public word game.

## Content and tests

Choose daily answers from independently curated common UK words. Apply the global proper-name, inflection and spelling policies. The answer service must not ship unrevealed future answers in a public bundle. For an uncompetitive private prototype, local answers are acceptable, but classify that limitation honestly.

Unit tests need duplicate letters in both answer and guess, early win, six misses, invalid guess, reload, feedback conservation and hard-mode enforcement. Preserve a guess history and derive feedback from the pinned answer; never trust client-reported colours. A helper that counts all feedback marked present/correct must not exceed each character’s occurrence count in the answer. Daily answer identity stays fixed across devices and difficulty modes unless the edition explicitly advertises separate puzzles.

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
