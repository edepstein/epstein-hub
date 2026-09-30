# Cryptic Workshop — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Learn satisfying cryptic mechanisms through short, fair, original clues with explanations. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

A round contains three independent clues. Each gives an enumeration and accepts only approved answers. Gentle mode names the mechanism before solving; standard mode asks the player to identify it from an offered list, then solve; expert mode hides the list until requested. Mechanism identification is optional and never blocks word entry. The clue must contain a definition and valid wordplay, except an explicitly labelled demonstration. Submit a word of the enumerated length. Clues can be completed in any order. Reveal explains the exact letters and operation, not merely the definition. Complete all three to finish.

## Scoring and success

Each clue contributes one third of 100, rounded once after summing. Mechanism guesses are practice rather than extra compulsory points. Track number solved without a hint, mechanism practice accuracy and completed rounds separately. Use Assisted status after any reveal. A solver who learns the mechanism has achieved the round's purpose; do not penalise learning hints.

## Difficulty design

Gentle uses a named anagram, hidden word or reversal and a direct definition. Standard removes the mechanism label and improves the surface reading. Expert combines at most two mechanisms with exact indicators and unambiguous enumeration. No obscure abbreviations in the first release. Expert content needs a cryptic editor, not merely a generator able to produce an answer.

## Hints, recovery and revealing

First highlight the definition phrase. Next identify the mechanism and its indicator. Then show the fodder or source substring. Finally reveal the answer and the complete parse. Store these stages separately so a definition hint cannot expose the entire explanation. A visible help card teaches the three starting mechanisms with examples different from today's answers.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Write answer, parse and definition first; construct a readable surface second. Verify anagram multisets, hidden contiguous letters after stripping spaces, and reversal operations mechanically. For homophones, record the intended UK pronunciation and review regional fairness. Maintain a list of allowed indicators and abbreviations. No copied newspaper clues. A second editor must solve and parse independently before a clue can have publishable status.

## Automated validators and release constraints

For anagrams compare exact letter counts. For hidden words prove contiguous substring in normalised fodder and record its offsets. For reversals prove reversed fodder equals answer. Confirm enumeration, accepted variants and parse type. Reject clues with correct definition but invalid wordplay. Automated parse validation cannot confirm a natural surface or fair definition; record those as editorial checks. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Verify LISTEN anagrams to SILENT; TALES anagrams to STALE; DESSERTS reverses to STRESSED; show rental contains WREN after spaces are removed. Test typing the right answer before selecting a mechanism, successive hints, enumeration rejection, partial progress restore, explanation display and exact spelling. Reject a parse whose indicator or fodder was changed without recomputing validation. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

A clue panel shows the full clue at readable size, the enumeration and a compact answer input. Beneath it place optional mechanism buttons. Hint stages open progressively below rather than as transient pop-ups. On completion show a parse card with definition, indicator, fodder and operation in separate labelled rows. Display three clue tabs with solved indicators; the mobile layout never requires horizontal dragging. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/cryptic-workshop.json`. It contains 2 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
