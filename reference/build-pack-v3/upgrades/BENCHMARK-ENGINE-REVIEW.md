# Hexabble: evidenced engine benchmark and upgrade implications

Reviewed 30 September 2026 against the six uploaded files extracted to `hexabble-reference/`: README.md, engine.js, app.js, words.js, index.html and styles.css. This is a source review plus reproduced Node engine probes, not a browser user study, complete automated test suite or public-release certification. The uploaded source was not edited.

## What is already substantial

This is an implemented local game rather than a cosmetic board. `engine.js` exports pure geometry, move analysis and game-state actions for browser and Node use. Reproduced counts: **217 legal hex cells, 108 physical tiles, 252,209 unique dictionary entries**. Letter tiles have identities, values and distribution; special tiles comprise four Wilds, two Keys and four Pivots.

`analyzeMove` handles three word directions, contiguous placement, existing-tile intersections, special start locations, pivot paths, two-letter touches, mandatory longer crosswords, premium scoring and all-seven-tile bonuses. It ranks valid candidate pivot interpretations. `playMove`, `pass`, `exchange` and `endGame` implement accepted actions, dictionary rejection, turn advance, drawing, rack adjustments and terminal winner/tie calculation. This is genuine word construction with spatial, rack-management and scoring decisions.

`app.js` supports two to four local humans, tile selection, mouse/pen/touch dragging, draft repositioning, recall, shuffled racks, live move analysis, history, scoreboard, hidden-rack handover and result/rematch controls. Friendly mode checks words before commitment; Official mode checks on commitment and penalises invalid words. The strongest benchmark is **reversible draft → rule-specific analysis → authoritative local acceptance → visible action history → complete outcome**, with explicit reasons when a proposal fails.

## Reproduced integrity findings

The probes required the uploaded engine directly and injected minimal deterministic racks. They expose engine-boundary defects, not evidence that ordinary UI users routinely encounter them. UI restrictions are helpful but cannot replace engine validation, particularly if this engine later supports accounts or network matches.

| Probe | Observed result | Required production change |
|---|---|---|
| Give p1 one A tile, submit the same tileId at (0,0) and (0,1), membership dictionary contains AA. | `playMove` returns `ok`; board contains the same physical tile id twice. | Reject duplicate tile ids before move analysis and enforce conservation of physical tiles after every action. |
| Give p1 a Wild and T; assign the Wild the string CA at (0,0), put T at (0,1), dictionary contains CAT. | `playMove` returns `ok`; two board faces contain CA and T, producing CAT. | Require each assigned Wild/Key face to be exactly one allowed A–Z character; validate type, value and coordinates at the boundary. |
| Create a two-player game and exchange one tile on four consecutive turns. | The fourth exchange ends the match: `scoreless` reaches four and `over` becomes true. | Decide whether exchanges should count. Current implementation includes them, while the README and rules describe only passing/failing. Align rules text, engine and tests. |
| Inspect README commands `node tests/engine.test.js` and `node tests/simulate.js 6`. | The uploaded folder has no tests directory. | Supply reproducible tests and a complete-match simulation before claiming those checks pass. |

The duplicated-tile reproduction uses only one letter tile and an empty bag; both placed cells receive `one-a`. The invalid wildcard reproduction uses a zero-point Wild and a one-point T; the resulting accepted word is CAT. These are direct observed outputs, not speculative vulnerabilities.

## Dictionary and content quality

`words.js` is 2,593,304 bytes and declares ENABLE plus SCOWL British-huge plus Collins two-letter words. Its header asserts public-domain/permissive sources but does not provide an auditable source revision, transformations or complete licence notices in the six uploaded files. The README explicitly says it is not the official Collins list. Public distribution needs preserved notices and source/provenance review; a header assertion is not an adequate project manifest.

Membership probes found both COLOR and COLOUR, alongside ABBR and ABBREV. LONDON, CHRISTMAS and NHS were absent in these probes. The presence of ABBR/ABBREV contradicts the interface’s blanket claim that abbreviations are not allowed, while COLOR/COLOUR shows that the mixed list is not UK-only spelling membership. This does not prove every entry is poor; it demonstrates that filtering and policy are unfinished.

A broad tile-game lexicon can legitimately include specialised vocabulary, but unfamiliar accepted plays should offer definitions and clear policy. That same broad lexicon must not automatically become a daily puzzle answer bank. The v3 pack’s separation between approved playable membership and curated daily answers is stronger and should be retained. The full uploaded dictionary is not copied into other game engines merely to inflate apparent content completeness.

## Fit and remaining production gaps

For an experienced word-game enthusiast, the strategic ceiling is promising: three-axis construction, choosing scoring opportunities, maintaining a usable rack, turning paths and opening new areas offer decisions beyond finding isolated words. It is best positioned as an optional longer family game. The supplied application requires another local human: setup offers two to four players, and no solo opponent is implemented in the six files. Friendly mode lowers the cost of vocabulary exploration, but two validation preferences do not establish Gentle/Standard/Expert opponent difficulty.

There is no persistence path using localStorage/sessionStorage, no remote match service and no reconnect model in the supplied code. A refresh loses the in-memory match. The app does not implement authenticated asynchronous play. Its hidden-rack handover is a local privacy convenience, not authorization.

Keyboard handlers cover submit, recall and overlay actions but do not provide complete board/rack placement navigation. The generated board cells are SVG groups without focusable coordinate controls, and rack interactions rely on pointer events. This is a concrete missing keyboard-placement path. Modal focus trapping, descriptive cell names and screen-reader playable alternatives need verification and implementation. A 217-cell scaled board also needs actual mobile usability testing; source inspection alone cannot establish readable tap targets.

The README says premium layout was copied from a supplied PDF image. Confirm authority for public use of that design, name and assets rather than treating an uploaded reference as a blanket licence. This is an unresolved provenance dependency, not a legal conclusion about abstract game mechanics.

## Apply the benchmark to the other eight familiar games

- **Letter Wheel/Letter Set:** full membership, exact letter rules, persistent discoveries, progressive hints, distinct daily racks and honest everyday-versus-exhaustive completion. Their tiny fixture lists are regression tools only.
- **Word Deduction:** duplicate-aware feedback, six valid attempts, broad guesses, strict answer bank, real hard constraints, failure/assisted continuation and preserved daily result.
- **Word Families:** actual identifier-set transitions, meaningful mistake/continue states, explanations and two independent editors seeking rival partitions. Algorithmic structure cannot prove semantic fairness.
- **Hidden Word Trail:** route geometry, exact coverage, alternate-path feasibility, persistent paths, deliberate theme difficulty and keyboard/tap alternatives.
- **Letter Circuit:** allow creative routes and bridge words, search optimum against the full pinned lexicon, retain best completion while improving, undo coverage correctly.
- **Crossword:** real crossing cells and clue navigation, explicit check/reveal assistance, blocked connected production grids and independently edited quick/cryptic clues. Word squares are engine fixtures, not release puzzles.
- **Shared Word Board:** conservation of unique tile identities, legal faces, complete terminal matches, balanced distribution, authoritative transactions, hidden opponent data and rematch. Preserve the simpler independent rules until an explicit versioned strategic expansion is approved.

Every game needs its own complete session and compelling content. Shared typography and controls can support that experience; they cannot substitute for an engine, meaningful challenge or functioning results/replay. The eight sibling upgrade briefs make these parity requirements testable while preserving the original rules and fixtures.
