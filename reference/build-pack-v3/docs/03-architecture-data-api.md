# Architecture, data and API contract

## Implementation recommendation

Next.js App Router + TypeScript + Tailwind + shadcn/ui + lucide-react. Supabase Postgres/Auth/private Storage for accounts and family content. Solo engines and local progress work without backend credentials. An optional repository-compatible alternative is allowed if recorded in an architecture decision. Keep dependencies pinned in the eventual app lockfile. This pack does not include a full scaffold or dependency lockfile.

Use Server Components for public shells and server-authorised family data. Client Components own game input and local public attempt state. Do not pass service keys, private solutions or private family records through public props. Plain HTML references are design inputs, not an authentication system or the recommended production framework.

## Suggested source layout

```text
src/app/(public)/...
src/app/(family)/family/...
src/app/(editor)/editor/...
src/components/site/
src/components/games/<gameId>/
src/components/family/
src/engines/<gameId>/
src/lib/dictionaries/
src/lib/content/
src/lib/progress/
src/lib/auth/
src/lib/supabase/
src/content/demo/
scripts/content/
tests/engines/
tests/e2e/
supabase/migrations/
```

## Canonical puzzle envelope

Seed files in this pack may use richer game-specific keys. Write a tested importer, do not guess mappings from display copy. Preserve source fixture IDs in provenance.

```ts
type Difficulty = 'gentle' | 'standard' | 'expert';
type PuzzleStatus = 'demo' | 'draft' | 'validated' | 'reviewed' | 'scheduled' | 'published' | 'withdrawn';
interface Puzzle<TPayload> {
  id: string; gameId: string; boardId: string;
  editionDate: string | null; publishAt: string | null; timeZone: 'Europe/London';
  difficulty: Difficulty; status: PuzzleStatus;
  rulesVersion: string; dictionaryVersion: string | null;
  payload: TPayload; contentHash: string;
  provenance: { source: 'original'; authorId: string | null; sourceFixtureId: string | null };
}
interface Attempt<TState> {
  attemptId: string; puzzleId: string; puzzleHash: string; rulesVersion: string;
  mode: Difficulty; state: TState; revision: number;
  actions: { id: string; at: string; type: string; payload: unknown }[];
  hintsUsed: { hintId: string; at: string }[];
  outcome: 'playing' | 'completed' | 'failed' | 'revealed' | 'abandoned';
  createdAt: string; updatedAt: string;
}
```

Runtime schemas use Zod or equivalent, with a discriminated union keyed by gameId. Validate imports, API responses and stored attempts. Reject unknown keys in privileged records. Never trust a browser-provided outcome, score or membership role.

## Engine interface

```ts
interface GameEngine<P, S, A> {
  initialise(puzzle: P): S;
  apply(state: S, action: A, context: { dictionary: ReadonlySet<string> }):
    { state: S; events: { type: string; message?: string }[] };
  validatePuzzle(puzzle: P): { valid: boolean; errors: string[] };
  restore(puzzle: P, stored: unknown): S;
  summarise(state: S): { outcome: string; efficiency: number | null; assistance: number };
}
```

An invalid action does not mutate the board or consume an attempt unless the game explicitly counts a legal but incorrect guess. Invalid dictionary entries in Deduction do not consume guesses; incorrect valid guesses do. Duplicate Families submissions count at most once. Word-entry duplicates never score twice. Every game brief defines its exact events, terminal states and hints.

Use an injectable clock and deterministic PRNG for tests. Do not use Math.random to regenerate a resumed board. Fixed puzzle data is immutable. Compute hashes at import and pin each attempt to that hash. A correction creates a new revision and prompts a safe restart; do not silently reinterpret a saved attempt.

## Solution separation and anti-cheating boundary

Public board data omits future answers and solutions where practical. Production scoring/hint endpoints can keep these server-side. Word Wheel/Set offline dictionary play inherently exposes enough information for solving; do not claim cheating-proof competition. Launch metrics are personal. Ranked multiplayer requires server validation and private racks. Demo fixture JSON contains answers for developers and must not be accidentally shipped as a public production bundle for competitive games.

## Database model

Use UUID IDs, timestamps and explicit foreign keys. Tables:

