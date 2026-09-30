# Letter Circuit: search, planning and true completion upgrade

## Before → after

Every current round contains only four accepted words, exactly its reference chain. Their four-word optimum is valid only against those restrictive demonstration dictionaries. A public game using them would reject most imaginative routes and remove the strategic exploration promised by the brief. Upgrade accepted-word coverage, optimum search, bridge support and whole-session results; keep these fixture routes as legal examples rather than production constraints.

## Full engine/session loop

Load four sides of three unique letters and a pinned approved dictionary. Compose any first word of at least three letters. Validate supplied letters, alternating sides between consecutive letters and membership. Each subsequent word must begin with the previous last letter. Accept, update the coverage bitmask, persist and preload the next initial character. A word introducing no new letter is legal: it may be a strategic bridge. Invalid submissions remain editable. Undo the last committed word recomputes coverage from the remaining chain, because a removed letter may also occur earlier.

Completion occurs only when the chain cumulatively covers all twelve letters. Show the full chain, word count, optional total letters and assistance. Preserve the best completed chain while allowing continued improvement. Restart creates a new candidate chain without deleting that best result. Archive and practice selection remain available. Match Hexabble’s draft/analysis/commit/history quality, but keep this a compact solo planning game.

## Difficulty and solution search

For every approved word, precompute first letter, last letter and twelve-bit coverage after side validation. Breadth-first search over endpoint and coverage establishes the minimum word count. Keep predecessor links for an explainable reference. Do not prune paths using unproved heuristics and then declare the result optimal. If the search is incomplete, display “best known” instead. A dictionary update requires recomputation and content review.

Gentle offers several familiar bridge routes and an accessible multiword completion. Standard needs deliberate planning around remaining letters and usable endpoints. Expert targets fewer-word common-vocabulary solutions with constrained branching. Optimum count, valid-word branching, trap endpoints, familiar-route availability and pilot behaviour together inform calibration. Do not equate a longer optimum with greater difficulty automatically.

Use the approved membership dictionary to accept routes, with a curated familiar-word subset to prove that an approachable solution exists. Reference chains must be wholly common enough for the advertised level. The demo’s four-word lexicon must remain confined to its test mode. In production, accept any legal route, including routes better than the authored solution.

## UI states and tests

Show board/rules, active input, required start, same-side error, nonmember word, successful bridge, coverage update, undo, restart with retained best, hint, completion, improved result, archive, offline save and restore. Display remaining letters textually and mark side identities without relying on colour. A hint must be reachable from the current endpoint or explain that it proposes a restart.

Acceptance: all three fixture chains pass side checks, chaining and coverage. BFS proves their restricted-dictionary optimum. Add a test dictionary with a shorter route and verify the displayed optimum changes. Reject same-side adjacent letters; allow repeated letters separated by legal transitions; accept a zero-new-coverage bridge; undo removes only coverage unique to that removed word. Production accepts valid words outside the fixture lists. Keyboard/tap entry, results and resume must all use the same engine.

Preserve [the original game brief](../games/letter-circuit.md) and [its original fixtures](../content/letter-circuit.json). Implement alongside the shared architecture, dictionary, design and release documents in `../docs/`. Record any rules change rather than silently merging contradictory versions.
