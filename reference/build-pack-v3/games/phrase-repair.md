# Phrase Repair — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Restore a familiar British phrase by moving adjacent word tiles, then improve the route if you wish. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

A board contains a clue, an enumeration per word and shuffled whole-word tiles with stable IDs. Rearrange them to an approved exact phrase using swaps of adjacent tiles only. Selecting two non-adjacent tiles is not a legal single move. The same action can be performed through Move left and Move right buttons, so drag gestures are unnecessary. The target phrase must fit the clue and enumeration. Accepted alternatives, if any, are stored explicitly as complete word sequences. This is deliberately a deferred feature: do not publish a generic phrase generator without reviewing alternative grammatical endpoints. A correct phrase completes the round regardless of move count.

## Scoring and success

Completion earns 60 points plus 40 multiplied by minimumAdjacentSwaps / actualSwaps, rounded down. Undo also counts as an additional adjacent swap because it changes the board; its label explains that a personal move count continues. Reset starts a new practice attempt with a fresh move count but preserves the completed best result separately. No public competitive leaderboard. After solving, show actual moves and the mathematically minimal moves from this initial permutation.

## Difficulty design

Gentle uses short phrases, an explicit definition and the word enumerations. Standard uses proverbs of five to seven words and gives the definition without an extra first-word hint. Expert may use repeated tokens and fewer obvious anchors, but only with reviewed acceptable orderings. Longer phrases increase motor work, so impose an eight-word cap for launch. Difficulty comes from linguistic recognition rather than forcing many tiny dragging operations.

## Hints, recovery and revealing

Hint one reveals the first target word. Hint two marks one tile already in its correct position without locking it. Hint three reveals the complete target while keeping a practice mode available. A separate Show efficient next move calculates a swap that lowers distance to an accepted target and marks assistance. Do not assume the supplied target is the only grammatical English sequence.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Choose an established short phrase, write a definition precise enough to identify it and record accepted British variants. Preserve exact token forms; SPILT and SPILLED cannot be interchangeable without a matching tile. Calculate minimum adjacent-swap distance with inversion counts; for repeated words, minimise across matching occurrences. Review alternative phrase orders, hyphenation and apostrophes. Reject content with controversial or culturally exclusionary wording.

## Automated validators and release constraints

Validate unique tile IDs, equal target/source token multisets, correct enumeration, approved target alternatives and minimum swap counts. With duplicates, ordinary arbitrary ID matching can overestimate the minimum, so use ordered matching or exhaustive small-case validation. Test the move calculator from any reachable board state. A phrase's presence in a generic corpus does not establish that its clue or grammar is fair. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Verify SPILT/OVER/MILK/CRY repairs to CRY/OVER/SPILT/MILK in four adjacent swaps. Verify LEAP/YOU/BEFORE/LOOK repairs to LOOK/BEFORE/YOU/LEAP in six. Verify the six-token stitch proverb has minimum seven swaps. Reject a non-adjacent exchange represented as one move. Test repeated tokens, keyboard moves, undo counting, reset/new attempt behaviour, accepted alternatives and accessible announcements of new tile positions. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Render tokens as a wrapped ordered strip with each tile showing its current position. Focused tiles expose Move left and Move right controls. On mobile use a vertical list if the phrase cannot fit legibly; adjacency refers to list order, not physical screen proximity. The clue and enumeration stay above the tiles, with Submit and Hint below. Completion displays the repaired phrase as normal readable prose. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/phrase-repair.json`. It contains 3 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
