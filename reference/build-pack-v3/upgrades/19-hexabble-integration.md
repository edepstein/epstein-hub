# Hexabble integration and hardening

Read `../games/hexabble.md`, preserved original files, adapted route and `BENCHMARK-ENGINE-REVIEW.md`. The original ZIP is a benchmark input, not a production certification. The originating board/rules PDF and upstream licence notices are not present.

## Implemented in this pack

| Concern | Original attachment | Adapted reference |
|---|---|---|
| Catalogue | Standalone game | Nineteenth entry, home invitation and game shelf |
| Checking | Challenge default | Friendly default; explicit penalty mode |
| Phone board | Collapsed in measured390px layout | 796×896 readable board inside a scrolling viewport; real Fit option |
| Recovery | Refresh clears match | Versioned device-local match/draft save and explicit Resume |
| Keyboard | Global Enter/Escape only | Focusable rack; roving cells; arrows and Enter/Space draft placement |
| Dialogs | No focus trap/semantics | Dialog role, title, Tab containment, Escape and opener recovery |
| Engine boundary | Same rack ID can be used twice; multi-character special face accepted | Commit rejects reused IDs, fractional coordinates and non-single-letter assignments |
| Rule copy | End condition excludes exchanges in prose | UI explains implemented consecutive-scoreless-turn rule |
| Lexicon claims | Says no abbreviations | Describes actual reference dictionary limits |
| Branding | Own full-screen chrome | Word Club navigation retained with distinct navy/amber game identity |

The original six files are byte-preserved in `vendor/hexabble-original`; adapted files are separate. Tests distinguish original observations from current adapted checks.

## Production migration

Create `games/hexabble/engine` as a pure TypeScript module. Extract axial coordinates, tile catalogue, premium layout, scoring breakdown and typed actions without changing semantics. The adapter translates visual coordinates to engine coordinates; CSS/SVG positions never define legal cells. Remove `window.__hx` from the public build and replace it with module-level typed state. The hook remains only in this prototype for repeatable tests.

Maintain a versioned snapshot schema. Store bag order, all racks, board occupants, active player, scoreless count, history, final adjustments and in-progress draft. Rehydrate RNG through an explicit source rather than serialising a function. Reject duplicate/missing tiles, unknown versions, invalid cells and impossible player indices. Production storage failures are visible but must not crash a valid ongoing match. Do not make a destructive new game overwrite recoverable state without a clear user decision.

Wire checking mode independently from assistance. Initial Friendly preview matches submit analysis. Challenge preview may show geometry/scoring but cannot leak dictionary validity that the mode intentionally withholds. Targeted coaching in a future mode must be acknowledged in that match's result, not change competitive rules invisibly.

Keep the scrolling mobile board as the baseline. Add tested pan/zoom controls, a current-cell coordinate readout and a compact persistent rack if actual-phone testing shows repeated page scrolling is frustrating. A focusable cell must expose occupant, premium and draft/committed status. Confirm that special assignments and exchange selection work entirely by keyboard; the current smoke review covered ordinary letter placement only.

## Required tests before publication

The eighteen included engine checks cover basic geometry, tile inventory, centre opening, gaps, occupation, zero-value Wild scoring, Friendly/Challenge mutation, duplicate/malformed commit inputs, bag exchange threshold, scoreless finish and idempotent manual ending. Add dedicated tests for legal/illegal Pivot paths, multiple Pivots, ambiguous main-word choice, additive DW+TW, cross-premium reuse, ignored-touch limits, three-neighbour validity, Key free-space transitions, bingo and going-out transfers. Run property-based tile conservation through seeded full matches. Simulated bots must consume only public state and never read opponents' racks.

Browser tests must complete a full scored match and restore both active and completed matches; test setup changes, corrupt snapshot, unavailable localStorage, new-game confirmation, real touch drag/pan separation and screen-reader semantics. Retain test evidence with source hash and exact commands. Do not infer full accessibility from successful keyboard smoke checks.

## Dictionary/source decision

A pinned word-game list with a reproducible build is mandatory. Upstream licence context is available at [the maintainer's Copyright file](https://github.com/en-wl/wordlist/blob/v2/Copyright) and [maintainer site](https://wordlist.aspell.net/). These links do not identify which exact source edition created the supplied merged list. Rebuild from verified sources, retain all applicable notices, and editorially inspect terms. Also record publication permission for the supplied code/name/board artwork. Continue all independent implementation; keep public enablement false until the concrete provenance/release gates pass.
