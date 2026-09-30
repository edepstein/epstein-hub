# Design system and UI implementation contract

## Reference and intent

Use `../ui/index.html` and the individual game HTML files as code-readable visual references. They establish board geometry and hierarchy; production engines and security are specified elsewhere. Do not preserve demo-only controls or claims that a fake birthday sign-in is authentication. Inspect each reference before implementing its screen.

Visual direction: a curious, colourful puzzle club. Warm paper, dark ink, bold serif display typography and approachable rounded controls provide a common identity. Each game gets its own mechanic-shaped play space: orbital letters, code console, stepping stones, clue notebook, word collage and more. The family area uses album frames and warm keepsake details. Fun comes from recognisable puzzle shapes and satisfying interaction, not forced celebration. The complete theme map is in `ui/DESIGN-HANDOFF.md`; inspect `ui/themes.css` alongside the baseline stylesheet.

## Tokens

Mirror CSS custom properties in the production token system. The actual reference values are authoritative over the old v1 palette.

| Token | Value / rule |
|---|---|
| `--paper` | `#faf8f2`, warm paper |
| `--card` | `#fffefa`, reading surface |
| `--ink` | `#292e3b`, dark ink |
| `--muted` | `#5c6271`, supporting copy |
| `--line` | `#dededb`, baseline border |
| `--accent` | Per-game dark accent; see theme map |
| `--wash` | Per-game light stage tint; see theme map |
| Success | Engine status + explicit text; deduction uses green plus text equivalent |
| Present elsewhere | Ochre + explicit per-letter description |
| Error | Explanatory text, never colour alone |
| Radius | 12px tiles, 22–28px stages, pill actions; deliberate game-specific exceptions |
| Space | 4, 8, 12, 16, 24, 32, 48, 64px |
| Max width | 1400px shell; approximately 650px primary play area |

Test actual contrast for each final pairing. Colour values do not waive contrast requirements. Focus outline is visible on every surface, at least 2px with offset. Use reduced motion and user font scaling, not global forced animation.

Typography: system serif for display titles, system sans for body and controls, tabular numerals for metrics. Offline references intentionally use no remote fonts. Production may use bundled licensed fonts with a documented source; do not require a network font for readability. Body begins around 18px, line height 1.5; controls 16–18px; puzzle letters 24–32px. A/A+ controls modify text through rem variables with 100%, 115%, 130% and 150% settings. Boards reflow rather than clipping.

## Shared components

`SiteHeader`, `MobileNavigation`, `GameCard`, `GameShell`, `DifficultySelector`, `RulesDialog`, `HintDialog`, `AttemptFeedback`, `WordEntry`, `OnscreenKeyboard`, `LetterTile`, `ProgressSummary`, `ResultPanel`, `ArchiveFilter`, `EmptyState`, `ErrorState`, `SaveIndicator`, `AudioPlayer`, `FamilyPost`, `AlbumCard` and `ContributorForm`.

Each component has loading, empty, disabled and error states when relevant. Disabled buttons explain prerequisites nearby. A skeleton preserves expected layout and is not announced as repeated content. Feedback uses an aria-live polite region; errors that need intervention use a focused summary. Avoid announcing every keystroke.

## Responsive layout

Desktop 1024px+: primary board and secondary rules/progress sidebar. Tablet 640–1023px: compact navigation and board above supporting panels. Mobile below 640px: one-column layout, persistent primary action only where it does not obscure input, rules/hints in dialogs, complete board within viewport when practical. Minimum target sizes 44px, preferably 48px. Never solve a board overflow by shrinking letters below readable sizes.

Word Families needs multi-line tiles and flexible height; do not truncate category terms. Crossword and Word Weave use a scrollable board with accessible zoom if the grid cannot fit. Wheel keeps a central required tile and visible repetition counts. Trail uses roving keyboard focus and a selected-path text equivalent. Circuit represents groups without requiring fine pointer strokes. Phrase Repair and Fragments need selectable-source/destination alternatives to dragging.

## Screen/state inventory

Every game needs: initial, entry selected, valid submission, invalid submission, duplicate, hint available, hint preview, assisted, resumed, completed and revealed. Games with losses additionally need failed daily attempt + Continue in practice. Hidden paths need cancelled path; multiplayer needs waiting for opponent, invalid version, reconnecting and resigned.

Home needs public and member variants. Birthday pages need public sign-in gate, authenticated viewer, contributor, curator, no content, expired media and permission removed. Public view never reserves a private image placeholder that leaks its title or caption.

## Interaction details

- Dialogs trap focus, close on Escape, restore opener focus and have headings.
- Submission retains an invalid entry so it can be corrected; do not erase it automatically.
- Keyboard Enter submits, Escape cancels selection/dialog, Backspace edits text, arrow keys move board focus where relevant. Never capture normal browser shortcuts globally.
- Tap selects a letter/token; tap again can deselect only where rules permit. Use an explicit Submit action instead of fragile double-tapping.
- Undo changes legal game state and clears only feedback associated with the undone action.
- Hints say what will be revealed before commitment. Assisted outcomes are dignified, not visually inferior.
- Dates, timers and scores are text, not image-only decorations.

## Reference-to-React handoff

Extract tokens and shared layout first, then board components. Move reference sample arrays into proper fixture imports. All input and selection state must be engine-driven; React cannot determine whether a word is valid through display strings. Do not translate raw HTML with inline listeners into React verbatim. Use semantic elements and shadcn primitives for complex focus-managed controls.

## Acceptance

At 390px and 1440px widths, all launch routes show correct hierarchy with no body overflow. At 200% zoom, controls remain reachable. A keyboard-only user finishes at least one round of every launch game. Reduced motion, colour-independent feedback, text scaling, hint dialog focus and refresh behaviour pass browser checks. Family upload has explicit progress, success and failure feedback.
