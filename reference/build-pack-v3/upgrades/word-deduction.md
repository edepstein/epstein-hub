# Word Deduction: complete deduction and mode upgrade

## Before → after

The current CRANE, PLANT and SHARE fixtures provide valid answers and a very small guess vocabulary. Their EERIE feedback exercises duplicate accounting. A five-row visual imitation with a hardcoded success is insufficient: build the whole six-attempt state machine, comprehensive guess acceptance, meaningful assistance/constraint modes and complete result/resume behaviour. Preserve fixtures as engine tests; do not mistake their sparse guesses for a production dictionary.

## Engine and loop

Select one curated five-letter answer from the round’s pinned answer bank. Use a separate broader guess membership list. Compose a row, validate length and membership, then calculate feedback in two passes: exact positions first consume occurrences; other positions consume remaining counts left to right. Invalid guesses do not use an attempt. Accepted guesses lock their row and create a durable history. Win immediately on exact match; lose after six valid misses and reveal the answer with a definition. Continue via an explicitly assisted practice extension, a new practice round or the archive.

Keyboard summaries use the strongest known state for a character, while individual rows retain occurrence-level feedback. Derive saved feedback on restore from the pinned answer, not a client score. Results show guesses and assistance without exposing tomorrow’s answer. Daily replay can be transparent practice but must not overwrite a failed official result as an unassisted success.

## Difficulty and dictionary

Keep one daily answer across assistance modes to make comparison understandable. Gentle permits progressive hints and assisted continuation; Standard uses six attempts without hints; Expert enforces information already revealed. Expert cannot simply change the button colour. Hard constraints require green positions, all confirmed minimum character counts, and exclusion of yellow letters from their previously disproven positions. A grey duplicate is not a blanket ban on that letter. Switching to assistance marks the whole run; it cannot later be cleared by changing modes.

Answer difficulty should be reviewed independently by word familiarity, repeated letters and possible-candidate branching after common guesses. A vocabulary-based expert edition is optional, but would require a separately named daily and cohort rather than silently substituting an answer. Approve common UK answers and document inflections and alternative spelling. Use a broad approved guess list and a narrow editorial answer bank; the bundled spelling candidates are not automatically valid daily answers.

## UI completion and parity

Hexabble’s useful benchmark is deterministic previews/validation, explicit invalid reasons and real turn outcomes. For this game, no pre-submission correctness preview is allowed because it would destroy deduction. Show editing, dictionary rejection, submitted-row feedback, next attempt, near-exhaustion, won, lost, assisted continuation, result/share, restored/offline run and next-puzzle selection. Keep the keyboard available and all feedback understandable without colour. Do not animate feedback so slowly that it obstructs play.

## Acceptance cases

EERIE against CRANE produces absent/absent/present/absent/correct. The total green/yellow feedback per letter never exceeds its answer occurrence count. Invalid SLATE membership in a deliberately restricted test consumes zero turns, while the approved production lexicon accepts appropriate common guesses. Test repeated letters in both answer and guess, first-attempt win, sixth-attempt win, six misses, every hard-mode constraint, refresh after three guesses and assisted continuation. Keyboard and touch must produce identical histories. Share output must distinguish helped play and must omit the hidden answer unless the player explicitly chooses a spoiler.

Preserve [the original game brief](../games/word-deduction.md) and [its original fixtures](../content/word-deduction.json). Implement alongside the shared architecture, dictionary, design and release documents in `../docs/`. Record any rules change rather than silently merging contradictory versions.
