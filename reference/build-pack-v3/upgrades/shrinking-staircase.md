# Shrinking Staircase — complete-play upgrade

Additive v 3 requirements. Preserve `games/shrinking-staircase.md` and `content/shrinking-staircase.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference accepts only the hardcoded STEAM/MEAT/MAT/AT sequence by equality, without an independent letter-count engine. It does not load STONE/TONE/ONE/ON, support accepted branches, revise earlier rungs safely or give stage-aware hints. Ending produces a text message rather than a complete scored and replayable session.

## Engine and round loop

Load acceptedChains and rung clues. For each submit require one fewer character, no added letter occurrences, exactly one discarded occurrence, approved membership and clue-specific accepted continuation. Derive candidate next answers only from chains matching the full accepted prefix. Every accepted branch must have a completion. Revision of an earlier rung confirms and clears dependent later progress. Score equal completed rung fractions to 100, rounding once; attempts and assistance remain separate. Results show each removed occurrence and survivor rearrangement. Full reveal is not scored as an unaided chain.

## Distinct difficulty and content

Gentle shows remaining letters and direct clues. Standard uses tighter definitions, longer chains and less obvious rearrangements, with the visual aid available as a hint. Expert includes repeated letters and multiple valid predecessors with verified continuations. Keep familiar two-letter endpoints; do not manufacture challenge with obsolete short words.

Validate every accepted chain by Counter subtraction and clue review, including all branches. Store dictionary/content versions and per-rung accepted alternatives and hints. A broader dictionary must not automatically admit words that fail the authored clue. The original two chains are demonstration data requiring editorial promotion before public scheduling.

## Hints, recovery and results

Identify the removed occurrence, reveal the next first letter, then fill that rung with an explanation. Stage-specific guidance must follow the player’s chosen branch. Backtracking preserves earlier assistance records and explicitly invalidates dependent answers; it must not silently change an accepted word.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Complete both STONE→TONE→ONE→ON and STEAM→MEAT→MAT→AT. Reject STONE→TUNE, which adds U, even though both are English words of the expected lengths. Test duplicate-letter removal, an accepted branch with no continuation at import, revise-rung dependent clearing, hint insertion, terminal repeated Submit and refresh halfway down a chain.
