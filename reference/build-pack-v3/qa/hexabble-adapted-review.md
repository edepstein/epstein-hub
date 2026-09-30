# Adapted Hexabble: player-oriented browser review

Review is based on observed browser interactions in the adapted `ui/hexabble.html`, not a real test with Mum. Scope: interface, phone layout, keyboard and interruption recovery. Engine correctness is assessed separately.

## Confirmed improvements

- Friendly is selected by default.
- Setup Rules now opens a `role=dialog` card, moves focus into it, keeps Tab within it, closes with Escape and restores focus to the Rules button.
- Handover moves focus to Show my tiles.
- All seven rack tiles are keyboard-focusable buttons by role. Enter on a rack tile selects it and focuses the centre cell; ArrowDown moves to coordinate 0,1; Enter places the tile as an unsubmitted draft. The turn remained Mum’s move 1, so selecting/placing did not accidentally submit.
- Save indicator reported Saved on this device. Reload exposed Resume saved game. Resuming restored the player names Mum/Ed, Friendly mode, move 1 and the exact draft tile ID and coordinate.
- In-game Rules moves focus into the dialogue, contains Shift+Tab, closes with Escape and restores Rules-button focus.
- No uncaught JavaScript errors were recorded in the tested browser sequence.

## Phone layout: final rerun after correction

The first run caught a cascade error: `club.css` loaded before the original stylesheet, leaving a 16px board viewport. The parent corrected the order; this review did not edit source. All following measurements come from a fresh rerun of the corrected files.

| Final phone check at 390×844 | Observed result |
|---|---|
| Document width | 390px, matching viewport: no horizontal page overflow |
| Body overflow | auto, so the page can scroll normally |
| Readable board | SVG 796×896px inside a 390×580px board scroll viewport |
| Initial board position | ScrollLeft 203px and ScrollTop 161px, showing the central play area |
| Rack | 300px wide, left 45px and right 345px; fully within phone width |
| Rack reachability | Browser scrolled the rack into view; its complete bounds fit within the visible viewport |
| Fit selection | SVG changed to 390×560px; page remained 390px wide |
| Rules dialogue | 358px wide with 16px side margins; fitted the phone viewport |

The corrected phone game and rack screenshots were visually inspected. The board is visible and readable, the rack and action buttons are reachable through page scrolling, and Fit genuinely differs from Readable. This resolves the original collapsed-board/layout blocker in the tested viewport. It is a browser viewport check, not an actual-finger gesture test on a phone.

## Remaining player trade-offs

- Readable mode intentionally shows only part of the substantial board; the player must pan the board and scroll the page between board and rack. Fit provides overview at the cost of smaller cells. A small visible explanation of these two modes would help a first-time player.
- Device-local save is a substantial improvement, but it is not cross-device sync or a backup guarantee. Clearing browser data or changing browser/device remains outside the observed recovery flow.
- This review checked standard letter keyboard selection, a single draft, dialogue focus and save/resume. Special-tile keyboard flows, assistive-technology announcements, full completed-game restore and long-session usability were not tested here.
- The original player-name fields depended on placeholders. The final adapted source adds explicit per-player accessible labels and pressed-state/group semantics for setup choices; broader assistive-technology testing remains needed.

## Provisional player recommendation

The adapted keyboard, focus and save/resume flows materially improve suitability for a birthday gift and a shared family game. Desktop strategic fit remains strong. Phone layout, draft recovery and the tested keyboard/dialogue flows now pass this narrow review. Public release still depends on separate content/engine checks and broader browser/accessibility verification; a simulated review cannot establish that Mum enjoys the game.

Captured adapted screenshots are under `qa/hexabble-player/`, prefixed `adapted-`: desktop game, mobile setup, mobile game, mobile rack, mobile Rules and mobile Fit mode. Final screenshots replace the initial adapted captures; original reference evidence remains untouched.
