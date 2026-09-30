# Anagram Relay — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Add exactly one letter, then rearrange to make the next clued word. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

A supplied start word begins a three-stage relay. At each stage, acquire exactly one letter and rearrange all existing letters plus that new occurrence into the clued answer. Word length increases by one at every stage. No letter may be discarded, substituted or left unused. Enter the answer directly or use the tile interface. Compare multisets: the answer must contain the complete previous multiset plus exactly one extra occurrence. A pure anagram is not a legal move because the word must grow. The acquired letter may match a letter already present. Each answer must also fit an approved clue. Only the current stage accepts input. Complete all three transformations to finish. This implements the agreed add-one relay and supersedes the discarded exchange-one proposal.

## Scoring and success

Each stage contributes one third of 100, rounded after summing. Track guesses and hint use separately. Invalid letter exchanges do not consume a finite resource or damage the board. Completing with hints is labelled Assisted. There is no bonus for rearranging quickly, and the completion explanation is part of the reward.

## Difficulty design

Gentle displays a suggested added letter and uses familiar targets, including a straightforward plural where useful for learning. Standard hides the added letter and uses nontrivial rearrangements rather than repeated pluralisation. Expert starts from longer words, includes repeated letters and uses precise but less obvious clues. Difficulty reflects candidate anagrams and clue inference. Require a verified common-word continuation from every accepted alternative. Avoid a run of plural-only stages in standard and expert rounds; the bundled PLANET to PLANETS transition is deliberately gentle.

## Hints, recovery and revealing

Hint one reveals the added letter. Hint two reveals the first two target positions. Hint three shows how the previous letters can be reordered around the added occurrence. Full reveal gives the answer and a before/after multiset diagram. If the player already inferred a correct target, a later hint must not erase it. Revising an earlier accepted word clears dependent stages only after confirmation. The completion explanation shows every added letter.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Generate edges between approved words where the target multiset contains the predecessor multiset plus exactly one occurrence. Choose growing chains without repeated answers and write precise definitions. Record added letters computed from the multisets. Review alternative target words of the same multiset against the clue. Accepted branches need a verified continuation. The demos are authored for rule validation; challenging public rounds need broader candidate testing and fewer trivial inflections. Build chains backwards when necessary to secure an interesting final word.

## Automated validators and release constraints

Check target length is previous length plus one, lexicon membership, zero removed occurrences and exactly one added occurrence. Verify every target matches its clue enumeration. Confirm the stored added letter agrees with the computed Counter difference. Pure anagrams and letter substitutions must fail. Validate all accepted branches rather than only an example chain. Import fails closed on malformed fixtures. Semantic validators run before scheduling; dictionary membership and clue fairness remain editorial checks. The bundled status is demo and must not silently become published at deployment.

## Required meaningful tests

Verify STARE→ASTERN adds N, ASTERN→PARENTS adds P and PARENTS→PARTNERS adds R. Verify PLATE→PLANET adds N, PLANET→PLANETS adds S and PLANETS→PLANTERS adds R. Reject STARE→ALERT because it substitutes a letter rather than adding one. Reject PLANET→PLATE because it removes a letter. Test repeated added letters, direct entry versus tile entry, backtracking confirmation, stage restore, complete explanation, withdrawn content, repeated Submit taps, offline interruption, font scaling and keyboard-only completion. These are acceptance requirements, not assertions about a future application.

## Wireframe and interaction instructions

The current word occupies a source tile row. An acquisition slot below lets the player choose one new letter; no discard control exists. A target row permits rearranging all resulting letters. Provide a direct text-input equivalent so dragging is optional. Clue and next enumeration remain above both rows and make the increasing length explicit. Display solved stages vertically. Mobile uses a native text keyboard for direct entry and a labelled alphabet picker only when tile mode is chosen. Shared chrome includes Back to games, title, rule summary, difficulty, progress and help. Completion is calm, offers New round and View explanation, and respects reduced motion. No automatic advance or countdown.

## Fixtures and acceptance hand-off

Load `content/anagram-relay.json`. It contains 2 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
