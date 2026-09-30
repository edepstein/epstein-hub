# Private family space: how it works and how to go live

The family space (`/family`) is a private, invitation-only area for one family: the **Family Window**
(photographs and short updates), the **Birthday Book** (a curated keepsake) and the curator's tools.
It is fully built against Supabase (Postgres, Auth and private Storage), but **no Supabase project
is connected in this repository**. Until one is, every family page shows "Setup needed" and every
family API answers `503 setup_needed`. There is no demo login, sample feed or fake upload.

## What exists

| Area | Where |
|---|---|
| Schema, RLS, storage policies, RPCs | `supabase/migrations/*.sql` |
| RLS proof against real Postgres 16 | `tests/family/rls.test.ts` (`pnpm test:family`) |
| Server libraries | `src/lib/supabase`, `src/lib/auth`, `src/lib/family` |
| API | `src/app/api/family/**`, `src/app/api/auth/**` |
| Pages | `/family`, `/family/feed`, `/family/book`, `/family/contribute`, `/family/manage`, `/family/invite/[token]`, `/sign-in` |
| Session refresh | `src/proxy.ts` (family, sign-in and auth routes only) |
| Fictional dev fixture importer | `supabase/dev/import-demo-fixture.ts` (local databases only) |

### Roles
- **Reader (viewer)**: reads published updates and the published book, favourites (private to them), replies.
- **Contributor**: also uploads photographs, writes captions, saves drafts and submits for review. Cannot publish, invite, change roles or see other people's drafts.
- **Curator**: also approves or withdraws posts, arranges and publishes the book, creates and cancels invitations, changes roles and removes access. A family always keeps at least one active curator.
- Puzzle editors (`editor_roles`) are separate and have no family powers.

### Privacy model
- Every query runs as the signed-in user; Postgres RLS enforces family membership and role on every row. The app never holds a service-role key.
- Membership is re-checked on every request, so removing someone takes effect on their next page or photo request.
- Photos are stored in the **private** `family-media` bucket at `<familyId>/<mediaId>` and are only ever served through `GET /api/family/:familyId/media/:mediaId`, which re-checks access, re-validates the bytes and strips metadata again. There are no public or long-lived signed URLs. A photo a relative has already downloaded (only possible where the uploader allowed downloads) cannot be recalled.
- Uploads are checked by their real bytes (JPEG, PNG, WebP; 10 MB). Location/EXIF, XMP, comments and PNG text chunks are removed (orientation is kept). HEIC is refused with a "save as JPEG" message. Photos over 4 MB are resized in the browser before upload.
- Private pages and APIs send `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`, and never put names, captions or photos in public HTML, metadata or share cards. Invitation pages send `Referrer-Policy: no-referrer`.
- Mutations require a same-origin `Origin` (or `Sec-Fetch-Site: same-origin`) header. Sign-in, invitation, acceptance, reply and upload endpoints are rate limited (in-process; Supabase Auth limits and a 20-invites-per-hour database limit are the backstop on multi-instance hosting).
- The audit log records who did what to which item, never captions, emails or tokens.

### Invitations
A curator creates an invitation for an email address and role (expiry 1 to 30 days, default 7). The link is shown **once**; the curator sends it personally (the app sends no email other than Supabase sign-in emails). Only a sha256 hash of the token is stored. Acceptance requires signing in with that same confirmed email; the link is single use and can be cancelled.

### Moderation and the book
Contributors submit; the curator's approval publishes the post and records that the uploader's stated permission was reviewed. Withdrawal removes the post and its photo from readers immediately. The Birthday Book is composed as a private draft and published as an immutable version; readers see only the latest published version, so they never see a half-arranged book. A photo whose permission is withdrawn disappears from the book view (the text stays).

## What the owner must supply

These are open inputs; nothing is guessed in the code:
1. **Recipient's display name and birthday date** (optional; entered by the curator under Curate > Family details). No age or milestone is ever shown.
2. **A named curator** who agrees to look after the space.
3. **Approved photographs and genuine messages**, each with the contributor's permission and the agreement of the people pictured.
4. **A Supabase project** and hosting configuration (below).

## Going live: step by step

