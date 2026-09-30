# Hexabble: simulated player review and observed browser checks

**Recommendation:** keep Hexabble as a promising advanced family-table bonus, after the daily solo games. The desktop reference has working local turns and genuine strategic potential. It is not ready to give Mum as a dependable mobile birthday game: at a 390px viewport the board collapses to zero width, and reloading loses the game. Fix those issues before considering a release candidate.

This is a simulated assessment for an experienced word-game enthusiast, informed by source inspection and actual browser interactions. Mum has not tried it. No conclusion about her vision, dexterity or cognitive ability is inferred from age.

## Observed facts

Test environment: local original files in `hexabble-reference`, headless Chromium executable `/tmp/wordclub-chromium`, desktop 1440×960 and mobile 390×844. No reference files were edited. Browser page-error listener recorded no uncaught JavaScript errors during the initial session. Random racks mean scores and test words are examples rather than stable regression fixtures. Raw measurements are in `hexabble-player/observations.json`.

| Check | Observed result | Player implication |
|---|---|---|
| Setup | Two, three or four players; named players; Official/Friendly toggle; hide-rack option | Clear local family-game intent. No solo or remote option is offered |
| Start | Named “Mum’s turn” handover appeared; Enter revealed the rack | Pass-the-screen flow works and is discoverable through the visible button |
| Board | 217 SVG cells rendered on desktop | A substantial strategic board, rather than a cosmetic hex-grid variation |
| Click placement | Clicking a rack letter and then a cell placed tiles; Escape recalled pending placements | Dragging is not compulsory for pointer users |
| Friendly invalid word | SA displayed an invalid-word explanation; Place tiles was disabled; same player remained on move 1 | Supports experimentation without losing a turn |
| Friendly valid word | AA was accepted, scored 4, recorded in history and handed over to Player 2 | Actual scoring and turn advancement worked in the observed move |
| Official invalid word | AP produced “Challenge! Word not allowed”; after OK, Player 2 received move 2 and the history recorded the lost turn | Penalty and acknowledgement worked. “Official” is the app’s mode name, not evidence of official dictionary/rules certification |
| Pass | Confirmation appeared, then opponent handover | Accidental passing has a confirmation safeguard |
| Repeated passes | Four consecutive passes in a two-player game ended play | Documented end condition worked in this narrow scenario |
| End game | Confirmation appeared, then final table with unplayed-tile deductions | End-of-game explanation is concrete; ending an empty board can still name a winner based on different rack deductions |
| Refresh | Returned to setup; names were blank | No observed save/resume protection. Source keeps game/setup state in memory rather than browser storage |
| Desktop layout | Board, rack, scoreboard and move history visible at 1440×960 | Strong reference for a shared large-screen session |
| Mobile layout | At 390×844: page width 546px, SVG board width 0px, rack/right panel x=246px and width 300px, body overflow hidden | **Release blocker.** Screenshot shows no playable board; some interface lies beyond the viewport |

## Keyboard and dialogue friction

Confirmed through browser observation and matching source inspection:

- Rack tiles are non-focusable `div` elements. There were zero rack button/tabindex targets. SVG board cells likewise lack a keyboard-selection interface. Enter/ Escape shortcuts do not provide full keyboard play.
- Rules opened from setup did not close with Escape. The document key handler exits while the game is inactive. The rules close button remained usable.
- Rules and confirmation overlays have no dialog role or `aria-modal`. Opening setup Rules left focus on the underlying Rules button; opening Pass left focus on the underlying Pass button. No focus movement, containment or restoration routine was found in the overlay functions.
- Enter revealed the handover, and Escape closed an in-game confirmation/dialogue. Escape also recalled pending tiles when no overlay was active.
- Names use placeholders rather than explicit per-input labels. Broad field captions do not replace individual accessible names.

Required improvement: keyboard-selectable rack and board navigation, labelled coordinates, focus-managed dialogues, handover focus, setup/game-consistent Escape behaviour, and progress preservation. Test these with keyboard and a screen reader; current observations are not an accessibility audit.

## Imagined player journey

**First session:** the clear number-of-players and Friendly choice are helpful. She would need another willing player and a sufficiently large screen. Familiar word-tile play offers an entry point, but three directions, ignored two-letter touches, Keys, Pivots and additive word multipliers introduce several rules at once. Start with a short guided practice move; keep special tiles and the full rule explanation available when needed.

**While thinking:** the live preview and clear scoring are strengths. Friendly mode lets her explore alternative placements. It should be the initial recommended mode, without describing it as a lower intellectual difficulty. Official mode changes the penalty policy, not the strategic complexity.

**After being interrupted:** refresh currently destroys the session. Family conversations and interruptions are normal, so local save/resume matters particularly for this format. Show an explicit saved-session action and distinguish it from Start new game.

**Returning tomorrow:** this is strongest when a family member is available to play. The supplied build has neither a solo opponent nor asynchronous invitations, so it complements rather than replaces her daily solo word-game ritual.

## Provisional preference scores

Scores are heuristic /5, not observed satisfaction or measured usability results. Higher friction score means easier use.

| Criterion | Score | Reason |
|---|---:|---|
| Fit with love of word games | 4 | Word building and thoughtful positioning are a plausible fit; tile-board preference is not yet confirmed |
| Interesting strategic challenge | 5 | Three directions, crosswords, premiums and special tiles create substantial decisions |
| Initial rule clarity | 3 | Useful explanations, but several unfamiliar rule systems need phased introduction |
| Desktop interface ease | 3 | Board and live feedback work; keyboard/dialogue and saving gaps remain |
| Mobile interface ease | 1 | Board collapses at tested phone width |
| Likely return value | 3 | Depends on a partner and session duration; solo daily play is not supplied |
| Birthday warmth / family connection | 4 | Named shared turns can make it a family activity; personal gift presentation still needed |

## Candidate priority

1. Launch the familiar daily solo games and reliable private family content first.
2. Retain Hexabble as the leading advanced shared-board candidate, pending mobile layout, save/resume and keyboard/dialogue repairs.
3. Ask Mum to try a genuine 15–20 minute Friendly desktop session with a relative. Observe whether she enjoys board strategy, how often she consults rules, and whether she wants another game. Those questions remain untested.
4. Keep bots, online multiplayer and asynchronous invitations out of the first birthday release unless explicitly prioritised; they are not present in this reference.

This review does not establish exhaustive engine correctness, special-tile fairness, dictionary quality or permission to reuse its board/rules. The README refers to engine and simulation tests missing from the supplied folder, so those advertised tests were not run.

## Captured evidence

Screenshots under `qa/hexabble-player/`: `setup-desktop.png`, `handover-desktop.png`, `game-desktop.png`, `endgame-desktop.png`, `setup-mobile.png`, `game-mobile.png`, `rules-mobile.png`. Desktop and mobile game screenshots were visually inspected. `observations.json` contains measured outcomes from both browser sessions.
