# Word Club UI reference pack

Open `index.html` in a browser, or serve this directory with a static web server. No build, dependency, account, external font, image request or network connection is required. Each `.html` page is an independently addressable screen using the shared `styles.css`, `themes.css` and `app.js` renderer.

**This is a design and interaction reference, not a production game collection or a secure family service.** Samples are deliberately small. Nothing is uploaded or published. The production implementation must use the main brief, game engines and reviewed content, rather than treating the sample word arrays as release dictionaries.

## Version 3: working Hexabble added

Open hexabble.html for the actual local match, with engine.js, app.js, words.js, club.css and club.js under hexabble/. Its own route has a phone-readable board, local saved draft, keyboard placement and focus-managed dialogs. Read ../games/hexabble.md and ../upgrades/19-hexabble-integration.md. Other game routes remain interactive prototypes; their complete-engine upgrades are specifications, not completed implementations. The catalogue has nineteen games.

## Version 2

The revised design uses an illustrated puzzle shelf, a playful magazine-style home cover, 18 game-specific board treatments and a family scrapbook. `themes.css` is the new visual layer; `styles.css` retains shared structural primitives. Start with `DESIGN-HANDOFF.md` for the complete theme map and migration instructions. All game rules and fixtures are unchanged.

## Screen mapping

| Screen | Page | Distinct board / interaction |
|---|---|---|
| Home | index.html | Four featured games, family invitation and expandable 18-game catalogue |
| Letter Wheel | letter-wheel.html | Nine-letter radial layout; required central A; letter inventory check; sample word acceptance |
| Letter Set | letter-set.html | Seven-letter petal cluster; repeated letters allowed; required A; sample pangram |
| Word Deduction | word-deduction.html | Five-column guess board; repeated-letter feedback accounting; text-equivalent states |
| Word Families | word-families.html | Sixteen word cards; four-card selection; authored group checks; disabled solved cards |
| Hidden Word Trail | hidden-word-trail.html | Four-by-four garden grid; tap or keyboard selection; adjacency and sample-word checks |
| Letter Circuit | letter-circuit.html | Four-sided perimeter; alternating-side and word-chain checks |
| Crossword | crossword.html | Complete four-by-four word-square fixture and across/down clues |
| Word Ladder | word-ladder.html | Growing vertical ladder; exactly one changed letter; small dictionary; target and move count |
| Clue Pairs | clue-pairs.html | Paired definitions; three authored answer transitions |
| Word Weave | word-weave.html | Complete three-lane CRANE/BARK/KITE board with crossing checks |
| Cryptic Workshop | cryptic-workshop.html | Hidden-word sample and optional wordplay explanation |
| Shrinking Staircase | shrinking-staircase.html | Four shrinking rows; STEAM→MEAT→MAT→AT; rearrangement permitted completion |
| Word Fragments | word-fragments.html | Clickable orthographic chunks; clued assembly |
| Missing Links | missing-links.html | Two phrase anchors and shared missing link |
| Phrase Repair | phrase-repair.html | Clued word-token sequence with adjacent swap buttons and minimum move score |
| Anagram Relay | anagram-relay.html | Add-one-letter rearrangement through STARE→ASTERN→PARENTS→PARTNERS |
| Definition Detective | definition-detective.html | Three cases with definition and supporting-context choices |
| Tile Table | tile-table.html | Seven-by-seven sample board, bonus squares and seven-tile rack; planning only |
| Birthday hub | birthday-hub.html | Original SVG image placeholder and three gift routes |
| Family Window | family-feed.html | Two sample posts; local favourite toggle; reply/access reference dialogues |
| Birthday book | birthday-book.html | Responsive photo/message spread; three placeholder message pages |
| Add a moment | family-upload.html | Image-type/size checks; local image preview; caption/name/consent; preview dialogue |
| Hexabble | hexabble.html | Actual local 2–4 player match; hex geometry, live scoring, turns, history, results, draft save/resume |

Canonical aliases: `daily-crossword.html` and `shared-word-board.html` match the corresponding game specification names.

## Shared design

- Warm paper and dark ink form the common theme. Every game has a distinctive accent, board surface and mechanic-shaped visual identity; see DESIGN-HANDOFF.md.
- System fonts for interface text; Georgia headings. No third-party fonts or imagery.
- Desktop sidebar with all reference screens. Mobile focuses on the puzzle; catalogue remains available from Home.
- No timer. Difficulty selector shows Gentle / Standard / Expert and clearly states that the reference does not swap content.
- A+ increases base interface type from 17px to 20px. In production, persist preference and separately test browser zoom at 200% and 400%.
- Primary game buttons support tap and keyboard activation. Text entry works without tapping letters. Trail uses tap/keyboard square selection rather than requiring dragging.
- Labelled controls, skip link, live status messages, visible focus and textual alternatives for deduction colour states.
- Hint/rules dialogue supports Escape, focus containment and restoring focus. Real hint sequences must preview exactly what will be revealed and separate clues from solutions; this reference shows one known sample hint.
- Reduced-motion preference respected. Reference contains no animation beyond short colour transitions.

## State handoff

Implement these as explicit production states: content loading; ready; in progress; invalid entry with reason; duplicate word; optional hint request; hint displayed; completion; paused/resumed; offline; recoverable service failure; archive entry. Preserve progress through navigation and reload. Clear/reset must request confirmation when it would discard meaningful progress; this demo reset simply reloads the reference.

Family states: invited but not signed in; invitation expired; authenticated reader; contributor; empty feed; upload preview; upload pending; upload failed/retry; published; delete confirmation; revoked access. The family badge is descriptive here and provides no security. Protect routes, APIs and image files in production; never infer privacy from a hidden navigation link.

## Components and implementation handoff

Suggested React components: AppHeader, ScreenSidebar, HomeFeaturedGames, GameCard, DifficultySelect, RulesPanel, HintDialog, LiveStatus, WordEntry, LetterTile, WheelBoard, LetterSetBoard, DeductionBoard, FamilyGroupBoard, TrailBoard, CircuitBoard, CrosswordBoard, LadderBoard, ClueCard, FragmentTray, TileBoard, FamilyPost, BirthdaySpread and LocalUploadPreview.

Separate engine output from board presentation. Engine supplies legal inputs, progress, per-letter feedback, rejected-word reasons and completion. Components must not reconstruct production game rules from visual styles. Keep puzzles/versioned dictionaries distinct from player state. Private family content must never enter public puzzle data or share cards.

Reference limitations: word lists are tiny; circuit does not validate dictionary words or demonstrate a complete minimum-word solution; crossword uses a repeated-answer word-square demo rather than publication-quality content; tile-table has no scoring or opponent; difficulty selector does not change the sample; state is page-local; upload preview uses an object URL and is never stored; family messages and illustrations are placeholders rather than invented personal history.

## Verification

JS syntax checked with `node --check app.js`. HTML references checked against local files. Browser screen rendering and sample interactions are tested separately where available. These checks are not real-user testing, calibrated challenge validation, accessibility certification or public-release approval.

### Browser checks completed

All 23 screens plus two canonical alias pages rendered in headless Chromium at desktop 1280×900 and mobile 390×844, with zero uncaught JavaScript errors and no horizontal page overflow. Browser interactions completed Word Ladder, Clue Pairs, Anagram Relay, Shrinking Staircase, Definition Detective and Word Weave. Desktop Letter Wheel and mobile Home screenshots were visually inspected. Screenshots are `letter-wheel-desktop.png` and `home-mobile.png`. These remain UI smoke checks, not evidence of production readiness.
