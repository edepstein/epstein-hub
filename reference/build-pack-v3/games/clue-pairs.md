# Clue Pairs — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Find a single spelling that answers two different meanings. Short rounds reward semantic flexibility. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

Each card contains two independent definitions and a fixed answer length. Enter one word that fits both definitions. Answers are normalised to uppercase; surrounding whitespace is removed. Punctuation and spaces are not silently deleted: these rounds contain single alphabetic words. A card is solved only when its answer matches an editorially approved acceptedAnswers entry. A dictionary word is not automatically an answer. Cards can be solved in any order and previously entered guesses remain visible locally. Completing every card completes the round. A disputed valid alternative can be reported without publishing the player's identity. The initial release uses five cards per round; future lengths are an editorial setting.

## Scoring and success

Each solved card earns 20 points in a five-card round. An incorrect guess does not remove earned points. Track guesses and hint use as separate personal statistics. Completion and Assisted are the meaningful outcomes; do not rank players by obscure spelling knowledge. If a future round has a different card count, each card contributes 100/cardCount with integer total rounded only once at the end.

## Difficulty design

Gentle uses familiar concrete meanings such as an animal and a common object. Standard includes a concrete and abstract meaning, less obvious senses and a starting-letter hint available on request. Expert includes precise but established senses with restrained misleading phrasing. Difficulty must come from switching interpretations rather than vague definitions. Each accepted answer needs independent support for both senses in a UK reference dictionary.

## Hints, recovery and revealing

Reveal one letter position, then a short usage example for one sense, then the complete answer with the two meanings explained. Examples must not accidentally spell the answer before the intended reveal. Hints belong to individual cards and do not spoil unsolved cards. After an incorrect guess, explain only an objective problem such as length; do not reveal which sense failed unless the player requests help.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Author a candidate answer, write two clear definitions, search for alternative words of the same length fitting both, and record accepted variants. Avoid senses dependent on a named brand or current celebrity. British spelling is primary: DRAFT cannot answer a British clue for an air current, which is DRAUGHT. Enumeration cannot repair an invalid sense. Have another editor solve the card blind before publication.

## Automated validators and release constraints

Validate answer length, alphabetic characters, unique card IDs and at least one accepted answer. All variants must satisfy both definitions and the same length. Dictionary membership checks spelling; it cannot prove the clue relationship. Reject duplicate answers in a round unless the repetition is intentional and labelled. Check that early hint text contains no full answer token. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Accept CRANE for bird/lifting machine and BARK for dog sound/tree covering. Reject DRAFT for unwanted air current/team selection in a UK edition. Accept BANK, SPRING and SEAL in their authored senses. Test lowercase input, leading spaces, incorrect length, switching cards, repeated submissions, answer reveal, report action, screen-reader announcements and persistence of individual card states. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Use one centred card at a time on mobile, with two separate definition panels labelled Meaning 1 and Meaning 2. Place enumeration beside the input. A row of numbered progress buttons makes all five cards reachable. Desktop may show the full card list on the left and selected card on the right. Do not use colour alone to mark solved cards; include a tick and the word Solved. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/clue-pairs.json`. It contains 2 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
