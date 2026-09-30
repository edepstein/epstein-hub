# Definition Detective — complete-play upgrade

Additive v 3 requirements. Preserve `games/definition-detective.md` and `content/definition-detective.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference hardcodes three cases with correct definition and evidence at array index 0, then advances immediately only when both are chosen. The brief allows definition-only completion at 80 points and stable IDs. It lacks seeded choice shuffling, case navigation, partial scoring, contextual explanations and persisted selections.

## Engine and round loop

Load three cases with four definitions, at least three evidence phrases and approved choice IDs. Shuffle display order deterministically per session while preserving ID acceptance. Each case independently records definition/evidence selection, correctness, attempts and reveal state. Correct definition earns 80 and correct evidence adds 20; average cases once at results. Definitions alone may complete the round, offering optional evidence practice rather than blocking progress. After Submit show feedback and explanation until Next. Never derive correctness from visible position. Prevent repeated scoring of the same choice.

## Distinct difficulty and content

Gentle has familiar contrasts and explicit context. Standard tests intensity, register and nearby meanings with plausible distractors. Expert uses subtle decisive context and closely related but objectively distinguishable options. Keep short passages; longer text and rare vocabulary alone are not difficulty. Preserve four definition options at every level.

Editorial review must justify the intended definition and why every distractor is less accurate. Evidence phrases carry stable IDs and occur exactly in the sentence; reject offsets broken by edits. The GB spelling list does not supply meaning. Preserve original sentences, authorship and explanation sources without distributing unlicensed dictionary prose.

## Hints, recovery and results

Point to a relevant sentence region, rule out one distractor, then reveal definition and supporting evidence. Revealed cases receive zero unaided points but remain completed. Do not change either selected option merely because a hint highlights text. Results explain each distinction and offer optional evidence completion or a new unseen round.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Validate all six fixture cases and exact evidence text. Shuffle correct choices away from position 0 and still accept their IDs. Complete all definitions with no evidence and assert 80. Reveal one case and verify recomputed unaided score. Test valid definition with weak evidence, case switching, no automatic advance, duplicate Submit and restoring the same seeded ordering.
