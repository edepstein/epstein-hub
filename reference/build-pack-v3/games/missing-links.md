# Missing Links — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Find the shared word that completes three compounds in explicitly shown directions. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

One board shows three incomplete compounds with the same missing whole word. Each branch explicitly places the blank before or after its visible component. Enter a single word that creates all three approved closed compounds. The input length is shown. A compound must use the displayed components in their displayed order, without changing spelling, adding a space or deleting letters. The three branch definitions are displayed and must also fit. The demo includes a candidate bank; production standard mode can hide it. Any approved link in acceptedLinks solves the board. Completion reveals each full compound and its meaning.

## Scoring and success

A correct link earns 100 points. Track guesses, hints and bank use separately; opening the optional bank marks the round Assisted in standard mode, but not in gentle mode where it is already visible. There is no deduction for a reasonable failed guess. Do not count a nearly matching compound as partially correct without showing which objective rule failed.

## Difficulty design

Gentle uses concrete, common compounds and a candidate bank. Standard mixes prefix and suffix positions and hides the bank. Expert uses four branches with less obvious but current dictionary compounds, preserving clear branch definitions. Every branch direction remains explicit at all levels. Ambiguity is reviewed with actual compound vocabulary, not with arbitrary phrase associations.

## Hints, recovery and revealing

Hint one reveals the first letter of the shared link. Hint two reveals a completed branch. Hint three reveals the link and the remaining compounds. If a candidate makes one branch valid but not all, explain that all branches need to work; reveal the failed branch only on request. A branch reveal does not auto-submit a candidate.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Choose a common link word, collect three genuine closed compounds, vary link positions, and write a definition for each compound. Search the candidate vocabulary for alternative links of the required length and store any valid alternatives. Avoid product names, casual internet compounds and closed/open spellings that differ across UK sources. The exact closed form must be present in the approved compound lexicon.

## Automated validators and release constraints

Validate each branch template contains exactly one blank. Substitute each accepted link, compare with acceptedCompound spellings and verify enumeration. Check all candidate words are unique and have the required link length. Reject a branch relying on invented concatenation. Human review must confirm both compound meanings and the player's likely interpretation. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Verify DAY+LIGHT, MOON+LIGHT and LIGHT+HOUSE; NOTE+BOOK, BOOK+CASE and BOOK+MARK; FOOT+BALL, FOOT+PRINT and BARE+FOOT. Reject HOUSELIGHT for the branch LIGHT+HOUSE. Test opening the bank, replacing a guess, equivalent accepted links if configured, restore, reveal and accessible reading order of blank-before versus blank-after templates. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Centre the answer input above three stacked branches. Render templates as text with a labelled blank slot rather than an inaccessible radial graphic. Each branch includes its definition. Desktop can place the three cards around the input, but DOM reading order remains answer then branches. Mobile stacks all cards. After success fill each blank with the solved link and read out the three compound spellings. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/missing-links.json`. It contains 3 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
