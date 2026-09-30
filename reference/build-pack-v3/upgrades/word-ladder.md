# Word Ladder — complete-play upgrade

Additive v 3 requirements. Preserve `games/word-ladder.md` and `content/word-ladder.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference hardcodes COLD/WARM, eight accepted words, a route array and an optimal-distance message. It has no backtracking, production word graph, final scoring, active-route hint calculation or persisted attempt. The three JSON rounds include CAT/DOG and HEAD/TAIL, but the interface does not load them. Cosmetic difficulty changes cannot establish playable Standard or Expert.

## Engine and round loop

Implement a pure graph-backed engine using the pinned membership list. A submit checks normalisation, equal length, exactly one changed position and membership before appending. Accept every legal route, including COLD→CORD→WORD→WORM→WARM. Backtrack removes one edge; revising an earlier rung confirms truncation. BFS establishes endpoint optimum at import and shortest remaining routes for hints. Score completion as 60 + floor(40 × optimum/finalRouteMoves), capped at 100; retain attempts separately. Reaching the target closes the attempt, so further submissions cannot append or score again.

## Distinct difficulty and content

Gentle: familiar three/four-letter words and an optional visible bounded bank. Standard: four/five-letter words, more branches and four-to-six-step routes. Expert: longer common-word routes, misleading branches and necessary temporary increases in target distance. Review branching and vocabulary rather than merely extending length.

Import examplePath, roundDictionary and optimalMoves without treating the example as the only solution. Recalculate optimum against the exact production lexicon; never reuse a demo optimum after widening membership. Require a common-word route even when valid specialist guesses exist.

## Hints, recovery and results

Hint stages identify one changeable position, reveal a valid next word from the current node, then insert it with confirmation. Mark WARM as Target beyond an unfinished-path gap. Results show the final route, shortest example, actual moves and assisted status.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Replay all three fixtures. Reject COLD→WARM, same-word submissions and nonexistent words without changing the path. Prove four-move COLD/WARM and five-move HEAD/TAIL within their fixture lists. Test hints from WORD rather than the original route, backtracking after a reveal, double Submit at the endpoint and forged restored edges.
