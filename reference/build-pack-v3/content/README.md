# Original example content and importer instructions

Each public game file is keyed by `gameId` with a `rounds` array. Every round is `status: demo` and references demo rules/dictionary versions. This is original authored demonstration content, not a scraped or editorially approved daily archive. The shared-board file contains a deterministic turn fixture rather than an editorial solo puzzle. Birthday data is explicitly fictional and production import is forbidden.

## Import mapping

Map id → sourceFixtureId with an environment-prefixed instance ID; difficulty → intended difficulty; status → demo; rulesVersion/dictionaryVersion → pinned engine context. Retain all other game-specific keys inside payload. Do not import `status: demo` into published or scheduled. A production importer requires editorial approvals, immutable hash and publication metadata absent from these demonstration files.

| Game | Visible payload | Developer solution / validation fields |
|---|---|---|
| Wheel | letters, requiredLetter, minimumLength | acceptedWords, nineLetterAnswers, commonTargetWords, maximumScore |
| Set | letters, requiredLetter, minimumLength | acceptedWords, allLetterAnswers, maximumScore |
| Deduction | length, guessLimit | answer, acceptedGuesses, testGuesses |
| Families | displayOrder, mistakeBudget, continueAfterBudget | groups and explanations |
| Trail | grid, theme | answers/path, themeDefiningWord, acceptedNonThemeWords |
| Circuit | sides, minimumWordLength | acceptedWords, referenceChain, restricted-lexicon optimum |
| Crossword | blocks, grid dimensions and entries without answer | solutionGrid, entry answers and enumerations |
| Shared board | configuration public rules + own rack/board only | deterministic bag/racks/turns; never expose another rack in production |
| Ten alternatives | board | solution, hints, explanation |

Actual fixtures are authoritative for their exact keys. Hints and explanations belong to the solution-authoring side, delivered progressively through the relevant engine/API. Common envelopes can have standard hints/explanation fields while retaining per-game structures. Never drop all-letter answers, paths, tile allocations, accepted alternatives or optima in a generic flattening transform.

The finite `acceptedWords` sets intentionally make sample completion deterministic. They do not represent a complete English dictionary. Show “Practice sample · limited demonstration vocabulary” in demo mode. Public production must use reviewed dictionary membership per `docs/04-dictionaries-and-content.md` and recalculate any dictionary-sensitive optimum.

## Validation commands

From the pack root:

```bash
python scripts/validate-pack.py
python scripts/validate-familiar-fixtures.py
python scripts/validate-alternative-fixtures.py
```

Mechanical validation is not semantic approval. Check `qa/VALIDATION.md` for the evidence actually obtained. Production bank and calibration remain open gates.

## Birthday import

`birthday-demo.json` is a schema/UX fixture. Its fake identities, example media references and prompts are not actual family memories or available recordings. Respect `productionImportAllowed: false`; the production seed importer must reject it. Collect genuine content using `birthday/content-collection-checklist.md`.
