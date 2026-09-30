# V3 update: Hexabble and complete-game quality

The collection now has nineteen game briefs. Hexabble is included as a working local two-to-four-player game at `ui/hexabble.html`, with a shared-site entry, phone board controls, draft save/resume and keyboard/dialog improvements. Its original six files are preserved in `vendor/hexabble-original`.

The other eighteen game references remain prototype UI samples. Their new `upgrades/<game>.md` files define the exact work to achieve complete functional parity: proper engines, distinct difficulty rounds, dictionary/answer policies, full hints/results/replay and recovery. This pack does not claim that those production upgrades are already implemented.

Start with START-CLAUDE-CODE.md, then docs/08 and docs/09. Those are the current build instructions; the retained earlier briefs and v2 visual system remain useful. `upgrades/BENCHMARK-ENGINE-REVIEW.md` and `qa/hexabble-*review.md` distinguish source findings from tested adaptations.

Open `ui/index.html` locally with all sibling files present. All nineteen entries are discoverable. Readable board mode shows larger Hexabble cells in a scrolling viewport; Fit offers an overview. Saves stay in this browser/device. The original dictionary merge has unverified exact provenance and is isolated to the reference game.

# Daily Word Club: Claude Code build pack

Prepared 30 September 2026. This is a build specification, original demonstration content and responsive UI reference pack. It is not a deployed production application. All 18 games are specified; implement the four launch games first unless the owner explicitly changes that decision.

## Start here

1. Open `ui/index.html` in a browser to inspect the visual direction. The references work offline; they demonstrate interfaces and selected interactions, not complete production engines.
2. Give Claude Code this entire extracted directory, not just a screenshot or individual brief.
3. Ask Claude Code to read `CLAUDE.md`, `AGENTS.md`, `docs/01-product-and-site.md`, `docs/06-build-batches.md` and the launch game briefs before editing.
4. Use the starter prompt in `START-CLAUDE-CODE.md`. Each work batch must finish with verification and a completion report.
5. Sample data lives in `content/`. Review each game's explicit schema before importing it. Convert to the common envelope in the architecture document, preserving the complete game-specific payload.
6. Read `dictionaries/README.md`. The bundled GB word list is a candidate spellings list, not an editorially approved puzzle-answer bank. Demo round vocabularies are deliberately restricted and must not silently become production dictionaries.

## Files

| Directory / file | Purpose |
|---|---|
| `games/*.md` | Full implementation instructions for each of 18 games |
| `content/*.json` | Original complete example rounds / fixtures and birthday placeholders |
| `birthday/*.md` | Private family-space features, schemas, content collection and permissions |
| `ui/index.html`, `ui/*.html` | Home, every game and birthday UI reference screens |
| `ui/styles.css`, `ui/themes.css`, `ui/app.js` | Reusable visual tokens, reference components and demo interactions |
| `docs/01-product-and-site.md` | Whole-site product brief, sitemap and journeys |
| `docs/02-design-system.md` | Exact UI direction, responsive behaviour and state requirements |
| `docs/03-architecture-data-api.md` | Implementation structure, game engine contract, database and API boundaries |
| `docs/04-dictionaries-and-content.md` | Dictionaries, original puzzle authoring, validation and publishing |
| `docs/05-testing-and-release.md` | Test matrix and release gates |
| `docs/06-build-batches.md` | Traceable build sequence, commands and acceptance criteria |
| `docs/07-decisions-and-open-inputs.md` | Final rules, schema alias mapping and missing personal inputs |
| `qa/` | Checks performed on the supplied pack; these do not certify a future app |
| `scripts/` | Reproducible dictionary / pack / fixture checks |

## Scope decisions preserved

Launch: Letter Wheel, Word Deduction, Word Families and Word Ladder. Clue Pairs is the first bonus candidate. Later: Letter Set, crossword, the other alternatives, Trail and Circuit. Shared Word Board is last because server-side turns and reliability are a larger undertaking.

The birthday gift combines a finished Birthday Book with a receiving-first private Family Window. Optional features are fully briefed but remain disabled until selected. The home page may link to the private space; it must never leak private family content to public visitors.

No real family images, names, birthday date or recipient details were supplied. Birthday placeholders are intentionally marked and must be replaced with approved material. Do not infer an age or date from placeholders.

## Definition of done

The built app follows the visual references, all rules are deterministic, published content passes automated checks and human editorial review, private access is tested, a real user pilot has happened, and the documented release gates pass. Running the included pack validator does not imply these production gates have passed.

## Before implementation

Confirm only genuine dependencies: birthday name/date, primary device, hosting/auth credentials and approved family assets. Progress independently on public games and visual work while those are pending. Do not ask the owner to choose routine implementation details already specified.
