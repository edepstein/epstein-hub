# Hidden Word Trail: path engine and partition upgrade

## Before → after

Two fixtures are straight-row tutorials. The intermediate serpentine-garden fixture places GRASS, TREE and FLOWERS across row boundaries and partitions all sixteen cells. None demonstrates an approved recurring puzzle bank or calibrated expert discovery. Upgrade to a complete route/partition solver, distinct production boards and a fair theme/editorial pipeline. Preserve these three originals as exact-cover regression cases.

## Engine and session

Load grid, theme, accepted targets, reference coverage and approved off-theme membership. Compose a path by drag or sequential taps; every step moves to one of eight neighbours, with no repeated cell. Display the current spelling. Explicit submit validates geometry first, then distinguishes unfound target, duplicate target, valid off-theme word and invalid word. Accepted target paths persist and mark their cells. Distinct off-theme words of at least four letters earn hint credits according to the published threshold. Fixture lists are empty, so free help must remain available.

A stored reference path is not the only legal route by definition. For another spelling-equivalent route, accept only if it avoids solved cells and leaves a feasible complete partition for the remaining targets. An exact-cover check makes that decision deterministic. At launch, prefer boards verified to avoid difficult alternate-route traps. Preserve rejected path input so the user can amend it; explain a blocking route rather than silently refusing an otherwise valid spelling.

Win when valid targets cover every cell exactly once. Results show theme explanation, target discoveries and help used. Allow inspection of paths, archive selection and separate practice replay. Restore the precise committed paths, not just words, because route choice affects remaining feasibility.

## Difficulty and content

Gentle has an explicit theme and approachable route shapes; Standard has several turns and less obvious starts; Expert combines fair indirect theme interpretation, longer paths and visually plausible alternatives. Larger grids alone do not establish challenge. Calibrate route turns, repeated-letter branching, theme specificity, hint use and experienced-player solve time. A theme-defining longer answer is optional in this original edition and must be labelled consistently rather than imitating another publisher’s branding.

Generator validation enumerates candidate paths by depth-first search, then tests complete partitions by exact cover. Check adjacency, spelling, cell reuse, full coverage, target familiarity and alternate remaining solutions. Editors inspect accidental extra theme words and category boundaries. Ordinary off-theme guesses use the approved membership lexicon, while targets come from the curated theme answer bank. Freeze both versions.

## UI and acceptance

Provide theme/rules, loading, selection, backtrack, clear, illegal step, valid target, duplicate, valid off-theme credit, earned/free hint, infeasible alternative route, solved partition, result, review, replay and offline restoration. Make coordinates, letters and paths screen-reader accessible; do not require dragging. Pin controls and avoid grid movement during selection.

Acceptance: solve serpentine-garden using every reference path and reach sixteen-cell coverage; reject a jumped or repeated cell; prevent overlap with committed targets; accept a legal alternative route that leaves a solution; reject one that strands the remaining puzzle with a useful message. Repeated off-theme guesses cannot farm hints. After restoring one solved route, the remaining feasibility state must match. All visual results derive from actual geometry, matching Hexabble’s rule-driven path analysis rather than a generic word-entry UI.

Preserve [the original game brief](../games/hidden-word-trail.md) and [its original fixtures](../content/hidden-word-trail.json). Implement alongside the shared architecture, dictionary, design and release documents in `../docs/`. Record any rules change rather than silently merging contradictory versions.
