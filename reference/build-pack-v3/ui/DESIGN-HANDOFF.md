> V3 adds actual Hexabble at hexabble.html as a navy/amber hex-board room within this shared theme. See ../upgrades/19-hexabble-integration.md and ../docs/08-hexabble-quality-standard.md. Existing game silhouettes remain; catalogue now19.

# Word Club: the curious club edition

Build from the supplied HTML, CSS and JavaScript references. The design should feel colourful, thoughtful and enjoyable for an adult who already loves difficult word puzzles. Keep the same club identity across the site while making every board recognisable at a glance.

## How these files help Claude Code

- **HTML:** independently addressable routes, document structure, landmarks, control labels and stylesheet/script imports. Open `index.html` locally with its sibling files intact. The rendered page structure comes from `app.js`.
- **styles.css:** shared layout primitives, controls, dialogs, forms and responsive baseline.
- **themes.css:** the complete v2 visual layer, including per-game stages, illustrated poster cards, birthday treatments and mobile refinements. Load it after styles.css.
- **app.js:** theme metadata, screen renderers, decorative board miniatures and sample interactions. This is a prototype, not the production rules engine. The engine briefs and versioned fixtures remain authoritative.
- **Screenshots:** visual checkpoints in `../qa/screens/` and the pack's `UI-preview.png`. Use live HTML to inspect states and small-screen behaviour; do not infer interaction from screenshots alone.

A standalone CSS file makes the design more reproducible than a prose prompt. HTML establishes layout and semantics. JavaScript makes the reference tangible enough to test. All three are included, require no install, and work offline.

## Common theme

Warm paper `#faf8f2`, near-white reading surfaces `#fffefa`, dark ink `#292e3b`, muted text `#5c6271`. Display type is Georgia; interfaces use system sans. Keep the tilted lowercase w mark, navigation pills, generous title hierarchy, restrained borders and clearly labelled actions. No external font or image dependency.

The site's home is a colourful puzzle shelf: an orbital letter cover, four featured launch games with miniature board previews, a family invitation and an expandable catalogue. Cards preview each game's silhouette. Miniatures are decorative and hidden from assistive technology; they must never reveal today's answer in production. Use a separate original illustration fixture rather than the currently active puzzle.

The four launch cards are Letter Wheel, Word Deduction, Word Families and Word Ladder. Give the player a clear first choice while preserving access to the whole catalogue. Do not imply that scores, streaks or saved progress exist until the engine supplies them.

## Every game has a visual signature

| Game / route | Accent / wash | Play space and signature detail |
|---|---|---|
| Letter Wheel / letter-wheel | `#6845a5` / `#eee5ff` | Letter observatory. Round orbit, dashed guide and golden required centre. All nine letters remain equally legible. |
| Letter Set / letter-set | `#31694e` / `#e4efcc` | Word garden. Rounded petal tiles, required centre and a calm word-entry bed. Repetition remains a rule, not an animation effect. |
| Word Deduction / word-deduction | `#315bd1` / `#e7edff` | Code room. Dark blue console, deliberate square guess cells, explicit feedback legend and a pale input surface. |
| Word Families / word-families | `#91435c` / `#f7e4ea` | Connection collection. Tactile word cards; selected cards settle into a darker group. Solved groups get category text. |
| Hidden Word Trail / hidden-word-trail | `#326b54` / `#e3efdd` | Garden path. Circular letter stepping stones on a light dot field; selected path tiles visibly change shape. |
| Letter Circuit / letter-circuit | `#166c79` / `#def2f0` | Circuit studio. Blueprint surface, perimeter letter terminals and an open centre. Letter groups remain explicit. |
| Crossword / crossword | `#4a4c50` / `#eeeae1` | Sunday desk. Editorial rules, black-and-white cells and serif clue list. Reading first, ornament second. |
| Word Ladder / word-ladder | `#a44430` / `#ffe8db` | Stepping stones. Wood-coloured rungs and two light guide rails, with word tiles and the move count. |
| Clue Pairs / clue-pairs | `#674aa0` / `#ece5fa` | Double take. Two arch-shaped definition cards of equal importance, sharing one answer field. |
| Word Weave / word-weave | `#256678` / `#e0f0f3` | Weaving room. Interlocking lanes on a quiet weave pattern, transparent unused spaces and matching clue strips. |
| Cryptic Workshop / cryptic-workshop | `#8a5233` / `#f5e7d4` | Clue workshop. Notebook spine, ruled clue page and an optional wordplay explanation. |
| Shrinking Staircase / shrinking-staircase | `#885036` / `#f9e7d8` | Disappearing staircase. Descending blocks narrow with word length. Actual lengths come from the round. |
| Word Fragments / word-fragments | `#9a4160` / `#fae6ee` | Word collage. Cut-paper fragment tiles with subtle rotations and different pale papers. Keep click and keyboard assembly. |
| Missing Links / missing-links | `#34687b` / `#e4eff5` | Bridge club. Arched anchor panel and a dashed centre join. Both compound phrases remain written underneath. |
| Phrase Repair / phrase-repair | `#8c5638` / `#faebdb` | Phrase press. Movable word tickets on a light editorial line. Adjacent swap buttons remain visible and keyboard reachable. |
| Anagram Relay / anagram-relay | `#4e699b` / `#e8eef8` | Letter relay. Stage chip and growing letter tray anchored by a baseline. Additions are shown explicitly in the engine-driven transition. |
| Definition Detective / definition-detective | `#536341` / `#edf0df` | Word dossier. Folder edge, case sheet and definition/evidence choices. Do not turn the clue into a crime-fiction gimmick. |
| Tile Table / tile-table | `#76563d` / `#f1e7d9` | Shared table. Subtle wood surface, inset board and warm letter rack. Bonus squares also need text labels. |

