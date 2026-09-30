# Product and full-site specification

## Product goal and audience

Create an original collection of genuinely satisfying word puzzles, given as a birthday gift and suitable for eventual public use. The primary recipient already enjoys Metro Word Wheel and NYT word games. Familiarity is an entry point; repeat value comes from fair, interesting content, meaningful difficulty and a reliable daily experience. Do not infer other interests or reduce intellectual challenge because of age.

Success means the recipient independently finds a puzzle, enjoys solving it, understands rejected answers, returns to unfinished progress and discovers approved family messages without maintaining the site herself. Public players should receive the same quality of game experience without seeing private material.

## Sitemap and access

| Route | Purpose | Access |
|---|---|---|
| `/` | Featured daily puzzle, 3 launch alternatives, archive entry | Public |
| `/games` | Filterable catalogue, only live games playable | Public |
| `/games/[gameId]` | Daily launch page and rules | Public |
| `/play/[gameId]/[puzzleId]` | Immutable puzzle instance | Public for published puzzles |
| `/practice/[gameId]` | Clearly labelled demo/practice inventory | Public |
| `/archive` | Search/filter by game, month and intended difficulty | Public |
| `/stats` | Local statistics, optional synced account | Public local / authenticated sync |
| `/settings` | Text size, contrast, motion, sound, optional streaks | Public |
| `/about`, `/help`, `/privacy`, `/terms`, `/credits` | Support and provenance | Public |
| `/sign-in` | Supported account sign-in and recovery | Public form |
| `/family` | Private birthday/family landing page | Active family member |
| `/family/feed`, `/family/book`, `/family/albums` | Receiving-first content | Active family member |
| `/family/contribute` | Upload and draft a message | Contributor / curator |
| `/family/manage` | Invitations, content and export | Curator |
| `/editor` | Puzzle authoring, validation, review, scheduling | Editor roles only |

Birthday routes for optional features are specified in `birthday/`. Hide them until enabled. Private routes are excluded from public sitemap, public search, OG images, previews and analytics payloads. A noindex tag does not replace authorisation.

## First-visit journey

Hero: “A little wordplay, every day.” Beneath it show today's featured game, one short rule sentence, difficulty and a Play button. A real playable preview can replace decorative imagery. Show three clearly different game cards, a quiet archive link and a family-space entry. The public family entry is just “Family space · invitation required”, with no names or content. After authenticated membership, a private landing page can show the latest update.

Do not put all 18 games above the fold. Catalogue supports search and filters for Word building, Deduction, Connections and Clues. A Coming soon tile has no Play CTA and does not count toward live games.

## Daily publication and identity

Launch is UK-centred: a single daily edition per game using Europe/London publication dates. Store UTC publish_at plus edition_date and time_zone. International users see the UK edition consistently. Do not derive puzzle IDs from browser locale. Server returns active published edition; client displays the date using that metadata. If a game starts before midnight it keeps its instance and can finish afterwards. Completion belongs to that instance; streak policy is a separate feature.

Each difficulty variant has its own puzzle ID. Some games can use one board with different assistance modes; where so, retain a common boardId and record mode separately. Never relabel the same ordinary board Expert just because text or timer settings changed. When a mode switch would reveal or erase information, warn and start a distinct attempt; preserve the existing attempt.

## Play and completion

Common chrome: game title, edition, difficulty selector, Rules, Help, text settings, progress and persistent board. Submission feedback must say why an entry failed: unavailable letter, central letter missing, too short, already found, excluded word, or connection not correct. Do not use “Wrong!” for all cases.

Hints are progressive and preview their cost. Choosing a hint records assistance but never blocks completion. Full reveal requires a confirmation and marks revealed items separately. Completion card contains outcome, efficiency, assistance, explanation, Next puzzle and spoiler-free Share. Never show private family names in shared results.

Browser storage saves only public puzzle attempts and user settings. Clear-data UI explains what it removes. Account sync imports local attempts explicitly and handles conflicts by puzzleId + attemptId + revision, not arbitrary last-write overwriting. Keep original action log when resolving duplicates.

## Private birthday experience

Gift mode uses a configured recipient display name and birthday date supplied by the owner. No guesses are embedded in code. Birthday Book is complete at reveal; Family Window can continue afterwards. She should be able to read and listen without posting. One curator owns ongoing contributions. See `birthday/README.md` for inventory and permission rules.

## Non-goals and business model

No ads, payments, public chats, follower counts or algorithmic social feed at launch. No medical claims or brain-training promises. No requirement to install an app. PWA bookmarking can follow reliability checks; private pages and assets must not be cached for offline public access.

## Acceptance criteria

- From home, a new visitor starts any launch game in at most two navigation actions.
- Navigation preserves unfinished attempts and focus remains usable after return.
- Public visitors never see private names, captions or media.
- Four launch games genuinely play to completion; catalogue reflects actual availability.
- Date rollover keeps active play stable and archive URLs deterministic.
- All empty, loading, error, unavailable and completed states have designed copy and recovery.
- Birthday gift remains enjoyable if no new content arrives for four weeks.
