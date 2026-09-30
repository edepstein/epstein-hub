# Architecture and product decisions

Versioned record of decisions made during implementation. Each entry: context, decision, consequence.

## D1 Stack (2026-09-30)
New repository, so the pack's recommended stack is used: Next.js 16.3.8 App Router, React 19.3,
TypeScript 5.9.3 (TS 7 skipped: Next tooling compatibility), Tailwind 4.3, zod 4, Vitest 5,
Playwright 1.56.1 (matches the preinstalled chromium-1194). pnpm 10 with a lockfile.
shadcn/ui components are not generated: the v2 reference CSS already defines every control and
dialog, and native `<dialog>` provides focus containment/Escape. Recorded so a later move to
shadcn primitives is a deliberate change.

## D2 Visual system
`ui/styles.css` and `ui/themes.css` are ported verbatim into `src/styles/` (only `body[data-game]`
selectors rewritten to `[data-game]`, and `crossword`/`tile-table` aliases mapped to the canonical
`daily-crossword`/`shared-word-board`). They are loaded in the Tailwind `base` layer so utilities win.

## D3 Persistence model
Public attempts are stored device-locally as a versioned envelope (schemaVersion 1) holding raw
actions with IDs, pinned to round contentHash/rulesVersion/dictionaryVersion. State is rebuilt by
replaying actions through the pure engine, never trusted from storage. Duplicate action IDs are
ignored (idempotent). Unparseable/unreplayable saves are quarantined under `wc:v1:corrupt:*`
(not deleted) and a fresh attempt starts with an explanation. Version mismatch archives the old
attempt to history and starts the corrected round. Restart archives the previous attempt.
Cross-tab edits raise a reconcile banner instead of last-write-wins.

## D4 Dictionary
Gameplay membership = ESDB GB candidate list (81,901 words, sha256 daf3a790…) minus a small
automated offensive-term exclusion list, version `gb-esdb-v1-candidate`. This is explicitly NOT an
editorially approved layer; release gate stays open. Curated answer/target pools are per game and
per round. The 252k merged Hexabble list (unverified provenance) is not shipped; Hexabble validates
against the same ESDB list. Consequence: some two-letter tile-game words (e.g. QI, ZA) are not
accepted in Hexabble; documented in its rules.

## D5 Daily editions
No round has editorial approval, so there are no daily editions. All rounds are practice
(`demo` = original pack fixture, `practice` = authored in this build). The home page, archive and
game pages say so. Europe/London edition-date helper exists for when publishing starts.

## D6 Routes
`/library` added as a player collection distinct from `/archive` (per upgrades/20).
Match games (Hexabble, Shared Word Board) use `/play/<id>/match`.

## D7 Release status
Every game keeps `productionEnabled: false`: human editorial review, calibrated banks, 30 scheduled
editions, approved membership and observed pilots are not achievable by the build agent.
`availability: "playable-preview"` marks games whose complete engine-driven loop is implemented and tested.

## D8 Familiarity layer for authoring
ESDB was rebuilt at the pinned commit (reproducing the pack's sha256 exactly) and a SCOWL size-35
export (39,675 words) saved to `data/dictionaries/gb-esdb-v1-size35.txt` with a manifest. It is a
familiarity proxy for authors and validators when choosing target/answer words (e.g. "every target
must be in size-35"). It is not gameplay membership and not editorial approval. Node helper:
`loadFamiliarSync()` in `src/lib/dictionary/node.ts`.
