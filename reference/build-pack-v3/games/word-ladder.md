# Word Ladder — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Change one letter at a time to connect two words. The satisfaction comes from finding a route, then improving it. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

Start and target have the same length. A move replaces exactly one character in the current word; insertion, deletion and rearranging are prohibited. Every intermediate word must occur in the round dictionary. Submit a word to append it to the route. Invalid attempts leave the route unchanged and explain the broken rule. Backtracking removes the most recent accepted move; it never clears the complete round automatically. Reach the target to win. The shortest possible distance is calculated against the exact published dictionary version. Do not assert that a route is globally shortest against all English words. Demo rounds explicitly use a limited round dictionary, displayed through an optional word-bank control. Production rounds use the approved broader lexicon and must be recomputed against it before publication. Any legal route reaching the target is accepted; the supplied route is an example, not the only answer.

## Scoring and success

Completion earns 60 points. Add 40 points multiplied by optimalMoves / acceptedMoves, rounded down. acceptedMoves means the number of edges in the final route, not all experiments. Score is capped at 100. A hint is recorded independently; display Assisted rather than deducting arbitrary points. There is no timer or global leaderboard in the first release. Show both actual and optimal moves after completion. A longer valid route remains a successful solve.

## Difficulty design

Gentle: 3–4 letters, familiar words, small optional visible bank and few distracting branches. Standard: 4–5 letters, broader vocabulary and 4–6 optimal moves. Expert: longer routes, temporary moves away from the target and more branches, while retaining a verified common-word solution. Distance alone is insufficient: editors inspect branching, word familiarity and dead ends. Never make the only route depend on an archaic word.

## Hints, recovery and revealing

Hint one marks a position that can change on a shortest remaining route. Hint two reveals the next word, chosen from the current node by BFS rather than the originally stored example route. Hint three inserts that word after confirmation. When no route exists from the current word, offer backtracking instead of claiming the player has failed.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Build an undirected graph grouping words by single-position wildcard patterns. Select endpoint pairs only after BFS establishes reachability. Keep at least one all-common-word path. Freeze lexicon version, calculate minimum distance and store an example route. Review endpoints for spelling variants and unintended offensiveness. A dictionary change invalidates published optimal-distance claims until recalculated.

## Automated validators and release constraints

Check equal word lengths, distinct endpoints, membership of every route word, exact Hamming distance one on each edge, and BFS minimum distance. Validate every offered bank word. Reject disconnected endpoints. Recalculate hints after backtracking and from alternative legal routes. Avoid exposing a production solution through page hydration before reveal. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Assert COLD→CORD→CARD→WARD→WARM is legal and four moves; also accept COLD→CORD→WORD→WORM→WARM. Reject COLD→WARM in one move. Assert HEAD→HEAL→TEAL→TELL→TALL→TAIL is five moves in its fixture dictionary. Test invalid words, a zero-change submission, backtracking, keyboard-only completion, restored partial paths and BFS correctness after a lexicon update. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Desktop: title and difficulty above a vertical route, current word in a large editable row, target in a fixed banner below. Show a compact move counter and optional bank drawer. Mobile: the same vertical path; fixed Submit and Back controls below the current input, never beneath the phone keyboard. Clicking a previous route word focuses it but does not delete later steps without an explicit backtrack action. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/word-ladder.json`. It contains 3 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
