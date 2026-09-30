# V3 validation update

Current delivered scope: nineteen game briefs, 46 demonstration round/turn fixtures, 26 HTML routes, preserved v2 prototypes, and the adapted actual Hexabble local game. This is a reference/build pack, not evidence that all nineteen production engines exist.

| Current check | Outcome |
|---|---|
| validate-pack.py |19 mapped games, 46 fixtures, 81,901 candidate words, 26 HTML routes; zero errors |
| Familiar and alternative fixture scripts | All 43 retained fixtures pass their stated checks |
| Negative-case script | All 5 intentionally broken fixtures rejected |
| hexabble-engine.test.cjs |18 checks pass, including 3 opening fixtures, duplicate/malformed input guards, scoring and turn/end flows |
| verify-hexabble-ui.cjs |13 checks pass: Friendly default, dialog semantics/focus, keyboard draft, exact restore, scored CAT, phone Readable/Fit/rack, completed-game restore, corrupt save and unavailable storage; no uncaught errors |
| verify-ui.cjs |100 normal/enlarged-text render checks across the 25 non-Hexabble routes,6 sample completions and focus/symbol/target assertions pass |
| Uploaded source preservation | SHA-256 comparison confirms all 6 original files unchanged in vendor/hexabble-original |

Hexabble browser evidence is in hexabble-ui-verification.json and the two player-review documents. Special-tile accessibility, exhaustive Pivot/Key/adjacency/premium logic, real touch gestures, original dictionary/code/name/board provenance and production content banks still need the stated further work. Scores are simulated design preferences, not Mum's feedback.

The earlier record below is preserved for traceability; its18-game counts describe the older pack.

---

# Pack verification record

Prepared 30 September 2026. Scope: the delivered build/reference pack, not the future application.

## Commands and actual outcomes

| Check | Outcome |
|---|---|
| `python scripts/validate-pack.py` | 18 game briefs/data/UI mappings; 43 complete round or turn fixtures; 81,901 candidate words; 25 HTML pages; no file-integrity errors |
| `python scripts/validate-familiar-fixtures.py` | All 20 familiar-game fixtures pass structural checks, including scoring, paths, circuit minimums, crossword crossings and deterministic tile/rack/bag replay |
| `python scripts/validate-alternative-fixtures.py` | All 23 alternative fixtures pass mechanical checks |
| `python scripts/validate-negative-cases.py` | Five intentionally corrupt examples rejected |
| `node --check ui/app.js` | JavaScript syntax passes |
| `node scripts/verify-ui.cjs` with Playwright/browser installed | 50 desktop/mobile render checks across 25 pages; six complete demo flows; no console or uncaught errors; no page overflow; hint Escape/focus recovery passes |
| Candidate membership cross-check | All acceptedWords/acceptedGuesses entries in the familiar demo data occur in the bundled GB candidate list; this is not editorial approval |

The browser check ran at 1280x900 and 390x844. It solved Ladder, Clue Pairs, Anagram Relay, Shrinking Staircase, Definition Detective and Word Weave. Other screens received rendering checks, not full engine completion tests. `ui-verification.json` records the exact run and assertions. Screenshots were visually inspected for mobile home, desktop wheel and the overall visual direction. Eighteen game board images are included under `screens/`; a contact sheet is `../UI-preview.png`.

Browser reproduction needs `playwright` installed in the executing Node project and its Chromium browser. `WORDCLUB_CHROMIUM` can select an existing compatible executable. The pack has no runtime dependency installation requirement simply to open the HTML references. The verification helper is a developer tool, not app code.

## Dictionary provenance evidence

ESDB was cloned and built at revision `1e5b7d3a72f47a71da5d28686c1dd4b397178485`. Exported size 60, GB B,Z variant level 5, excluding marked abbreviations and special categories. Filtered to originally lowercase ASCII words of 2–24 letters, uppercased, sorted and deduplicated. 81,901 candidates. Count and hash are verified against the included manifest. Full upstream notice accompanies the list. Upstream build completed with unmatched compound-source warnings, documented in the manifest. No claim of exhaustive coverage or complete offensive-term filtering.

## Open release gates

No production app, server/Auth/RLS implementation, account recovery integration, audited private storage, production editor approvals, calibrated difficulty bank or observed recipient testing has been supplied or verified. Birthday names, dates, images and messages remain owner inputs. The 43 examples are demos, not a daily publication archive. Shared-board production candidate distribution is complete but not competitively balanced through playtesting.

See `../docs/05-testing-and-release.md` for the future app's required gates. Keep this distinction in Claude Code completion reports.
