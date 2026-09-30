# Letter Circuit: complete implementation brief

**Status:** original build specification with independently authored demonstration fixtures. Not a production release or a claim of user-tested enjoyment.

**Seed data:** [content/letter-circuit.json](../content/letter-circuit.json). Supplied rounds: cold-circuit, bread-circuit, share-circuit.

## Rules and transitions

Twelve different letters are arranged into four labelled sides of three. A word has at least three letters and may use only supplied letters. Consecutive letters within a word must come from different sides. A letter may appear multiple times in a word if that side rule is respected. Every word after the first begins with the previous word’s final letter. The objective is to use all twelve letters at least once across the chain.

State contains current input, committed word chain, used-letter bitmask, assistance and board. Ready → composing → validating → chain updated. Invalid submissions preserve input and display the exact reason. A valid word appends to the chain, updates coverage and preloads its last letter as the next required start. Coverage of all twelve letters completes the round. A player can Undo last word, Clear current input or Restart chain. Undo recomputes coverage because a letter may have occurred in another earlier word.

Do not require a word to introduce a new letter. A bridge word covering no new letters can enable a better eventual chain. Do not prevent returning to a previously used word in the engine unless a published rule explicitly bans it; however score comparisons naturally make redundant repetitions unhelpful. Hint paths must respect the existing endpoint, not suggest a word unreachable from the current chain.

## Scoring and difficulty

Primary score is completed chain word count; fewer is better. Break ties by total typed letters if desired, disclosed in advance. Preserve the player’s best completed chain for the round even after further experimentation. The display can show a verified optimum only when search has proved it against the pinned accepted dictionary. Otherwise use “best known”, with date/version, and never label it mathematically optimal.

Gentle boards have several common bridging routes and an accessible multiword solution. Standard requires planning which letters remain uncovered and what final letters enable. Expert targets a demanding low-count common-word route. Difficulty is not just shortest chain length: branching, trap endpoints, word familiarity and pilot solve rates matter. Hints do not alter accepted words; they mark the run assisted.

## Search and data

For each dictionary word, check allowed characters, minimum length and consecutive-side transitions. Map each valid word to start letter, end letter and its twelve-bit coverage mask. Search over endpoint plus coverage mask, with an initial state allowing any valid first word. Breadth-first search yields minimum word count. Keep predecessor words to reconstruct reference chains. Dominance pruning may remove states with identical endpoint and a subset coverage at equal or greater cost, but must be tested for correctness.

The original fixtures are COLD → DRAFT → TRAIN → NEST; BREAD → DUST → TRAIN → NIGHT; SHARE → EARTH → HOUND → DICE. Each union contains exactly twelve distinct letters. Side assignments were generated to make every consecutive letter pair cross sides. Each last letter equals the next first letter. The finite fixture dictionaries contain only their reference words, so the supplied four-word optimum is correct only within those demo dictionaries. Production may admit a shorter route and must recompute.

Validate side sizes, twelve distinct letters, dictionary membership, side transitions, chain connections, full coverage and declared optimum. Include edge cases involving a repeated letter, same-side adjacent pair, a bridge adding no coverage, an undo that removes the only occurrence of a letter and a completed chain containing all letters only cumulatively.

## Interaction

Use independently designed side labels and geometry, for example four letter trays around a central input; it need not reproduce a proprietary perimeter presentation. Direct typing is the primary efficient path. Letter taps obey the same constraints, and the next-start character is clearly labelled. Show the chain as editable sequential chips, the remaining letters as text and the coverage count. Keyboard Enter submits, Backspace edits input and a labelled Undo button changes committed state. No irreversible loss when restarting: retain the best result and offer restoration.

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
