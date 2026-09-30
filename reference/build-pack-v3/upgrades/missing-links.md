# Missing Links — complete-play upgrade

Additive v 3 requirements. Preserve `games/missing-links.md` and `content/missing-links.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference uses HAND→BAG→PIPE and a hardcoded BAG check. The authored game requires one link completing three explicitly directed closed compounds with their own definitions. All three JSON rounds are gentle; the interface lacks branch templates, candidate-bank policy, semantic alternatives, complete explanations and replay selection.

## Engine and round loop

Load prefix/suffix branch templates, link enumeration, candidate bank and acceptedLinks. Submit normalises the single word and substitutes it into every branch without deleting, rearranging or adding separators. Acceptance requires an authored link supported by every branch definition. Retain draft and attempts after rejection. Success fills all blanks and shows each compound meaning before Next round. Correct completion earns 100, with guess counts and optional bank/hint use recorded separately. Partial compound fit is not partial completion. New rounds use unseen validated IDs.

## Distinct difficulty and content

Gentle presents three concrete compounds and a visible candidate bank. Standard varies before/after placement, hides the bank and uses less obvious links. Expert supplies four precise branches and more plausible competing candidates. Directions remain explicit. A candidate bank opened in Standard is assistance; a visible Gentle bank is normal play.

Validate DAYLIGHT/MOONLIGHT/LIGHTHOUSE, NOTEBOOK/BOOKCASE/BOOKMARK and FOOTBALL/FOOTPRINT/BAREFOOT against reviewed UK compound membership and definitions. Do not use a generic spellchecker to approve all concatenations. Store every defensible accepted link and its per-branch meanings; if alternatives need a richer schema, version it and test the adapter.

## Hints, recovery and results

Reveal the link’s first letter, show one completed branch, then reveal the complete set. Hint stage belongs to the current board. Branch cards read naturally as prefix–blank–suffix for screen readers and display optional visual connectors. Results distinguish a fully solved board from full reveal.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Run all three canonical boards. Reject HOUSELIGHT for the LIGHT+HOUSE branch and a word valid for only two branches. Test unknown link length, repeated submission after success, bank opening, differing prefix/suffix directions, missing definitions, alternate accepted links, resume after a partial guess and content replacement without changing an active answer.
