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
| `pnpm test` | 565 tests pass (engines, properties, session layer, family RLS on Postgres 16) |
| `pnpm validate:content` | all 19 validators pass |
| `pnpm build` | pass |
| `pnpm test:e2e` | 141 browser tests pass (desktop 1440 and phone 390) |
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
4. **Approved word list**: membership v2 (253k words, includes the standard two-letter tile words) is a
   candidate superset, not Collins Scrabble Words itself; see DECISIONS D11 for how to merge a licensed copy.
5. **Content volume**: every puzzle game now has 12 or more rounds per difficulty (Daily Crossword 7), up from 4-7.
   Counts are in `docs/STATUS.md`. Players are only offered rounds they have not played (DECISIONS D13). Daily editions need 30 scheduled reviewed
   editions per game.
6. **Real people**: observed pilot with experienced word-game players (and the recipient), difficulty
   calibration, a real screen-reader pass, and testing on the recipient's own device.
7. **Shared Word Board 1.1-candidate balance** (simulations suggest 93 tiles is too many for 9x9).
8. **Deployment**: not done; needs your instruction and hosting choice.

## Not built (by design or blocked)

Online multiplayer (no backend), any computer opponent, "Report an answer issue" (no editorial
queue), optional birthday modules (audio postcards, newspaper, timeline and others), editor/authoring
UI at `/editor`, account sync of puzzle progress.

## Update 2026-10-01: dictionary, no-repeat play, more rounds

- Word list: 253,090 words including the standard two-letter tile words, British -ise/-ize and American
  spellings (DECISIONS D11). It is a superset built from permissively licensed sources, not Collins
  Scrabble Words itself; a licensed CSW file can be dropped in and merged.
- No repeats: practice, "Next unplayed round" and "Play something new" only offer rounds the player has
  not played; the least recently played game is preferred (D13).
- Word Ladder scores against par over everyday words (D12).
- Rounds per difficulty: Letter Wheel 16, Word Deduction 16, Word Ladder 16, Word Families 15,
  Letter Set 14, Shrinking Staircase 14, Anagram Relay 14, Phrase Repair 14, Word Fragments 14,
  Missing Links 14, Hidden Word Trail 12, Letter Circuit 12, Word Weave 12, Clue Pairs 12,
  Cryptic Workshop 12, Definition Detective 12, Daily Crossword 7.
- All new rounds still need human editorial review; every uncertainty is in `docs/REVIEW-LOG.md`.
