# Word Weave — complete-play upgrade

Additive v 3 requirements. Preserve `games/word-weave.md` and `content/word-weave.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference renders and checks one CRANE/BARK/KITE grid by comparing three concatenated lane strings. Canonical fixtures also include SOLE/BOAT/TIME. There is no selected-lane input, full keyboard grid navigation, accepted-grid variants, cell-specific hint accounting, scalable board import or complete results/resume session.

## Engine and round loop

Derive active cells and numbered lanes from board coordinates. Shared crossings use a single letter cell; a new entry replaces that cell consistently across both lanes. Provide cell typing, whole-lane entry, across/down selection and arrow/backspace navigation. Submit validates an entire accepted grid, not isolated alternative words that conflict. Award floor(100 × correctly solved unrevealed activeCells/totalActiveCells) on completion; count shared cells once. Save every filled cell and hint/reveal flags. Completion freezes scoring and offers explanation, replay or a new grid.

## Distinct difficulty and content

Gentle uses three-to-five connected lanes with direct definitions and optional bank. Standard has six-to-ten lanes and clues resolved through crossings. Expert increases interdependence and semantic misdirection while retaining common fill. Track crossing density and uncrossed-letter exposure; bigger grids alone do not establish challenge.

Validate dimensions, lane lengths, shared letters, connectedness and every maximal orthogonal run. No uncued runs or orphan cells. Store approved alternatives as complete grids, retaining consistency. Editors independently solve clues and assess fairness; membership cannot approve definitions. Existing three-lane demos remain training boards, not expert inventory.

## Hints, recovery and results

Recommend an informative lane, reveal one unsolved cell, then reveal a selected lane after warning about shared letters. Check-lane error highlighting is optional assistance. Results show the finished woven network, clue explanations and assisted cells. Full reveal remains distinct from an unaided finish.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Solve both fixtures and verify CRANE/BARK at A, BARK/KITE at K, SOLE/BOAT at O and BOAT/TIME at T. Reject mismatched crossings, uncued accidental runs and disconnected imported boards. Test entering a complete lane over existing letters, cursor changes at crossings, shared-cell score deduplication, keyboard-only completion and restore after reveal.
