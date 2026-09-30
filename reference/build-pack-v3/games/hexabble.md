# Hexabble: strategic family word game

## Role and recommendation

Add Hexabble as the nineteenth game: a substantial two-to-four-player family-table experience alongside the solo daily favourites. For Mum, start with Friendly word checking and local pass-the-device play. Its appeal is making useful words while weighing position, premiums and special tiles. Keep the four solo launch favourites prominent because Hexabble currently needs another human player; there is no supplied computer opponent or remote multiplayer.

The supplied six-file implementation has a real engine and complete match flow. Use it as a functional benchmark for the collection, while retaining each game's own design. The source attachment remains untouched at `../vendor/hexabble-original/`. An adapted, playable standalone route is `../ui/hexabble.html`, backed by `../ui/hexabble/`. These are still reference application files, not a deployed service.

## Exact supplied game rules

The board is a radius-eight axial hexagon: 217 cells and a 17-cell diameter. Coordinates `(q,r)` are valid where |q|≤8, |r|≤8 and |q+r|≤8. Words read along `(0,1)`, `(1,0)` or `(1,-1)`, labelled down, down-right and up-right. A turn normally places one continuous straight word with no gaps; existing tiles may fill spaces in that word. Opening covers the centre and contains at least two letters. Later turns connect to existing letter tiles except the Key island exception below.

The bag has 108 uniquely identified tiles: 98 letter tiles with conventional letter distribution/values, four Wilds, two Keys and four Pivots. Racks hold seven tiles. Copy the exact `LETTERS` and `SPECIAL_COUNTS` constants from the preserved engine, rather than reconstructing a different distribution from memory.

Every new straight line of two or more letters must be analysed. A valid two-letter touch contributes points; an invalid two-letter touch is ignored, subject to each new tile having at most one ignored touch. Lines of three or more letters must always be valid. A new tile touching at least three existing tiles must form a valid word with an existing neighbour. A Pivot is a void, not an ordinary neighbouring letter.

Wilds represent one A–Z letter and score zero. A Key also represents one letter and scores zero. While any of the six Key spaces remains free, a Key must occupy a free Key space. There it may initiate a disconnected word island. Once all Key spaces are occupied, it acts as an ordinary Wild. Do not infer that all special tiles allow disconnected placement.

A Pivot lies between letters where the word changes reading direction, scores zero, triggers no premium and becomes an impassable void. Preserve the engine's supported path direction logic. Before publication, test multiple Pivots and ambiguous paths against agreed rule interpretations; the originating rule PDF is not included.

Newly covered DL/TL spaces multiply the corresponding letter; DW/TW multiply the word. Multiple word premiums **add**, rather than multiply: DW+TW is five times, two DWs are four times. Centre and Key spaces are DW. Previously covered premiums do not apply again. Each counted cross/touch word gets its own derivation. Playing all seven rack tiles adds fifty points once to the turn, not once per word.

Exchange consumes a turn and requires at least seven tiles in the bag. Recall returns uncommitted placements without changing score, bag or turn. Pass consumes a turn. Friendly mode blocks invalid words without a turn penalty. Challenge mode commits a failed challenge as a zero-score turn, preserves the rack and changes player. Do not label either mode an officially certified tournament ruleset.

The implemented match ends when a player empties their rack with an empty bag, after `2 × playerCount` consecutive scoreless turns, or by agreed manual ending. The source engine counts exchanges among scoreless turns; the original README mentions only passes/failures. The adapted interface explains the actual behaviour. Resolve any desired rules change explicitly and version it. At end, subtract each player's unplayed rack value; a player who goes out also gains opponents' remaining values. Ties show every winning player.

## Full user journey

Setup selects two to four names, Friendly or Challenge checking and privacy handover. Start creates a shuffled bag, deals racks and shows the current player. Select/drag tiles or use the keyboard, assign special faces, revise draft positions and inspect word/score analysis. Submit commits exactly once. Show history, refill the rack, change player and conceal the next rack behind handover. Results explain pre-adjustment score, unplayed-tile deduction and final total. Offer replay with the same players or player setup.

The adapted reference adds device-local save of match state and unsubmitted draft, explicit Resume after refresh, snapshot validation, keyboard rack selection and roving board focus, dialog semantics/focus trapping, reduced motion and a readable scrolling mobile board. Fit is an overview; Readable prioritises letter size. This is local interruption recovery, not cloud backup or account sync. Handover prevents casual screen viewing, not access by someone inspecting this device's storage.

## Difficulty and solo extension

Friendly/Challenge are checking modes, not three difficulty levels. For original two-to-four-human play, keep one coherent ruleset. Optional coaching can explain placements and score derivations without revealing opponents' racks. A future solo mode should use independently authored turn puzzles with known legal alternatives and optimal or bounded scores. It must not pretend that a random rack is a calibrated Gentle puzzle. A bot requires a legal move generator, bounded search and separately tested skill bands; no bot is supplied in this pack.

## Dictionary and content

The uploaded `words.js` contains 252,209 entries. Its header claims an ENABLE/SCOWL British/Collins-two-letter merge. Exact source versions, extraction recipe and complete notices are absent, so do not treat that comment as verified production provenance. The list accepts abbreviations such as ABBR and both COLOR/COLOUR; the original interface's categorical exclusion claim was inaccurate and has been corrected in the adapted route.

Keep this lexicon isolated to the reference. Production uses a pinned, reviewed word-game membership list with documented notices and an explicit policy for variants, abbreviations, offensive entries and obscure words. A large accepted-word list and a curated familiar answer pool serve different purposes. Retain the existing pack's candidate dictionary and notice; do not silently substitute the Hexabble list for all daily-game answers.

`../content/hexabble.json` contains three original CAT opening analysis fixtures, one per axis, each scoring ten. These are regression inputs, not a complete match or difficulty/content bank. `../scripts/hexabble-engine.test.cjs` provides eighteen additional boundary/flow checks. See the benchmark review for uncovered special-path and adjacency cases.

## Acceptance and public release

Prove tile conservation/unique IDs through play, recall, exchange, challenge and finish. Reject reused rack IDs, fractional coordinates and multi-character assigned faces without mutation. Recompute score from authoritative state; UI previews cannot commit a different result. Cover all three axes, additive premiums, old-premium reuse, cross words, ignored touches, Key island restrictions, Pivot blockage, seven-tile bonus, empty bag, ties and every end condition.

Browser acceptance includes keyboard-only legal opening, Friendly rejection, Challenge handover, privacy recovery, exact draft refresh, corrupt/incompatible save handling, mobile board and rack reachability, special-tile assignment, completed-game restore and interrupted dialogs. Verify with real phone gestures and assistive technology before release. Confirm source-code, game name/board and dictionary publication provenance. The test results in this pack establish only their stated subset, not full production readiness.
