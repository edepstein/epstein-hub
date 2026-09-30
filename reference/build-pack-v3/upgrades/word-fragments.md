# Word Fragments — complete-play upgrade

Additive v 3 requirements. Preserve `games/word-fragments.md` and `content/word-fragments.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference shows EDU/CAT/ION and appends clicked text into one input, allowing unlimited reuse. The actual briefs and fixtures require three clued lanes sharing seven uniquely identified tiles, complete allocation and one-use coverage. No global resource constraints, reorder/move controls, alternative allocation validation or board-completion loop exists.

## Engine and round loop

Represent every fragment by its immutable tile ID and every lane by an ordered ID list. A tile occupies exactly one tray or lane position. Support tap-select-then-place, keyboard placement and optional dragging. Moving or reordering updates the same state transactionally; Undo restores the last allocation. Submit derives concatenated strings and validates clue answers, lengths and exact whole-bank coverage. Any approved full allocation wins, not just the stored example. Complete boards earn 100; checks and hints are separate assistance statistics. Never accept a typed answer that bypasses tile allocation.

## Distinct difficulty and content

Gentle uses familiar compounds with recognisable whole-word pieces. Standard introduces inside-word fragments and competing lane placements. Expert adds duplicate-text tiles and more shared-looking allocations while retaining familiar targets. Validate difficulty through constraint ambiguity, not a larger pile of arbitrarily cut rare words.

Load lanes, tiles, allocations and acceptedAnswers from JSON. Equal text does not mean equal identity. A solver verifies complete legal allocations; editors verify definitions and defensible alternatives. Expand lane-specific hints because current fixture hints cover only selected targets. Render tile text as data, not HTML.

## Hints, recovery and results

Suggest a lane, place its first correct tile, then complete the lane with confirmation and visibly reserve its tiles. Checking one lane is explicit assistance. Incorrect full checks do not automatically pinpoint all errors. Results display the assembled words and how every fragment was used.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Complete BANKNOTE/RAINBOW/SUNFLOWER and BOOKMARK/BUTTERFLY/SEASHELL. Reject reusing t 1, a correct target assembled with duplicated IDs, unused fragments and invented inserted letters. Test two separate tiles with identical text, exchanging occupied lane positions, undo after checking, revealed-lane reservations and restoring partially arranged banks without duplicating tiles.
