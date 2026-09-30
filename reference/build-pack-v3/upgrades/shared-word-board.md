# Shared Word Board: complete match and strategy upgrade

## Before → after

The current content contains one deterministic three-turn nine-by-nine fixture with uniform letter values, no premiums and no blanks. It checks CAT, CATS and CART scoring, racks and draws. It is not a balanced public tile game, and the original asynchronous brief is substantially more demanding than a local demo. Keep that exact fixture; implement its simple rules first, then introduce independently designed strategic rules only after testing. Hexabble demonstrates real strategic depth, but its hex geometry, special tiles and exceptions should not be imported wholesale.

## Complete match state

Implement invitation → waiting → active player draft → authoritative validation → committed move → next turn → terminal result. Validate owned tile identities, single row/column, gaps, occupied cells, connectivity, anchor, all resulting words and exact score. Commit board/rack/bag/history/version atomically, refill and hand over. Passing, exchange, resignation, bag-empty finishing and six consecutive pass/exchange turns all need working outcomes. Apply disclosed rack deductions and going-out transfer exactly. Results show final adjustment, winner/tie, history and rematch.

Server requests include match version and idempotency key. Reject stale turns and repeated tile identities. A replayed request returns the original result without consuming tiles or awarding points twice. Hide opponent racks and bag order. Reconnect restores authoritative state and keeps a compatible local draft; offline drafts remain pending. A local pass-and-play edition may launch earlier with hidden-rack handover and no claim of network security.

## Depth, difficulty and lexicon

Before adding complexity, establish independently chosen tile distribution and frequency/value balance, viable opening play and typical game length. The current uniform-value fixture cannot alone prove strategically interesting scoring. Test whether positional opportunity, rack management, extensions and crosswords create meaningful choices. Optional premium squares or special tiles require an explicit rule decision, new version and score fixtures; never change the baseline silently.

Gentle is practice with move explanations and an honest beginner bot; Standard is invited-human play; Expert is a stronger bounded-search opponent or rated opt-in. Friendly live checking versus penalised dictionary mistakes is a validation preference, not a complete difficulty model. A bot may use only its rack, board and public remaining-tile information, never bag order or opponent rack.

Pin a shared approved membership dictionary before a match. Use a broader gameplay lexicon than the finite demo, with clear UK/US, abbreviations and proper-name rules. Rare playable words can exist in an explicitly disclosed tile-game lexicon, but definitions and word lookup should explain them. Membership is not an editorial answer bank.

## States and acceptance

Design board/rack, selected tile, draft score/formed words, invalid placement, recall, exchange, pass, opponent waiting, stale version, pending/offline, reconnect, resigned/finished, result, replay history and rematch. Provide tap and keyboard alternatives to dragging; each repeated tile has an id. Notifications are optional. Open chat/matchmaking stays disabled until moderation and privacy requirements pass.

Acceptance reproduces the three-turn scores3/4/4 and rack/bag sequences. Reject one physical tile submitted twice and wildcard faces longer than one permitted letter. Test invalid crosses, gap placement, reusing committed premiums if introduced, concurrent requests, idempotency, every terminal condition, rack deductions, hidden data and full reconnect. At least one complete seeded match must reach a correct terminal result; a three-turn demo is insufficient release evidence.

Preserve [the original game brief](../games/shared-word-board.md) and [its original fixtures](../content/shared-word-board.json). Implement alongside the shared architecture, dictionary, design and release documents in `../docs/`. Record any rules change rather than silently merging contradictory versions.
