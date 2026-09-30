# Anagram Relay — complete-play upgrade

Additive v 3 requirements. Preserve `games/anagram-relay.md` and `content/anagram-relay.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference hardcodes STARE/ASTERN/PARENTS/PARTNERS and checks equality rather than implementing growing letter multisets. The PLATE/PLANET/PLANETS/PLANTERS fixture is not loaded. The legacy tagline suggests carrying a letter onward, while the actual rule is add exactly one and retain all earlier letters. There is no acquisition control, branch validation, saved session or results screen.

## Engine and round loop

Use the agreed add-one rule. Submit requires nextLength=previousLength+1, Counter(previous) fully contained in Counter(next), exactly one extra occurrence and clue-specific accepted membership. The new letter may repeat one already present. Support direct input or acquisition-plus-rearrangement tiles without any discard control. Accepted branches derive from complete chains matching the current prefix and retain a verified future. Commit one stage, show its added letter, then continue through Next. Each completed stage earns an equal fraction of 100. Freeze scoring at completion and distinguish reveal assistance.

## Distinct difficulty and content

Gentle suggests the added letter and allows an introductory plural stage. Standard requires inferring that letter and uses nontrivial rearrangements at most stages. Expert includes repeated letters, longer words and constrained alternatives. Avoid runs of plural-only stages. Tight clues and branching matter more than increasing word length.

Load acceptedChains, addedLetters and stage enumerations. Recompute each added letter mechanically; reject handwritten metadata that disagrees. Spellings and target familiarity require approved UK membership; independent editors check clue fit. Publish stage-specific hints and explanations rather than leaking the full relay as the first generic hint.

## Hints, recovery and results

Reveal the acquired letter, then two target positions, then demonstrate reordering before a full stage reveal. A player may revise a previous stage with dependent clearing confirmed. Results show the complete chain and all added letters, then offer new relay, same-round practice or resume an interrupted separate session.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Verify STARE+N→ASTERN+P→PARENTS+R→PARTNERS and PLATE+N→PLANET+S→PLANETS+R→PLANTERS. Reject STARE→ALERT because it substitutes instead of adding; reject pure anagrams and any unused old letter. Explicitly test adding a second R to PARENTS, both input modes, branch-aware hints, restored prefixes and duplicate terminal submissions.