- `profiles(user_id, display_name, preferences)`; personal settings only.
- `puzzles(id, game_id, edition_date, difficulty, rules_version, dictionary_version, status, public_payload, content_hash)`.
- `puzzle_secrets(puzzle_id, answer_payload, hint_payload)`; server/editor access only.
- `puzzle_reviews(id, puzzle_id, reviewer_id, kind, decision, notes, created_at)`.
- `attempts(id, user_id, puzzle_id, mode, state, revision, outcome)`; own-row RLS. Guest attempts stay local.
- `families(id, title, recipient_name, birthday_date, enabled_modules)`.
- `family_memberships(family_id, user_id, role, status)` unique pair; role viewer/contributor/curator.
- `family_invites(id, family_id, invited_email, token_hash, expires_at, accepted_at, invited_by)`.
- `family_posts(id, family_id, author_id, caption, status, published_at)`.
- `family_media(id, family_id, post_id, storage_path, kind, alt_text, consent_status, source_owner, processing_status)`.
- `family_comments(id, family_id, post_id, author_id, body, deleted_at)`.
- `family_albums`, `album_items`, `book_chapters`, `audio_transcripts`, `calendar_events` and other optional records as each birthday brief specifies.
- `editor_roles(user_id, role)`; separate from family curators. Being a family curator does not grant puzzle-editor powers.
- `audit_events(id, actor_id, entity_type, entity_id, action, at)`; no raw captions, token values or sensitive content in public logs.

## API boundaries

| Endpoint | Input | Result / authority |
|---|---|---|
| `GET /api/puzzles/today?gameId=` | known game ID | published public payload / UK edition |
| `GET /api/puzzles/:id` | published puzzle ID | public payload only |
| `POST /api/puzzles/:id/submit` | typed action, attempt/revision/idempotency key | server-derived outcome for server-backed modes |
| `POST /api/puzzles/:id/hint` | hint level, attempt/revision | permitted reveal and assistance event |
| `POST /api/attempts/sync` | authenticated user's typed attempts | own-row import, conflict report |
| `GET /api/family/:id/posts` | active membership | scoped private records, no-store |
| `POST /api/family/:id/uploads` | permitted file metadata | short-lived upload reservation after contributor check |
| `POST /api/family/:id/posts` | text, verified family-owned media IDs | validated draft/publish according to role |
| `POST /api/family/:id/invites` | curator, email, allowed role | hashed expiring single-use invite |
| `GET /api/family/:id/media/:mediaId` | active membership checked per request | authenticated proxy/download or very short-lived URL |

Return stable error codes and human-readable messages. Use 400 malformed input, 401 signed out, 403 unauthorised, 404 absent or deliberately concealed entity, 409 version conflict, 422 invalid game action, 429 rate limit and 503 unavailable service. Never echo secrets.

## Family authorisation and private media

RLS on all family tables checks active membership in the row's family_id. Contributor writes also require author_id=auth.uid(); curators can moderate within their family. Membership grants are curator-only and cannot be edited by users to escalate themselves. Avoid recursively querying the protected memberships table in its own policy: use a narrowly scoped tested helper or an appropriate policy design, with a fixed search_path and audited privilege boundaries.

Media resides in a private bucket using familyId/mediaId paths. A guessed object path must not bypass membership. Prefer authenticated media responses for revocation-sensitive content. Short-lived signed URLs are bearer credentials that can be forwarded and remain valid until expiry; removing membership does not instantly invalidate existing URLs. Never use long-lived public CDN URLs for family images. Strip location metadata, restrict MIME types/size and verify file bytes after upload. Private responses and error pages use Cache-Control: private, no-store; never cache private content in a service worker or shared Next.js/CDN cache.

Session recovery uses supported Auth flows. A family invite must verify the invited email and family relationship on acceptance; the opaque link alone is not sufficient for account ownership. Notifications require opt-in. Tests use two separate families and an anonymous visitor.

## Operational and deployment requirements

Environment values: public Supabase URL and publishable key as appropriate; server-only secrets in server configuration. Provide `.env.example` with placeholders, never live credentials. Account recovery redirect allowlists, rate limits, back-ups and retention policies are configured before launch. Hosting is not automatically authorised by possession of this pack. The owner controls production domain and publication decision.