Aliases `daily-crossword.html` and `shared-word-board.html` render the same corresponding themes.

## Birthday space

Shared font and navigation, warmer rose-brown accent `#914e40` and paper tint `#f6e7de`. The hub is a personal invitation, Family Window is a simple private album feed, and Birthday Book is a two-page keepsake with a spine. Photo frames resemble album prints. Placeholder illustrations are labelled; replace them with real, consented family media.

Desktop book has two facing pages; mobile stacks photo and message. Favourite, reply, page-turn and upload actions stay in familiar button positions. Production private pages must be protected by real authentication and request-level permissions specified in the birthday briefs. A private-looking badge is presentation only.

## Build sequence

1. Read the root START-CLAUDE-CODE.md and the core game briefs. Open home, the four launch screens and the family hub.
2. Extract global tokens and GameTheme metadata. Preserve accent/wash tokens in one map rather than duplicating arbitrary colours across components.
3. Implement AppHeader, responsive navigation, PuzzleShelfCard, GameShell, WordEntry, HintDialog and LiveStatus.
4. Build mechanic-specific boards. Do not force every board into one interchangeable tile component. Use variants for orbital letters, group cards, guess cells, crossword cells and paper fragments.
5. Bind boards to pure engines. Theme strings, selected CSS classes and DOM text must never determine correctness or score.
6. Move illustration arrays into decorative illustration fixtures; move practice puzzle arrays into validated round data. The reference JavaScript is disposable after this migration.
7. Implement authentic loading, invalid input, empty progress, assistance, completion, resumed round and network-failure states. Preserve invalid input for correction.
8. Verify desktop, mobile, enlarged text and keyboard use. Keep original content/release gates from the main pack.

## Interaction and accessibility

No compulsory timer. Gentle, Standard and Expert each load a separately authored/calibrated round in production; the reference selector only explains that limitation. Letter shapes and colours do not alter rules. Status updates are polite live announcements. Retain accessible labels and text descriptions for deduction feedback. Form labels must remain present, even when visually hidden.

Standard controls and letter buttons use at least 44px hit targets. Dense crossword/tile-board cells additionally require accessible zoom and keyboard movement in production. Long terms must wrap rather than be truncated. Decorative thumbnail labels may be smaller because they convey no essential game state. Test mobile word-card terms with the longest real dictionary/category items, not only sample words.

Do not rely on drag. Wheel accepts typing; path selection has a keyboard equivalent; fragments can be selected; phrase swaps have explicit controls. Production grids need roving focus, coordinate announcements and zoom for large boards. At 200%/400% browser zoom, reflow the shell and expose navigation. A+ is a supplemental preference, not a substitute for zoom.

Motion is optional and honours prefers-reduced-motion. Suggested production transitions: selected group settles together, correct guesses flip only after submission, ladder rung appears, trail connection draws, fragment locks into place. Keep these under about 200ms, without flashing or making the next action wait. The supplied prototype uses only short colour/border/shadow transitions.

## What is actually checked

The supplied browser script checks 25 pages at 1280px and 390px, no page overflow, no JavaScript errors, six complete sample interactions and hint dialog focus recovery. The v2 pass additionally checks all pages at 320px/390px with A+ text, visible deduction symbols and a separated Ladder destination. These are prototype checks. They do not establish a working production database, public content bank, full accessibility compliance or testing with Mum. Retain the main pack's release checklist.
