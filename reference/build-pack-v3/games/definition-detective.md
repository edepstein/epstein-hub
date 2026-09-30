# Definition Detective — implementation and content specification

Status: build-ready design with original demonstration fixtures. These rounds have mechanical checks where applicable, but no claim of independent editorial approval or real user testing. Public release remains conditional on the shared release gates. Read `docs/01-product-and-site.md` through `docs/06-build-batches.md` before implementing; this game specification overrides a generic rule only where it explicitly describes a different mechanic.

## Player promise and audience fit

Choose the precise meaning and identify the textual evidence. This rewards close reading rather than speed. The intended player already enjoys adult word puzzles. Use a restrained, readable interface and intellectually fair clues. Do not describe gentle mode as being for older people or imply that large text means easy content. The round should work with touch, mouse and keyboard. The public version uses original identity, independently authored content and the project's licensed UK lexicon.

## Complete rules and acceptance

A round contains three short vocabulary cases. The final agreed design uses four definition choices plus three evidence choices, refining the earlier three-option sketch. Each case displays a sentence, a highlighted target word, four definitions and three explicitly selectable evidence phrases. First choose the definition that best fits the word in that sentence. Then select the evidence phrase that most directly supports that reading. Submit both selections together. A wrong definition receives a neutral retry message; a correct definition with weak evidence can be revised without losing its correctness. Approved IDs, rather than fuzzy synonym matching, determine acceptance. Cases may be solved in any order. Complete all definitions to finish; optional evidence completion improves the score.

## Scoring and success

Per case, the correct definition earns 80 and the correct evidence earns 20; round score is the average of the three case scores, rounded down. A revealed answer is Assisted and receives zero unaided points for that case, while still counting as completed. Distinguish this practice score from intelligence or reading ability. No time limit. Completing definitions without evidence is a valid 80-point success.

## Difficulty design

Gentle uses familiar near-confusable words with explicit context. Standard uses register, intensity and distinctions between adjacent meanings. Expert uses subtle but decisive context and plausible distractors. Do not make a distractor partially correct without noting why it is less precise. The sentence must resolve the intended meaning, including polysemous words. Keep passages short so difficulty stays linguistic rather than visual.

## Hints, recovery and revealing

Hint one points to the part of the sentence that matters. Hint two explains why one distractor fails. Hint three reveals the definition and evidence with a short explanation. Highlighting a phrase never changes the player's answer selection. An optional Learn more panel contains a plain-language definition and a new example sentence after solving.

## Game state and persistence

Use explicit states `not_started`, `in_progress`, `completed`, `revealed` and `unavailable`. The unavailable state covers missing or withdrawn content and offers another validated round. Start only after the player selects Play. Persist the stable round ID, rules version, dictionary version, content version, difficulty, draft inputs or tile order, accepted progress, attempts, hint history and assistance status. A successful submission transitions once to completed; repeated clicks must not add points twice. Revealing the complete remaining answer records revealed, distinguishes it from an unaided completion and offers a new round. Save on meaningful actions and restore after refresh. If content versions conflict, explain that the saved round changed and offer a safe restart without silently retaining an invalid score. State contains public puzzle progress only; never put private family facts into a public fixture.

## Dictionary and answer policy

Free-text normalisation uses Unicode normalisation, trimmed whitespace and uppercase Latin spelling, with game-specific spacing retained as described above. The demo fixtures are deliberately bounded answer sets, not a complete production dictionary. Do not broaden acceptance by calling a live language model. The approved lexicon version establishes permissible spelling; the authored answer list establishes clue fit. Regional alternatives belong in accepted-answer metadata only when they preserve the exact mechanic and clue. Allow Report an answer issue after a rejected submission, store a minimal report and send it to the editorial queue. Fixes require versioned content and regression checks.

## Authoring and editorial workflow

Choose a word with a defensible dictionary sense, create an original sentence that demonstrates it, and write three plausible but clearly incorrect meanings. Mark evidence using stable phrase IDs with exact text, not brittle character offsets. Require a second reader to explain why the right answer beats every distractor. Avoid culturally loaded value judgements such as treating a frugal person as morally superior.

## Automated validators and release constraints

Validate exactly four unique definition choices and at least three evidence choices. Correct IDs must exist. Every evidence phrase must occur exactly in the sentence unless represented as an explicitly labelled paraphrase, which is not used in demos. Human review verifies definition correctness, decisive evidence and distractor fairness. Content cannot be released solely because an LLM assigned a correctChoiceId. Import fails closed on a malformed fixture. A valid JSON file alone is insufficient: semantic constraints run before content becomes eligible for scheduling. Validation results, editor names or roles, review timestamps and content revisions belong in editorial metadata. The bundled status is demo; do not silently promote it to published when the application is deployed.

## Required meaningful tests

Check ambivalent means conflicting feelings, not simple indifference; mitigate means reduce severity, not necessarily eliminate; meticulous means careful attention to detail. Verify all stored evidence phrases occur in their sentences. Test answer then evidence changes, definition-only completion, partial reveal, screen-reader option groups, browser refresh, shuffled answer order and no dependence on the original choice index. Also test a withdrawn round, offline interruption, repeated Submit taps, font scaling to 200%, portrait phone layout and a complete keyboard-only journey. Verify that mistakes remain recoverable and no hint unintentionally exposes another round. These are implementation acceptance requirements, not assertions that a future application already passed them.

## Wireframe and interaction instructions

Display one case per page-like card. Sentence appears first, then a labelled radio group of definitions, then evidence buttons. The target word uses emphasis and a text label, not colour alone. Place Submit after both groups and keep feedback below it. A progress strip switches cases. On narrow screens long definitions wrap; controls never truncate. Avoid a dense table that turns vocabulary into an exam form. Shared chrome consists of Back to games, game title, concise rule summary, difficulty selector, progress and unobtrusive help. Place celebration after a solved result with restrained optional motion; respect reduced-motion preference. Provide New round and View explanation as separate actions. No automatic advance, countdown or losing-streak warning.

## Fixtures and acceptance hand-off

Load `content/definition-detective.json`. It contains 2 original full demo rounds with exact boards, accepted solutions, progressive sample hints and explanations. Derive the visible board from `board` and keep solution checking behind the intended API boundary where score integrity matters. The demo is not a test of secrecy against a technical reader. Build the complete round flow, restore behaviour, hint sequence and explanation before polishing cosmetic animation. A developer completion report must identify implemented rules, fixture validation, meaningful test results and any open editorial issues.
