# Word Fragments — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Combine exact spelling chunks into clued words; one shared tile bank makes allocation matter. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

The board contains three clues, answer lengths and a shared bank of labelled fragment tiles. Put tiles into each answer lane in order. Every tile must be used exactly once across the completed board. Tiles can be removed or moved between lanes until submitted. A lane answer is the concatenation of its tiles, without inserted characters. An accepted answer must satisfy its clue and enumeration. Identical-looking tiles have separate IDs so their use can be counted. Submit the complete board to finish; checking an individual lane is optional and counts as assistance. This is spelling construction, not syllable segmentation, and makes no claim about pronunciation.

## Scoring and success

Earn 100 on a correct complete board. Track board checks, individual-lane checks and hints separately. Incorrect checks do not silently reveal which other lanes are wrong. A completed assisted round remains a success. The tile count and total number of letters are descriptive, not a speed requirement.

## Difficulty design

Gentle uses whole-word chunks and familiar compounds with clear boundaries. Standard uses fragments that could plausibly fit more than one lane and splits inside morphemes. Expert uses more lanes, duplicate fragments and selected shared-looking boundaries. Editors must preserve a clear clue for every target. Difficulty comes from constrained allocation, not arbitrarily chopping a rare word into unrecognisable pieces.

## Hints, recovery and revealing

Hint one identifies the lane to try next. Hint two places a correct first fragment in that lane. Hint three completes one lane and locks only that lane's tiles. An Undo control reverses the last movement; Reset returns all unconfirmed tiles to the bank after confirmation. No hint may consume a tile invisibly.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Author target words and precise definitions, split their spellings into exact chunks, pool the chunks, and search for all full-board allocations against accepted answers. Record every alternative full allocation that the clues support. Give tiles stable IDs rather than using their text as a key. The demo compounds are deliberately gentle; standard production rounds require more overlap and deliberate decoys without unusable tiles.

## Automated validators and release constraints

Validate word enumeration, concatenation, tile ID uniqueness and complete tile coverage with no duplicates. Verify the multiset of answer tile IDs equals the bank. Search possible orders per lane and enforce a valid full assignment. Where more than one accepted allocation exists, any such allocation must win. Do not mark a valid alternative incorrect merely because it differs from the stored example. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Verify BANK+NOTE forms BANKNOTE, RAIN+BOW forms RAINBOW and SUN+FLOW+ER forms SUNFLOWER. Verify BOOK+MARK, BUT+TER+FLY and SEA+SHELL in the second board. Test same-text duplicate IDs, moving tiles by keyboard, touch selection without drag, incorrect enumeration, undo after checking, reset confirmation, all tiles used once and restore of their order. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Clues appear in stacked answer lanes with blank tile slots; a shared tray below holds fragments in shuffled order. Allow tap fragment then tap destination, alongside drag-and-drop. Keyboard users select a tile and choose a lane or position from labelled controls. Show both assembled letters and length under each lane. Mobile has no narrow multi-column tray; wrap tiles with sufficiently large targets. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/word-fragments.json`. It contains 2 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
