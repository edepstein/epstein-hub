# Shared site and birthday interaction parity

## Intent and source precedence

Match Hexabble's complete interaction loop while retaining Word Club's colourful v2 identity. Read `AGENTS.md`, `docs/01-product-and-site.md`, `02-design-system.md`, `03-architecture-data-api.md`, `05-testing-and-release.md`, `birthday/`, and `ui/DESIGN-HANDOFF.md`. Inspect `hexabble-reference/index.html`, `app.js`, `engine.js` and `styles.css`; the copied vendor source is also available in this pack.

Hexabble concretely implements setup choices, placement selection, move preview, score/history updates, recall, exchange, handover, rules, restart confirmation and game ending. This is a benchmark for coherent actions and consequences, not evidence of persistent storage, comprehensive keyboard access or production family privacy. Reuse neither its palette nor unsupported quality claims. Follow the original engines and data contracts for correctness.

Where birthday briefs use generic `posts/assets/memberships` names, map their requirements to the canonical architecture's `family_posts/family_media/family_memberships`. Document mappings in an architecture decision; do not create duplicate competing tables.

## Public journeys and shared controls

Home should offer today's featured playable edition, three distinct launch alternatives and a quiet archive entry. Cards use v2 mechanic-shaped illustrations, accent/wash tokens and accurate availability. Miniatures use separate illustrative data, never current solutions. Unavailable editions show useful recovery, not a nonfunctional Play button.

A player chooses an edition, understands its rules, makes a move, corrects rejected input, optionally takes a hint, leaves, returns and completes. Each action must produce engine-derived state plus clear feedback. Rules, difficulty, hints, undo where supported, results and navigation work throughout the loop. Preserve invalid input for correction; explain why it was rejected. Confirm destructive reset/reveal and retain the original attempt when switching to a separately authored difficulty. Completion offers explanation, assistance summary, next puzzle, library and spoiler-free public sharing. Do not force daily games into Hexabble's multiplayer setup.

## Library, autosave and archive

Add `/library` as a player collection distinct from `/archive`; record this route extension. Library sections: Continue playing, Completed, Revealed and optional bookmarked published editions. Cards show game, edition date, difficulty, outcome and assistance; private birthday items never appear here. A completed edition can be reviewed without silently resetting it. Replay creates a distinct labelled practice attempt when supported.

Autosave each committed public engine action and separately persist resumable input/selection drafts where safe. Store typed versioned envelopes keyed by puzzle ID, hash, rules version and attempt ID; replay/validate actions on restore. Never regenerate a board after refresh. Show Saved only after successful storage, Saving during writes and an explicit temporary-play warning if storage is unavailable. Corrupt/version-incompatible records offer safe recovery/export rather than quietly deleting history. Cross-tab changes prompt reconciliation; do not overwrite newer work silently.

Guest library/settings work locally without sign-in. Explicit authenticated sync imports attempts and reports conflicts; no arbitrary last-write-wins. Archive filters game/date/difficulty, retains filters on back navigation and distinguishes published inventory from labelled practice fixtures. Dates follow Europe/London edition metadata; an active puzzle survives midnight. Empty archive offers today's games, not fabricated historical editions.

## Settings and responsive focus

Implement text scale, motion, contrast preference and optional sound/streak visibility. Defaults are quiet and untimed. Preferences affect presentation, never answers or difficulty. Persist settings separately from attempts; provide scoped clear-progress and clear-preferences confirmations. Clear-data copy distinguishes local records from server accounts/family content.

Preserve warm paper, serif headings, navigation pills and every game's v2 signature. Family pages keep rose-brown album surfaces, readable captions and facing book pages that stack on mobile. Restrained state transitions support action without delaying play. At 320/390/768/1440px and enlarged text, controls remain usable, long labels wrap and body overflow is absent. Dense boards may have explicitly controlled zoom/scroll. Dialogs trap focus, Escape closes and restores opener focus; navigation moves focus appropriately without stealing it during input. Provide keyboard equivalents for dragging and polite status announcements. Do not copy Hexabble's global shortcuts without scoped focus handling.

## Real birthday contribution loop

Viewer journey: authenticate → read an approved update → enlarge photo/listen with transcript → favourite → optionally reply → browse complete Birthday Book. Reading requires no contribution. Retain feed position and book chapter between private navigations; persist favourites/progress in authorised server records, not public browser caches.

Contributor journey: authenticate with contributor role → select actual image → preview → enter caption/alt text → record actual permission → save private server draft → submit → see processing/review status → curator publishes → viewer sees persisted card. Validate decoded image bytes and 10 MB limit, strip location metadata, prevent duplicate submission, clean orphan uploads and revoke preview object URLs. Failed uploads retain editable text and offer retry; preview alone never means published. Contributor identity comes from account membership, not a freely typed author field. Replies, moderation, favourite/unfavourite and book navigation survive refresh and a new session.

Curator can approve, withdraw, arrange book content and manage scoped invitations. Optional audio requires genuine recordings, approved transcripts and playback/retry states. Hide optional modules until their content and release gates pass. No database credentials means an explicit setup-needed development state, not fake successful authentication/upload. Development fixtures remain conspicuously fictional. Production rejects fixture imports and requires supplied names/date, approved assets, genuine messages and a confirmed curator. The gift remains useful after four quiet weeks.

## Privacy and acceptance

Enforce server membership, RLS and tenant-safe foreign keys; viewer/contributor/curator are distinct from puzzle editors. Private media uses authenticated delivery or short-lived authorised links with documented expiry/revocation limitations. Private pages/API/media are no-store and excluded from public HTML, search, share cards, logs and service-worker caches. Persist private drafts on the server by default; local media previews are ephemeral. Show safe recovery for expired invitations, revoked membership, expired media and session replacement.

Release evidence must demonstrate: public home-to-completion-to-library flow; refresh restoration after valid/invalid/hinted actions; storage failure and corrupted save recovery; midnight continuity; archive back/filter behaviour; settings persistence; keyboard/dialog focus; mobile/large-text layouts. Birthday evidence must demonstrate actual database persistence, failed-upload retry, review publication, favourite/reply persistence, book resume and withdrawal. Anonymous users and unrelated family B must fail direct API/storage/export access to family A; role escalation and cross-family asset attachment fail. Screenshots or button-presence checks are insufficient.

## Claude work batch

Inspect the files above and existing implementation before changes. Scope: shared site components, public progress/library/archive/settings services, authorised birthday endpoints/forms, migrations and focused integration/browser tests. Preserve unrelated work and v2 themes. Non-goals: new engines, palette replacement, invented family content, compulsory posting, extra social features or deploying production.

Implement in three reviewable slices: public persistence/navigation; responsive settings/focus; real birthday receiving/contribution flows. Reuse repository scripts; run typecheck, relevant unit/integration tests, production build and targeted Playwright flows. If missing, add documented scripts rather than claiming commands exist. Report changed files, exact commands/results, persistence/privacy evidence, screenshots, unresolved supplied-content dependencies and remaining release gates. Do not report production readiness from a prototype walkthrough.
