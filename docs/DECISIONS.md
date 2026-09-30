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

## Batch 8 (family space): Supabase, schema, RLS tests, media and sessions (2026-09-30)
Context: the private birthday/family space needs real accounts, tenant isolation and private
media, but no Supabase project or credentials exist in this build.

- **Provider and versions.** Supabase Postgres + Auth + private Storage as docs/03 recommends,
  with exact pins `@supabase/supabase-js 2.117.2` and `@supabase/ssr 0.12.7` (cookie sessions for
  the App Router). Dev-only: `pg 8.23.1` + `@types/pg 8.23.1` for the RLS integration harness.
- **Setup-needed, never faked.** Without `NEXT_PUBLIC_SUPABASE_URL` and a publishable/anon key every
  `/family/*` and `/sign-in` page renders an explicit "setup needed" state and every family/auth API
  returns 503 `setup_needed`. There is no demo login, no sample feed and no fake upload success.
- **No service-role key in the app.** All reads/writes run as the signed-in user so RLS is the
  enforcement layer; privileged steps are narrow SECURITY DEFINER functions with `search_path=''`
  (`accept_family_invite`, `has_family_role`, `media_is_shared`, `write_book_snapshot`). The first
  family and curator are created by the owner with `bootstrap_family()` from the SQL editor.
- **Canonical names (docs/07 alias map).** `family_memberships`, `family_invites`, `family_media`,
  `family_posts`, `family_comments` (replies), plus `family_post_media` (join table, composite
  `(id,family_id)` FKs on both sides), `family_favourites`, `consent_records`, `family_books`,
  `book_chapters`, `book_entries`, `book_snapshots` + `book_snapshot_media` (immutable published
  revisions so viewers never see a half-reordered book), `book_progress`, `audit_events` (no
  captions, emails or tokens) and `editor_roles` (puzzle editors; grants no family power).
- **Moderation policy.** `contributor_publish_policy` is fixed to `review_required` for launch:
  contributors draft and submit; a curator approves (which also marks the recorded consent approved)
  or withdraws via `moderate_family_post()` with optimistic version checks.
- **Invites.** 32-byte random token, only its sha256 stored, expiry at most 30 days, single use,
  revocable, and acceptance requires the signed-in account's confirmed email to equal the invited
  email. Per-curator DB rate limit (20/hour) plus in-process limits on the API.
- **RLS tests.** `tests/family/rls.test.ts` initdb's a throwaway Postgres 16 cluster (as the
  `postgres` OS user via spawn uid/gid when run as root), applies a minimal Supabase shim
  (roles, default privileges, `auth.uid()` from `request.jwt.claims`, `auth.users`, storage
  tables) and the real migrations, and runs the docs/05 matrix. It skips with a warning when
  Postgres binaries are absent (`WC_SKIP_PG=1` forces a skip). PGlite fallback was not needed.
  `vitest.config.mts` include gained `tests/family/**`; `pnpm test:family` runs only these.
- **Media.** Uploads go through the server (`POST /api/family/:id/uploads`): magic-byte sniffing
  (JPEG/PNG/WebP only, 10 MB), dimension parsing, and lossless metadata stripping without a
  re-encoder (JPEG APP1-APP15/COM segments, PNG text/eXIf/time chunks, WebP EXIF/XMP chunks). No
  native image dependency (sharp) is added; pixels are never re-encoded, so a crafted image that
  parses but is malformed is still served only as `image/*` with `nosniff` and a sandbox CSP.
  HEIC is rejected with a "save as JPEG" message. Audio validation (30 MB / 10 min, WAV duration)
  exists but audio upload is switched off until Audio Postcards has genuine recordings and a
  transcript review flow. Media is served only through the authenticated proxy
  `GET /api/family/:id/media/:mediaId` (membership re-checked by RLS on every request), never by
  public or long-lived signed URLs, so revocation is effective on the next request.
- **Sessions.** `src/proxy.ts` (Next 16 proxy, matcher limited to `/family`, `/sign-in`,
  `/api/family`, `/api/auth`) refreshes Supabase cookies so rotated refresh tokens are persisted.
  Mutations require a same-origin `Origin` (or `Sec-Fetch-Site: same-origin`) header; redirects
  after sign-in are limited to `/family` paths.
