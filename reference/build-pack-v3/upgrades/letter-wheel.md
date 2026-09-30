# Letter Wheel: engine and challenge upgrade

## Before → after

The preserved brief defines a complete ruleset, but `content/letter-wheel.json` supplies only three finite demonstration lexicons: education has eight words, reactions eighteen and dangerous fifteen. These are explicitly limited engine fixtures. A handsome letter wheel with those lists would reject many reasonable guesses and quickly exhaust the challenge. Build the specified engine, then a separate production rack/answer pipeline. Keep all three demos as regression tests; never silently relabel them public dailies.

## Complete playable loop

Start a daily or archive round with a pinned rack, required letter, rules version and approved membership version. Compose by typing or letter taps; show available instances, including repeated letters. Analyse minimum length, required letter, character multiplicity and membership. Invalid and repeated submissions preserve input and consume no points. Accept a new word, calculate length points plus the nine-letter bonus, save raw action and recompute progress. Shuffle changes presentation only. Undo edits composition; committed finds remain recorded. Reach the curated common-word target, show a result, and allow further exploration towards the dictionary total. Restart practice can create a fresh run while preserving the daily result.

Hexabble parity means reversible draft → exact analysis → accepted action → persisted history → meaningful result. It does not mean adding opponents or importing its premiums. Every visible letter and rule must affect legal play; no generic submit animation substituting for validation.

## Meaningful difficulty and content

Gentle, Standard and Expert use different curated racks, not three labels above the same fixture. The approved membership policy remains consistent. Measure common-answer count, frequency distribution, obvious initial discoveries, nine-letter familiarity, inflection share and median pilot assistance. Gentle supports immediate common finds; Standard rewards anagram exploration; Expert makes familiar words harder to discover through rack structure. An obscure spelling must not be the sole expert target. Publish level descriptions and collect difficulty observations without presenting estimates as validated enjoyment.

Enumerate the full approved lexicon by multiset containment. Maintain a curated everyday-word denominator alongside exhaustive accepted total. Require a familiar nine-letter target and independent editorial solving. Production word membership comes from reviewed candidate material with notices retained; spelling membership alone does not certify suitability. Freeze both datasets for a live round. Corrections create an auditable erratum rather than changing the answer set silently.

## UI states and acceptance

Provide onboarding example, loading, active composition, specific invalid reason, duplicate, successful find, assisted reveal, curated completion, continued exploration, offline save pending, restored run, unavailable daily, result and fresh archive/practice selection. Show required letter through shape/text, score derivation, found-word ordering and optional explanation. No forced timer.

Acceptance: reject a second A when the rack has only one; permit it when there are two; accept both CREATIONS and REACTIONS on their fixture rack; reproduce every stored maximumScore; duplicate submission does not increment score; shuffle changes no solution; a revealed word earns zero and marks assistance; refresh preserves finds and version; a production common word omitted by the demo is accepted in production. Keyboard-only and touch users must complete the same round, and results must not disclose unfound answers.

Preserve [the original game brief](../games/letter-wheel.md) and [its original fixtures](../content/letter-wheel.json). Implement alongside the shared architecture, dictionary, design and release documents in `../docs/`. Record any rules change rather than silently merging contradictory versions.
