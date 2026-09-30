# Verification and release gates

## Distinguish evidence

The pack's QA checks validate supplied files and selected fixture mechanics. UI reference interactions are demonstrations. They do not certify the app Claude Code will build. Production readiness requires engine, integration, browser, privacy, editorial and observed-player evidence. Report exact commands and outcomes; never write “all tests pass” when only syntax was checked.

## Engine test matrix

| Game | Required cases |
|---|---|
| Wheel | required centre absent; duplicated rack letters; too short; unknown word; duplicate submit; score once; nine-letter bonus; restore |
| Set | repeated letters allowed; foreign letter rejected; required letter; all-letter bonus; repeat submission |
| Deduction | exact duplicate-letter counts; invalid word costs no guess; legal wrong guess does; expert constraint reuse; win/loss/reveal |
| Families | exact-size selection; valid set; mixed set; duplicate wrong submission; solved term unavailable; competing grouping review |
| Trail | diagonal adjacency; jump rejected; reuse rejected; alternate path; overlap; full coverage; cancelled input |
| Circuit | consecutive same-group rejection; last-first continuity; reused letters; coverage mask; undo; proved par |
| Crossword | crossing consistency; clue enumeration; input direction; reveal records; pasted answer; all cells complete |
| Shared board | legal first move; connected subsequent move; every crossing word; blank value; exchange; pass end; atomic turn; reconnect |
| Ladder | one substitution only; same length; membership; repeated step; any legal route; BFS minimum; undo |
| Pairs | both definitions; enumeration; accepted alternate; case; hint and reveal separation |
| Cryptics | exact construction; definition; indicator; enumeration; progressive hints; solve explanation |
| Fragments | chunk identity and single use; allocation across all answers; repeated-looking chunks; undo; unique solution where claimed |
| Links | prepend/append orientation; every expression; alternate links; enumeration; missing spaces policy |
| Detective | each clue stage; distractors; contextual usage; revealed vs independently solved |
| Weave | word placement coordinates; intersections; all clue sets; legal alternate where listed; focus navigation |
| Staircase | exactly one removed letter; rearrangement; repeated letters; fixed target; alternate chains |
| Relay | previous multiset plus one added letter; backward work; one wrong rung; whole-chain completion |
| Repair | token identity; duplicate words; one-swap semantics; alternate endpoint; minimum swaps; undo |

Property-based tests are useful for repeated-letter feedback and exact multiset rules. Do not write tests that merely reproduce static UI strings. Include regression tests for concrete defects discovered during the previous review: DRAFT/DRAUGHT clue mismatch, tutorial grouping being mistaken for Expert and duplicate-L feedback in APPLE/ALLEY.

## Shared/browser flows

At desktop 1440x1000 and mobile 390x844, test home → game → legal/illegal submit → hint → refresh → resume → completion → archive. Also test date rollover, a blocked network fetch, corrupted local data, unsupported puzzle version, empty archive and large text. Browser assertions verify meaningful state changes, not just that buttons exist.

Keyboard-only: navigate entire play UI, open/close rules and hints, submit, correct, undo and finish. Check visible focus and focus restoration. Screen-reader smoke: game name, required letter, feedback, group selection, selected path and completion are comprehensible. Automated accessibility checks complement human checks; they do not replace them.

## Private-space test matrix

Create accounts for family A viewer/contributor/curator and unrelated family B, plus anonymous access. Test rows, API endpoints, direct media object paths, export, comments, invite acceptance and membership changes. Public visitors and family B must be unable to retrieve A's content. Viewers cannot upload, contributors cannot invite or elevate roles, curators cannot edit unrelated families. Test expired/reused invites, replaced devices, pending consent and deleted assets. Confirm private material is absent from SSR public HTML, OG images, public search indexes, service-worker cache and analytics events.

Signed media URLs are bearer credentials until expiry. Test the documented exposure window; do not claim instant revocation unless an authenticated proxy or other actual design enforces it. Deleting a thumbnail must also remove other derived media. An export cannot guarantee deletion of downloads held by relatives.

## Editorial and player pilot

Each published puzzle has rule validation, independent solve, staged hint review and explicit editorial approval. For categories/cryptic/dual-definition games, two independent semantic reviews are required. Keep a minimum 28-day inventory for four daily games, plus reserve.

Pilot tasks: choose a puzzle; change difficulty; explain a rejected entry; use a nudge; resume after refresh; find birthday content; reply without uploading. Observe without coaching. Initial acceptance targets: 80% start and make a valid move unaided; median enjoyment >=4/5; no unresolved fairness defect; majority express willingness to return. Record sample size and limitations. A small friendly-family pilot cannot establish public-market appeal.

## Release checklist

- [ ] Four launch engines, route flows and local save work.
- [ ] Production dictionary candidate layer is reviewed into approved membership.
- [ ] Notice/provenance present for shipped data and assets.
- [ ] At least 112 human-approved editions plus any separate mode boards.
- [ ] Known semantic disputes resolved and invalid rounds blocked.
- [ ] Mobile, keyboard, screen-reader and large-text checks pass.
- [ ] Auth, invitations, recovery, RLS and private media tests pass.
- [ ] Real family content approved, birthday name/date configured, curator confirmed.
- [ ] Network failures, corrupt saves and date rollover recover safely.
- [ ] Backups/restores, correction process and support contact documented.
- [ ] Production build, dependency/security checks and secret scanning pass.
- [ ] Observed user pilot recorded with actual outcomes.
- [ ] Owner authorises production deployment and publicity.

## Completion report

Report each gate as passed, failed or not run with evidence. The reference pack has not passed the production checklist. Do not conceal outstanding inventory or personal content requirements behind a visually polished demo.
