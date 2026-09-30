# Phrase Repair — complete-play upgrade

Additive v 3 requirements. Preserve `games/phrase-repair.md` and `content/phrase-repair.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference implements four word tiles and adjacent swaps with a move count, but checks just CRY OVER SPILT MILK. It has no authored-board selection, undo policy, alternative endpoints, repeated-token solver, calculated hints, durable attempts or complete replay/result loop. The other two fixtures are not loaded.

## Engine and round loop

Load stable tile IDs, clue, word enumerations and approved target sequences. Move left/right executes one adjacent swap; a non-adjacent drag becomes an explicitly previewed sequence of adjacent swaps, never one move. Undo counts another swap under the original scoring policy. Compute minimum distance to accepted endpoints using stable occurrence matching, including duplicate token text. Complete when any approved endpoint matches. Score 60+floor(40×minimum/actualMoves), capped at 100; already-solved boards with minimum 0 complete at 100 without division by zero. Reset creates a new practice attempt while retaining the previous best result.

## Distinct difficulty and content

Gentle uses short familiar phrases and explicit definitions. Standard has five-to-seven-word proverbs and less direct semantic clues. Expert includes reviewed repeated tokens and competing plausible anchors; cap launch phrases at eight words. Higher inversion count alone creates motor work, not intellectual difficulty.

Validate token multiset identity, target enumerations and optimal adjacent-swap counts. Review every grammatical alternative against the clue and store defensible complete endpoints. Do not generate live proverbs or discard inconvenient variants. Keep British token forms such as SPILT; SPILLED requires a different tile and board version. The original deferred-release warning remains until ambiguous endpoints receive independent semantic review.

## Hints, recovery and results

Reveal first word, identify an already-correct position without locking it, then optionally show a distance-reducing next swap. Full reveal shows the phrase while retaining clearly marked practice. Results compare actual and minimum moves and explain the phrase before replay.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Assert fixture minimums 4,6 and 7. Reject non-adjacent one-move claims and incorrect token duplication. Test repeated identical tokens with different IDs, swaps returning to the starting order, undo counting, zero-distance imports, alternative endpoints, restore with correct raw swap history and best-result preservation across a reset practice attempt.
