# Letter Set: engine and challenge upgrade

## Before → after

The original mechanics permit repetitions, but the three current demonstrations admit only thirteen to sixteen words each. The article fixture correctly excludes ARTICLES because S is unavailable, while parents admits TRANSPARENT. This tests rules, not the vocabulary breadth or sustained discovery of a public game. Upgrade from a limited example board to a full approved membership engine with independently curated daily sets and meaningful progress.

## Full engine/session

Load seven unique letters, a required letter and pinned dictionaries. Input supports typing and repeated taps; supplied letters are unlimited, unlike Letter Wheel. Validate minimum length, allowed set, required character and membership. Rejected guesses remain editable. New accepted words update the found set, calculate points, announce the result and persist. Duplicates change nothing. Shuffle outer letters without changing rules. Detect all-letter words by unique-character coverage, not length: TRANSPARENT can qualify even though it exceeds seven characters.

Completion first celebrates the curated everyday target, then allows continued dictionary exploration. Results display finds, all-letter discoveries, score and assistance. Preserve the best daily record; archive practice starts a separate run. Offer resume, restart practice and another round without abandoning the current run accidentally. This must match Hexabble’s actual rule-driven feedback and reliable action history rather than merely sharing its polished board appearance.

## Levels and editorial pipeline

Each level needs a different curated set, with an unchanged spelling policy. Gentle supplies several approachable constructions and a recognisable all-letter word; Standard balances quick finds with deeper exploration; Expert uses constrained combinations and less obvious familiar constructions. Calibrate by common answers, repeated-letter opportunities, initial-find time and hint use. Do not equate “more rare words” with greater quality.

Enumerate candidate boards from familiar words with exactly seven unique letters and consider each possible required letter. Filter through the approved membership dataset, then curate common-target words and hints independently. Reject boards dominated by nearly identical inflections or marginal entries. All-letter target validity must be machine checked, and fairness independently solved. The bundled GB candidate spellings list needs the shared editorial transformations; the demo list is not a production word whitelist.

Score four-letter words one point, longer words their length and every all-letter word seven extra. Compute denominators from pinned data. A revealed word earns no points and remains labelled assisted. “All everyday words” and “all accepted words” must be separate claims. Store definition or derivation explanations for revealed answers, not only a bare answer string.

## Complete UI states and tests

Provide start/tutorial, active input, letter-specific rejection, duplicate, successful word, all-letter discovery, hint ladder, curated completion, continued play, result, restore, offline save and no-round fallback. Help must explicitly say letters may repeat. Display accessible non-colour required-letter and all-letter markers. Ensure the on-screen board remains usable above the mobile keyboard.

Acceptance: TRANSPARENT is legal in parents despite repeated letters; ARTICLES is illegal in article because of S; a word lacking the required letter is rejected despite dictionary membership; repeated submission neither scores nor generates another celebration; shuffle preserves the required letter; recomputed maximumScore matches fixtures; allLetterAnswers equals computed set coverage. A saved assisted run cannot resume as unassisted. Production acceptance tests include common words beyond the restricted demos. A user can complete, inspect the result, continue finding and select an archive round through fully functioning controls.

Preserve [the original game brief](../games/letter-set.md) and [its original fixtures](../content/letter-set.json). Implement alongside the shared architecture, dictionary, design and release documents in `../docs/`. Record any rules change rather than silently merging contradictory versions.
