# Clue Pairs — complete-play upgrade

Additive v 3 requirements. Preserve `games/clue-pairs.md` and `content/clue-pairs.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference cycles through CRANE, BARK and BAT using a fixed index, immediately replacing the previous card. Canonical rounds contain five independently solvable cards each. The global hint continues to reveal CRANE after that card. There are no card-specific attempts, accepted variants, revisit controls, completion result or saved state.

## Engine and round loop

Load all five cards and acceptedAnswers keyed by stable card ID. Each card tracks draft, accepted answer, attempts and hints; switching cards retains them. Submit validates single-token spelling, length and the approved answer set, not arbitrary dictionary membership. Solve cards in any order. Keep the explanation visible until the player selects Next. Completion requires every card solved or explicitly revealed; mixed rounds display Assisted. Each solved card contributes 100/cardCount, rounding once at the end. Full-round reveal is a distinct result, never an unaided win.

## Distinct difficulty and content

Gentle pairs two concrete common senses. Standard combines concrete and established abstract senses with tighter wording. Expert uses less obvious established senses and carefully controlled misdirection. Keep explicit lengths at every level. Additional cards can extend enjoyment but do not by themselves create higher difficulty.

Each meaning requires UK reference support and an independent blind solve. Search alternative answers of the same length; accepted variants must satisfy both clues. Do not accept DRAFT for British air-current/team-selection clues: DRAUGHT differs. Add per-card explanation and hint objects; retain current round hints as demo metadata.

## Hints, recovery and results

Reveal a selected letter, give a usage example for one meaning, then reveal that card with both senses explained. Confirm before revealing every remaining card. Results present solved cards, alternative senses, attempts and assisted cards. Reports attach a card ID and content version.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Complete pairs-001 in reverse card order and pairs-002 in mixed order. Check CRANE/BARK/SOLE/MATCH/BEAM and BANK/SPRING/SEAL/BAT/JAM. Reject a dictionary-valid word fitting only one meaning. Reject punctuation and incorrect lengths recoverably. Switch cards after typing, resume at the same card, request a BAT hint and ensure CRANE is not exposed again.
