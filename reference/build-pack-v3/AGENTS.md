> **V3 scope update:** the approved scope now includes nineteen games (Hexabble added) and complete functional parity. Read docs/08 and docs/09 and the individual upgrades/ documents. The v3 batch plan supersedes earlier sequencing that stops at four launch games; established rules, private-data safeguards and per-game release gates remain in force. Preserve vendor/hexabble-original unchanged.

# Agent instructions

Project: an original daily word-game site and a separate private birthday/family space. User is an experienced puzzle enthusiast. Accessibility must improve access without simplifying the intellectual challenge.

Priority order: deterministic and fair rules; trustworthy private access; enjoyable original content; polished responsive UI; maintainable implementation.

Inspect the repository before coding. Do not overwrite unrelated work. Read the game brief and its data fixture before implementing that engine. Raise contradictions against `docs/03-architecture-data-api.md` and record a decision rather than silently changing rules.

Pure engines use explicit rules and dictionary versions. Save raw actions plus derived progress, validate on restore, and avoid storing sensitive family data in public caches. Test plausible mistakes and resume behaviour, not just winning paths.

All shipped puzzle examples are demo content unless specifically promoted through the editorial publishing process. Do not claim that spellcheck membership proves a good answer or that a solver proves semantic uniqueness. Human review remains mandatory for clues and categories.

The full feature pack is a roadmap. Implement approved batches in order. Reuse accessible controls and shared state infrastructure. Distinct games require distinct boards, rules and completion logic.
