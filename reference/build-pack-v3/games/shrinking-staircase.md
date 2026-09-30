# Shrinking Staircase — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Remove exactly one letter and rearrange the rest to climb through a sequence of clued words. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

The first word is supplied. Each next rung has a clue and a length exactly one shorter than the preceding rung. Enter a word using all but exactly one occurrence of the previous word's letters; the remaining letters may be rearranged. Both the multiset relationship and the rung's accepted answer list must pass. A valid dictionary word that fails the clue is not sufficient. Rungs are solved in sequence because each depends on the previous answer. If multiple authored answers are accepted, the complete chain must remain solvable from that choice. The final clued two-letter rung completes the round. Never silently change a player's chosen accepted predecessor.

## Scoring and success

Award equal points per solved rung, totalling 100 when all are solved. Wrong guesses do not reduce earned points. Track hint use and attempts separately. Since order is forced, points should not pretend to measure strategic route efficiency. Completion screen shows the discarded letter on each step and how the survivors rearranged.

## Difficulty design

Gentle gives direct definitions and highlights the letters available. Standard hides that visual aid until requested and uses tighter definitions. Expert adds branching accepted predecessors and longer chains, but only if every accepted choice has a path to completion. Avoid very short obscure words at the bottom: final two-letter words must be familiar and clearly clued. Chain length alone does not establish editorial difficulty.

## Hints, recovery and revealing

Hint one identifies the letter to remove, including its occurrence if the word has duplicates. Hint two reveals the first letter of the next answer. Hint three completes that rung and explains the rearrangement. Backtracking allows revision of a prior answer but clears dependent later rungs only after warning. A read-only solved chain remains available after completion.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Construct chains backwards from familiar two-letter endpoints. Use letter multisets to discover predecessor candidates, then write clues distinguishing the intended words. Validate all accepted branches as a directed graph with at least one full continuation from each allowed choice. Freeze dictionary and clue versions. Human editors should check that a clue is neither a mere word-length guess nor misleading.

## Automated validators and release constraints

For each edge, confirm next length equals previous length minus one and Counter(next) is a submultiset of Counter(previous). Require exactly one discarded letter occurrence. Confirm membership in the rung's answer set and lexicon. Validate every branch, not just an example chain. Reject chains that reuse a removed letter later or substitute a new letter. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Verify STONE→TONE→ONE→ON and STEAM→MEAT→MAT→AT. Reject STONE→TUNE because U was introduced. Test repeated-letter removal, multiple accepted branch paths, backtracking confirmation, dependent clearing, hint insertion, attempts after reveal, completed restore and screen-reader explanations of the letter multiset. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Use a descending staircase visually, but keep a simple vertical list as DOM and mobile order. The current rung shows its clue, enumeration and the available letters as plain text plus tiles. Past rungs show removed-letter badges; future rungs remain visible but disabled with explanation. Offer a large Submit button and an explicit Revise earlier answer action rather than making solved text unexpectedly editable. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/shrinking-staircase.json`. It contains 2 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
