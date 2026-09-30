# Claude Code work batches: functional parity for nineteen games

The user's approved objective is the complete collection and birthday site, using Hexabble as a functional benchmark. Work in reviewable batches and continue independent work without routine reconfirmation. Preserve existing rules and v2 visual identity. Resolve conflicts through the individual game brief and record a versioned decision.

## Batch0: inspect, characterise and separate concerns

Inspect repository AGENTS.md, README, package scripts, git status and existing architecture. Read docs01–09, ui/DESIGN-HANDOFF.md, all nineteen game briefs and their upgrade files. Run content validators and the included Hexabble checks. Open the actual Hexabble route, not just screenshots. Record demo versus engine-backed versus publication-ready features. Preserve vendor originals. Non-goals: deployment, changing rules by analogy, importing 252k words as daily answers.

Acceptance: typed catalogue identifies readiness per game; source/fixture paths verified; deterministic engine boundary and snapshot schema agreed; no unrelated changes overwritten. Report missing credentials/assets without pausing unrelated work.

## Batch1: shared session and site foundation

Build typed round loader, engine interface, preferences, autosave with action IDs, draft persistence, archive/practice selection, common hints/result components and error states. Implement the actual shared journeys from upgrades/20-site-and-birthday-parity.md. Migrate tokens/themes into the repository's framework while keeping each board identity. Add genuine content-exhaustion states.

Acceptance: refresh restores a versioned session exactly; corrupt and unavailable storage handled; keyboard dialogs restore focus; layout passes phone, tablet, desktop and zoom; no demo difficulty control survives in a production-enabled route.

## Batch2: complete the four solo favourites

Implement Letter Wheel, Word Deduction, Word Families and Word Ladder using their rules/fixtures/upgrades. Import reviewed membership candidates and establish curated target pools. Each needs distinct difficulty rounds, current-state progressive hints, true results, practice/daily distinction, replay and recovery. Non-goal: pretending the fixture bank is complete public content.

Acceptance: all stated per-game edges pass; one full keyboard and one touch-intended browser round each; success/failure/reveal/resume flows; no hardcoded answer correctness outside fixtures/engine. Prepare content banks before enablement.

## Batch3: integrate/harden Hexabble

Migrate the supplied game rather than rebuilding its rules from a screenshot. Preserve source attribution and agreed semantics. Use the adapted route as guidance for phone, keyboard and resume. Remove test hooks from production, add the uncovered Pivot/Key/premium/adjacency tests and seeded match simulation, and resolve provenance. Non-goals: a pretend bot, account sync without a server, or networking local racks.

Acceptance: full match and completed-game restore; tile conservation, duplicate rejection, special face checks, scoring derivation, turn penalties, exchange/end states; actual device usability and verified public-release sources.

## Batch4: complete vocabulary and connection games

Letter Set, Clue Pairs, Missing Links, Definition Detective, Cryptic Workshop. Use proper membership versus answer pools, all cards/cases/clues in a round, context-supported alternatives, progressive hints and explanation panels. Preserve three-branch link semantics and Detective evidence scoring. Acceptance: upgraded per-game gates, distinct authored difficulty sets, no single-answer prototype left in these production routes.

## Batch5: complete structural word puzzles

Hidden Word Trail, Letter Circuit, Word Weave, Shrinking Staircase, Anagram Relay. Implement path/side/multiset/crossing invariants, current-state coaching, undo where rules allow and achievable results. Verify solvability through canonical/alternative solutions or explicit bounded search. Acceptance: all fixture validators plus deliberately invalid paths/chains, complete-round flow and restored drafts. Do not call a randomly generated geometry a playable round without solving it.

## Batch6: complete construction and editorial play

Word Fragments, Phrase Repair and Daily Crossword. Fragments must use a finite shared inventory; phrase tokens have identities and exact adjacent-swap scoring; crossword rounds have proper crossing/clue metadata and navigation. Acceptance: unambiguous/reviewed alternatives, inventory/score invariants, meaningful result/replay, keyboard grid access and zoom. Quick and Cryptic styles remain independent of difficulty.

## Batch7: Shared Word Board

Complete local match/turn planning first, then remote turn-based play only when the backend is implemented and tested. Use authoritative board versions, idempotent action commits, hidden racks, reconnection and genuine score derivation. Acceptance: full legal match, conflict rejection, no opponent rack leakage and all original rule/end cases. Clearly label local versus online modes; no fake opponent presence.

## Batch8: birthday site with real family content

Implement actual invitation, contributions, private storage, approval, replies/favourites and book/album journeys. Use consenting real assets and messages. Complete all independent UI/server/schema work before requesting genuinely missing personal inputs. Acceptance: viewer/contributor/curator matrix, upload progress/failure/retry, revocation, private media authorisation, no index/share leakage and a real contribution reaches the private birthday book.

## Batch9: publication verification

Run lint, typecheck, pure engines, content validation, browser flows and production build using repository scripts. Perform per-game content and source review, actual phone/keyboard/zoom checks, permission tests, outage/content-exhaustion rehearsal and accessibility follow-up. Keep productionEnabled false for any missing gate; the site can show a truthful preview status. Deployment is a separate final action when requested.

## Commands and completion reports

Use the actual project's pinned package manager and lockfile. Required application scripts: lint, typecheck, test, test:e2e, validate:content and build. Include a scoped test script per game. The reference pack independently runs:

```sh
python scripts/validate-pack.py
python scripts/validate-familiar-fixtures.py
python scripts/validate-alternative-fixtures.py
python scripts/validate-negative-cases.py
node scripts/hexabble-engine.test.cjs
node scripts/verify-ui.cjs
node scripts/verify-hexabble-ui.cjs
```

Browser scripts require the project's pinned Playwright and an installed Chromium; WORDCLUB_CHROMIUM may point to a browser executable. They test prototypes, not the production application. After every batch report changed files, behaviour, exact commands/outcomes, source/content coverage, limitations and next batch. Continue fixing genuine failures before moving on. Do not invent real-user testing or calibration.
