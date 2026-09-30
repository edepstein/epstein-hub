# Birthday space implementation brief

## Recommendation and scope

Build a receiving-first **Family Window**, seeded with a complete **Birthday Book**, alongside the independent public puzzle site. Add audio postcards and a curated family newspaper when actual material exists. Do not build every idea for launch. Timeline, family crossword, picture mysteries, oral history and calendar are optional modules with separate release gates.

Confirmed fit: the recipient enjoys Metro Word Wheel and NYT word games. Device, confidence with accounts, desire to contribute and milestone age are unconfirmed. Do not infer impaired vision or reduced ability from age. Birthday name, date and age are configurable and must be supplied; never auto-fill “80th”.

Scores are expert product judgements, not measurements or user testing. Weighted criteria: fit 25%, emotional value 25%, repeat value 20%, usability 15%, low maintenance 15%.

| Module | Score /100 | Decision |
|---|---:|---|
| Family Window | 87 | Core if a curator commits |
| Public puzzle portal | 86 | Core, specified elsewhere |
| Birthday Book | 82 | Complete at reveal |
| Family Newspaper | 80 | Best ongoing alternative to a sparse feed |
| Audio Postcards | 79 | Launch if genuine recordings exist |
| Family Crossword | 75 | Private occasional bonus |
| Memory Timeline | 73 | Later, when dates are supplied |
| Picture Mysteries | 73 | Later, if fair clue material exists |
| Oral History | 62 | Optional participation only |
| Family Calendar | 62 | Utility companion, not the main gift |

## Shared architecture and boundaries

Use the project's selected Next.js/TypeScript stack. Public games and private birthday data are separate route/data domains. Public pages may link to `/family`, but their HTML, API responses, metadata, analytics events, search indexes and share cards must contain no private names, media or captions. Private routes require server-side authentication and membership checks, not merely a hidden menu. Do not cache private responses in public/CDN caches.

Suggested relational baseline; equivalent schemas are acceptable if constraints remain enforceable:

- `families(id uuid, display_name text, timezone text, created_at timestamptz)`.
- `memberships(family_id uuid, user_id uuid, role enum(viewer,contributor,curator), status enum(active,revoked), created_at timestamptz)`; unique family/user.
- `invitations(id uuid, family_id uuid, email_normalised text, role, token_hash text, expires_at timestamptz, accepted_at timestamptz?, created_by uuid)`; single-use token, revoke support. Do not store raw invitation secrets.
- `assets(id uuid, family_id uuid, owner_user_id uuid, storage_key text, kind enum(image,audio,pdf), mime_type text, byte_size int, width int?, height int?, duration_seconds int?, alt_text text?, consent_status enum(pending,approved,withdrawn), status enum(processing,ready,failed,deleted), created_at timestamptz)`.
- `consent_records(id uuid, family_id uuid, asset_id uuid?, content_id uuid?, recorded_by uuid, permission_basis text, restrictions text?, recorded_at timestamptz, withdrawn_at timestamptz?)`. Record an actual permission or rights basis; a checkbox cannot substitute for obtaining it.
- `audit_events(id uuid, family_id uuid, actor_id uuid, action text, target_type text, target_id uuid, occurred_at timestamptz)`; no raw message/audio payloads in logs.

All private content tables carry `family_id`. Foreign keys must prevent records referencing an asset from another family, e.g. composite `(asset_id,family_id)` to `(assets.id,assets.family_id)`. Enforce tenant scoping for both reads and writes. With Supabase, enable RLS on every private table and private storage policy; with another database, implement equivalent server authorisation and test it. Never ship privileged database/service keys to clients.

Membership helper must evaluate the authenticated subject and active membership. A client-supplied family ID or role is never trusted. Viewer reads published content; contributor creates own drafts and submits/publishes according to the curator's explicit policy; curator manages family content and invitations. Contributors cannot change membership, view others' drafts or overwrite others' assets. Revoke membership takes effect on the next server request.

Private media storage: no public bucket or permanently public URLs. Generate short-lived signed URLs only after active membership checks. Refresh expired links on authorised card access. Document that already issued links can survive until expiry and downloaded copies cannot be recalled. Serve audio with range support where available. Validate media by actual decoded format, size and duration; strip unintended EXIF/location metadata. Default limits: images 10 MB; audio 10 minutes/30 MB; configurable with clear client feedback. Re-encode supported images; reject executable/unsupported payloads. Keep original filenames out of public URLs. Avoid retaining discarded originals unless explicitly required.

Sessions: secure cookies, CSRF protection for cookie-authenticated mutation routes, safe redirect allowlist, rate-limited invitation/sign-in endpoints. Remember the device with the chosen provider's secure supported session mechanism. A named relative may help with recovery through documented invitations/account recovery; do not implement a shared master password. Require reauthentication for destructive family export/deletion where supported. Account recovery must not reveal whether arbitrary email addresses have membership.

## Shared UX and accessibility

Readable default type, adjustable type size, sufficient contrast, visible focus, semantic headings, labelled controls, screen-reader announcements and touch targets at least 44 CSS px. Text scale to 200% without lost actions. No gesture-only interaction, unexpected autoplay or timed prompts. Respect reduced motion. Audio needs transcript and independent text alternative. Keyboard users can complete every core task. Preserve public puzzle progress when moving between sections. Avoid likes/follower counts and contribution streaks.

States required: signed out, invite expired, invite already accepted, access revoked, loading, first-use empty, populated, media processing, failed upload, offline/retry, permission denied, deleted content and expired media link. Errors explain recovery without exposing another family. Empty state: “Family updates will appear here” with curator-only upload action; no fabricated sample relatives in production.

## Release strategy

1. Seed Birthday Book and optionally Audio Postcards from real approved material.
2. Release Family Window only after a named curator agrees to maintain it. Set a sustainable baseline, e.g. one meaningful weekly/fortnightly update, rather than promising family participation.
3. Add a monthly Newspaper if aggregation is more reliable than frequent posting.
4. Optional modules ship only after their own content and functional tests pass.

The gift must remain useful if nobody posts for a month: birthday collection remains accessible, older updates remain chronological, no guilt prompts or “inactive family” badges. Setup on her actual device with a bookmark and short demonstration; offer a printed card with the URL as fallback.

## Shared release gates

- Anonymous requests, public game visitors and a second test family cannot read private API records, storage objects, rendered HTML or metadata.
- Cross-family asset linking, role escalation and spoofed user/family IDs fail.
- Revoked members cannot obtain new signed links; existing signed URL lifetime is documented.
- Public and private caching behaviour verified; private responses cannot leak between users.
- Upload validation, withdrawal, deletion, invitation expiry and session recovery tested.
- No production demo records. Fixture importer refuses production by default.
- Real captions, names, memories and milestone wording approved by curator; asset permission recorded.
- Restore a backup into an isolated environment and verify records/media associations. State backup retention and deletion implications in private help.
- Basic threat review, dependency checks and accessible keyboard/mobile flows pass.
- At least one real recipient or comparable enthusiast completes a prototype walkthrough; record observations without describing simulated agent reviews as actual user tests.

See [content collection checklist](content-collection-checklist.md). `../content/birthday-demo.json` contains explicitly fictional development-only fixture data. It is not a completed personal gift.
