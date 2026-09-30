# Word Weave — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Solve a compact network of crossing clued words; every shared letter supports another answer. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

A board consists of explicitly numbered across and down lanes in a blocked letter grid. Each lane has a clue and enumeration. Type letters into cells or enter a complete answer through a selected-lane field. A letter at a crossing belongs to both lanes; conflicting entries cannot coexist. A filled grid is submitted for validation against accepted complete solutions. Completing one lane does not lock crossings unless the player used a reveal. All uncued spaces are blocks, not playable cells. The supplied demos have three lanes; this is a training-sized board, not evidence of expert difficulty. Production standard boards contain six to ten short lanes with a connected crossing graph.

## Scoring and success

Award 100 multiplied by correctly solved unrevealed cells / total active cells, rounded down on completion. Shared cells count once. A revealed letter remains marked Assisted and does not earn an unaided cell point. Incorrect full checks return a neutral message unless the player asks for error highlighting. There is no mandatory timer. Show completed words and crossing support as the primary reward.

## Difficulty design

Gentle has three to five lanes, direct definitions and an optional answer bank with a few clearly labelled candidates. Standard has six to ten lanes and ambiguous clues resolved by crossings. Expert uses tighter clues and more interdependence without relying on uncrossed obscure words. Require all lanes to connect and most letters to cross in larger boards; score crossing density during authoring rather than assuming grid size implies difficulty.

## Hints, recovery and revealing

Hint one highlights a lane whose crossings provide the most information. Hint two reveals its first unsolved letter. Hint three reveals the selected complete lane. Reveal must warn that shared letters will also be filled. An optional Check selected lane highlights wrong cells only after confirmation and records assistance.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Place a set of common answers into a connected grid, assign every maximal across/down run of at least two cells a clue, and reject accidental uncued runs. Write clues that fit the exact accepted solution. Store the coordinate of every lane and compute shared cells from those coordinates. For accepted alternatives store complete grids, not isolated word variants that could conflict at crossings.

## Automated validators and release constraints

Validate dimensions, cell bounds, lane lengths, crossing-letter consistency, connected lane graph and complete coverage of active cells. Enumerate maximal runs and require their correspondence to a clued lane. Reject a single active cell with no lane. Verify every accepted complete grid satisfies every approved clue. Dictionary membership supports fill checks; only editorial review supports clues. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Check CRANE crossing BARK at A and BARK crossing KITE at K. Check SOLE crossing BOAT at O and BOAT crossing TIME at T. Test overwriting a shared letter, moving between across/down at crossings, arrow keys, backspace, whole-answer input, incorrect complete grid, reveal interaction, saved focus and mobile keyboard obstruction. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Show a square grid above the selected clue on mobile and beside the clue list on desktop. Number lane starts with readable small labels, highlight the selected lane and separately mark current cell. Provide explicit Across and Down selectors at crossings. Each cell has an accessible label naming row, column, current letter and clue memberships. The keyboard must not cover Submit; use a scrollable puzzle region. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/word-weave.json`. It contains 2 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