1. **Create a Supabase project** (EU region recommended for a UK family). Note the project URL and the publishable (or anon) key.
2. **Apply the migrations** in `supabase/migrations/` in filename order (Supabase CLI `supabase db push`, or paste each file into the SQL editor). This creates the tables, RLS policies, functions and the private `family-media` bucket with its policies.
3. **Auth settings** (Authentication > URL configuration):
   - Site URL: your production origin, e.g. `https://your-domain.example`.
   - Redirect URLs: `https://your-domain.example/api/auth/callback` and `https://your-domain.example/api/auth/confirm`.
   - Email provider enabled; "Confirm email" on.
   - Email template (Magic link) recommended so links work on any device and the code is shown:
     ```
     <p><a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/family">Sign in to the family space</a></p>
     <p>Or type this code: {{ .Token }}</p>
     ```
   - Configure a custom SMTP sender before launch (the built-in sender is heavily rate limited).
4. **Environment variables** on the host (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `FAMILY_SITE_ORIGIN`. Do **not** add a service-role key.
5. **Create the first curator**: the curator signs in once at `/sign-in` (this creates their auth user; they will see "No family access"). Then, in the SQL editor:
   ```sql
   select public.bootstrap_family('Our family', (select id from auth.users where email = 'curator@example.com'), 'Curator display name');
   ```
6. **Curator setup** at `/family/manage`: family details (title, optionally the name and date), start the Birthday Book, invite relatives with the right roles.
7. **Orphan clean-up**: schedule `select public.cleanup_orphan_family_media();` daily (pg_cron) to mark abandoned uploads older than 24 hours as deleted, and periodically remove storage objects whose media row is deleted (Storage dashboard or a script with owner credentials run outside the app).
8. **Backups**: enable point-in-time recovery or scheduled backups, and test a restore into a separate project (records and photo associations) before the reveal.
9. **Verify** with two test families and a signed-out browser: run through the private-space checklist below.

## Hosting note
Uploads go through the server so the bytes can be checked and cleaned. Some hosts cap request bodies (Vercel functions: about 4.5 MB). The browser resizes photos above 4 MB, so typical phone photos fit; if a host rejects a body, the form keeps the text and explains that the photo was too large.

## Tests

- `pnpm test:family` / `pnpm test`: starts a throwaway Postgres 16 (needs `initdb`/`pg_ctl`; set `PG_BIN` if not in `/usr/lib/postgresql/16/bin`; `WC_SKIP_PG=1` skips), applies a minimal Supabase shim and the real migrations, and proves: anonymous and unrelated accounts see nothing; viewers cannot post or upload; contributors cannot invite, elevate roles, self-approve or see others' drafts; curators cannot touch another family; cross-family media attachment fails (composite foreign keys); revoked members lose access on the next query; expired, reused, cancelled, wrong-email and unverified-email invitations fail; withdrawal and consent withdrawal hide media and storage objects; the book publishes atomically; audit rows hold no captions or emails.
- Unit tests: media validation/stripping, CSRF, rate limiting, redirects, roles, invite tokens, validation schemas, fixture import guards, and every API route's setup-needed response.
- `tests/e2e/family.spec.ts`: setup-needed states, private/noindex headers, 503 APIs, public pages free of private strings, and the contribution form's browser-side checks (in preview mode). Signed-in browser journeys need a configured Supabase project and are listed in `docs/REVIEW-LOG.md` as open.

## Private-space checklist before the reveal
- [ ] Signed-out browser: `/family` shows only "Invitation required"; no names or photos in page source.
- [ ] Second test family cannot open the first family's posts, photos (`/api/family/<A>/media/<id>`), book or invitations.
- [ ] Reader cannot see Share or Curate; contributor cannot see Curate.
- [ ] Expired, reused and cancelled invitation links show the right message.
- [ ] Removing a member stops their next request.
- [ ] Upload a phone photo with location: the served copy has no GPS data.
- [ ] Withdraw a post and a photo permission: both disappear for readers.
- [ ] Remove every fictional fixture record (`families.is_fictional_fixture = true`).
- [ ] Try the recipient's own device and browser; add a bookmark; keep a printed card with the address.
