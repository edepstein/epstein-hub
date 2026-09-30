# Cryptic Workshop — complete-play upgrade

Additive v 3 requirements. Preserve `games/cryptic-workshop.md` and `content/cryptic-workshop.json`; use their rules and scoring. This file closes the gap between the interface reference and a complete playable game.

## Exact current gap

The reference offers a single CAT hidden-word clue and one explanation button. Canonical JSON rounds contain three independent clues with anagrams, reversals, hidden words and a reviewed-pronunciation requirement for homophones. There is no three-clue navigation, staged parse assistance, mechanism practice, completion summary or resume.

## Engine and round loop

Load clues, enumerations, accepted answers and complete parses by ID. Permit solving in any order and answering before selecting a mechanism. Mechanism selection is optional practice, not a gate. Record typed guesses independently from that practice. Successful submit retains the clue and reveals its exact parse; advance only through Next. Sum solved clue fractions to 100, rounding once. Any revealed clue marks assistance without punishing learning. Full-round reveal uses a separate revealed result. Parse rendering must show definition, indicator, fodder and transformation, not merely say the answer fits.

## Distinct difficulty and content

Gentle names one mechanism and provides direct definitions. Standard hides the label and uses smoother misleading surfaces. Expert combines at most two precisely indicated mechanisms. Produce genuinely separate reviewed clue sets; removing the mechanism label from the same already-seen clue is a hint setting, not a new difficulty edition.

Original clues require independent solving and a cryptic editor’s semantic review. Validate exact anagram multisets, reversal strings and hidden offsets. Homophones need documented UK pronunciation review; a code check cannot approve them. Import canonical parses, expand hints per clue and reject malformed fodder. Keep definitions legally sourced or originally written.

## Hints, recovery and results

Highlight definition first, identify mechanism second, show fodder third, then reveal. Preserve each clue’s current hint stage. After completion offer an explanation notebook and another unseen set. Gentle introductory learning cards use different words from the current edition.

## Full session and release gate

Match Hexabble’s complete interaction loop, not its hexagonal appearance: separate pure rules from UI and give every action deterministic feedback. Setup selects an available reviewed edition and difficulty, then Play starts an attempt. Support loading, setup, playing, recoverable error, hint/reveal confirmation, completed/revealed results and unavailable states. Preserve drafts on invalid actions. Replay same edition creates a labelled practice attempt; New round chooses an unseen validated ID. Resume restores pinned round/rules/dictionary/content versions, raw actions, derived progress, hints and assistance; replay actions through the engine and reject inconsistent saved state. Missing or withdrawn content offers a safe replacement without rewriting earned results.

Difficulty editions need different approved content, not selector-only changes. Before enabling a level, provide three complete unseen rounds and pilot with 5–8 comparable enthusiasts; record completion, hint use, disputes and enjoyment. These are acceptance requirements, not achieved calibration. Daily public release requires the approved inventory and reserve in `docs/04-dictionaries-and-content.md`; demo fixtures remain demos. Test each complete loop by touch and keyboard, refresh mid-round, repeat terminal actions and start an unseen replay. Keep public progress separate from family data.

## Testable acceptance

Solve SILENT/WREN/STRESSED and STALE/STOP/ROSE across the two fixtures. Verify SHOWRENTAL substring offset 3 and DESSERTS reversal. Reject a clue import if wordplay letters do not match even when its definition is correct. Test early correct answers, mechanism mistakes, switching clues after hint 2, completed refresh and escaped rendering of clue text.
