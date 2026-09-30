# Dictionaries, premade rounds and content operations

## What is provided

Each game has a complete implementation brief and original JSON demonstration rounds under `content/`. These make it possible to build real mechanics immediately. They are not a four-week daily editorial bank, not calibrated difficulty evidence and not sourced from Metro or NYT. Birthday data is explicitly fictional/placeholders and cannot be imported into production as real family history.

The pack also provides a British English candidate word list built from the English Speller Database (ESDB, formerly SCOWL), with a reproducible recipe and upstream notices in `dictionaries/`. See that directory's README and source manifest for the actual included snapshot and counts. This is a spellings source. It is not a licensed definitions API or proof that every listed item should appear in a puzzle.

## Recommended source and verified references

Sources checked 30 September 2026:

- ESDB project and usage: https://github.com/en-wl/wordlist (v2 branch).
- Upstream copyright/notice: https://github.com/en-wl/wordlist/blob/v2/Copyright.
- Export instructions: https://github.com/en-wl/wordlist/blob/v2/README.md.
- Optional familiarity aid only: https://github.com/rspeer/wordfreq. Its code and data have different licences; do not import it as a dictionary or silently redistribute derived data without carrying the appropriate terms. It is not included or required here.

Use the exact preserved upstream notice applicable to the exported data. Do not replace it with an invented generic “MIT” licence label. Other branches, larger exports and Australian/WordNet-derived metadata can carry additional notices. Keep notices and source revision alongside the shipped list.

## Dictionary layers

1. **Candidate GB spellings:** deterministic export, uppercase A–Z forms only, normal British vocabulary. The upstream export may contain proper names, abbreviations and specialist words; filtering spelling alone is insufficient.
2. **Approved gameplay membership:** reviewed terms with flags for proper name, abbreviation, offensive, archaic, specialist and accepted inflections. Each game freezes a version.
3. **Common answer pool:** manually approved words familiar enough to serve as targets, ladders and pangrams. Normal plurals/inflections can be valid guesses without being daily targets.
4. **Round answer set:** explicit curated targets, categories, paths, explanations and alternatives for that puzzle.

For Wheel/Set, accept approved gameplay words satisfying the letter rules; compute common-target progress from the round's target set. Extra approved words are bonus discoveries, not compulsory obscure completion. For Deduction, use a broad approved five-letter guess list plus a narrower curated target pool. Ladder and Circuit validate against frozen membership and use common-word subgraphs for authoring. Crosswords and clue games use authored answer enumerations, not arbitrary dictionary matches. Multiplayer uses an explicit published two-letter+ membership list chosen and reviewed for that game; do not reuse a restricted five-letter pool.

## UK English policy

Case-insensitive, trim surrounding whitespace, Unicode normalise but do not silently merge distinct words. Single-token letter games use A–Z only; apostrophes, hyphens, spaces, names and abbreviations are excluded unless the game explicitly permits them. Accept usual plural and verb forms when present in the approved membership. British -ise and recognised British -ize variants can be accepted where the board permits; do not claim all -ize spellings are American. A puzzle target uses the configured preferred spelling and the clue must fit that form. DRAUGHT and DRAFT are not universally interchangeable.

Accented words require an explicit editorial policy. Do not strip accents and assume the new spelling is valid English. For clue/phrase games, display punctuation and spaces while applying the documented answer-normalisation policy. Family crosswords may use supplied names, isolated from public dictionary rules.

## Premade-round contract

Every round needs stable ID, rules/dictionary versions, intended difficulty, complete board, accepted solutions/alternatives, staged hints, explanation, provenance and status. Keep IDs immutable. Demo fixtures can include answers for developers. Production public API omits them where the architecture calls for server secrecy. Importer rejects missing solutions, incomplete coverage and claimed optimums without proof.

The source-specific field names are documented in each game MD. Map them into the common architecture envelope with tests; do not drop paths, alternatives, allocations or clue enumerations during conversion. Shared Word Board also has a complete proposed tile distribution and premium configuration in `content/shared-word-board-config.json`, kept separate from the uniform deterministic turn fixture and explicitly pending balance review.

## Authoring pipeline

`draft → automated_validated → independent_solve → semantic_review → scheduled → published`. Failed checks return to draft. Publication requires an author plus an independent reviewer; category/cryptic/ambiguous clue puzzles require a second semantic review. Editors cannot use AI-generated confidence as an approval. AI may propose candidates; humans approve each final board and explanations.

Wheel/Set: enumerate letter-constrained membership, select common goals, check target accessibility. Ladder: breadth-first search proves optimum on the pinned graph, sample route readability, review alternative paths. Families: check partition mechanically then challenge meanings and competing partitions manually. Trail: solve non-overlapping coverage and all valid paths. Circuit: graph search of last letter + coverage mask proves reachability/optimum where advertised. Crossword/Weave: validate cells, crossings, clue precision and conventions. Fragments/Relay/Staircase: exact token/multiset solver. Phrase Repair: token identity and minimum swap computation, including duplicates. Definitions/links/pairs: review semantic support and alternative answers.

## Difficulty calibration

Initial labels are provisional. Pilot at least 5–8 comparable word-game enthusiasts, include the intended recipient where feasible, and record completion, hints, duration, fairness disputes and enjoyment by game/level. Target more reasoning and planning at Expert while maintaining familiar enough vocabulary. Adjust labels using observed results; do not use duration alone to infer difficulty or infer impairment from age.

## Production inventory and cadence

Four daily launch games need at least 28 approved boards each: 112 editions. Separate difficulty boards increase that count. Hint modes may reuse a board if clearly identified. Maintain a two-week emergency reserve. Expansion games need their own review and supply capacity before activation. Generate weekly batches offline and schedule approved content; never generate live daily puzzles without validation. Publish an archive only of approved editions.

## Correction and reporting

Players can report rejected words, ambiguous categories, broken boards and inaccessible input without supplying family information. Editor tracks issue, affected version, decision and correction. Withdraw broken content, offer a replacement and preserve already earned personal progress. Never silently change the answer under an active player. Changes to dictionary membership create a new version and do not retroactively rewrite pinned puzzle scores.

## Gate

The bundled GB list and sample rounds make implementation possible; public release requires the approved word layer, human-reviewed daily inventory, tested importers and observed playtesting. Mark these as open gates until actually completed.
