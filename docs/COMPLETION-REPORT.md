# Word Club build: completion report

Build pack v3 implemented in this repository (2026-09-30 to 2026-10-01). Everything is on `main`.
Per-game counts and gates: `docs/STATUS.md` (generated). Decisions: `docs/DECISIONS.md`.
Everything a human must still check: `docs/REVIEW-LOG.md`.

## What is done

| Batch | Scope | State |
|---|---|---|
| 0 | Inspect pack, reproduce ESDB list (sha256 matches), separate demo fixtures from practice content | Done |
| 1 | Next.js foundation, engine contract, versioned autosave with action replay, drafts, corrupt/version/storage-unavailable recovery, cross-tab reconcile, library, archive, settings, rules/hint/result dialogs | Done |
| 2 | Letter Wheel, Word Deduction, Word Families, Word Ladder | Playable preview |
| 3 | Hexabble migrated from the original source (pure TS engine, snapshot schema, rules decisions R0–R14, phone board, keyboard, recovery; no test hooks) | Playable preview, local pass-and-play |
| 4 | Letter Set, Clue Pairs, Missing Links, Definition Detective, Cryptic Workshop | Playable preview |
| 5 | Hidden Word Trail, Letter Circuit, Word Weave, Shrinking Staircase, Anagram Relay | Playable preview |
| 6 | Word Fragments, Phrase Repair, Daily Crossword (Quick and Cryptic styles) | Playable preview |
| 7 | Shared Word Board: local match, pinned 1.0 / 1.1-candidate rule sets, server-authoritative turn protocol as tested pure functions | Playable preview, local only (no backend) |
| 8 | Family space: Supabase schema with RLS proven on real Postgres 16, invitations, contribution, moderation, private media proxy, Birthday Book | Built; shows "Setup needed" until a Supabase project is connected |
| 9 | Publication verification | All automated gates pass; human gates open (below) |

All 19 games: complete engine-driven loop, full rules shown in the Rules dialog and on `/games/<id>`,
progressive hints recorded as assistance, honest results with spoiler-free sharing, replay, refresh
restore, keyboard and touch play, colour-independent feedback. `productionEnabled` is false for every
game by design.

## Verification (final run on main)

| Command | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | 559 tests pass (engines, properties, session layer, family RLS on Postgres 16) |
| `pnpm validate:content` | all 19 validators pass |
| `pnpm build` | pass |
| `pnpm test:e2e` | 138 browser tests pass (desktop 1440 and phone 390) |
| Pack scripts (`reference/build-pack-v3/scripts/*.py`, `hexabble-engine.test.cjs`) | pass |

Bugs found and fixed during integration: dialog focus restore could steal focus from fast keyboard
users (D10); archive filters dropped a change made in quick succession; mobile header overflow;
crude words earning bonus credit (membership v1.1).

## What a human must do before public release

Priority order. Details per game are in `docs/REVIEW-LOG.md`.

1. **Editorial review of every round** (all clues, categories, definitions, target lists, ladders,
   crossword grids). Category, cryptic and dual-definition games need two independent reviewers.
2. **Hexabble**: confirm permission to publish the name, board and code; confirm rules decisions
   R1, R3, R4, R6 (`docs/hexabble-rules-decisions.md`).
3. **Family space inputs**: Supabase project (URL, publishable key, auth redirect URLs, SMTP),
   recipient display name and birthday date, a named curator, approved photos/messages with
   permission. Steps: `docs/FAMILY-SPACE.md`.
4. **Approved word list**: review the ESDB candidate list and the exclusion list per game
   (two-letter tile words such as QI/ZA are absent, which affects Hexabble and Shared Word Board).
5. **Content volume**: the four launch games (Letter Wheel, Word Deduction, Word Families, Word Ladder) have 10+ rounds per difficulty;
   most other games have 4–7, labelled "limited preview". Daily editions need 30 scheduled reviewed
   editions per game.
6. **Real people**: observed pilot with experienced word-game players (and the recipient), difficulty
   calibration, a real screen-reader pass, and testing on the recipient's own device.
7. **Shared Word Board 1.1-candidate balance** (simulations suggest 93 tiles is too many for 9x9).
8. **Deployment**: not done; needs your instruction and hosting choice.

## Not built (by design or blocked)

Online multiplayer (no backend), any computer opponent, "Report an answer issue" (no editorial
queue), optional birthday modules (audio postcards, newspaper, timeline and others), editor/authoring
UI at `/editor`, account sync of puzzle progress.
