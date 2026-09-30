# Review log: things a human must check

Everything the build made a best-effort or recommended decision on, or could not verify.
Grouped by area; each game appends its own section.

## Shared
- [ ] Dictionary exclusion list (`src/lib/dictionary/exclusions.ts`) is a quick automated first pass. An editor must review the ESDB candidate list for offensive, proper-name, abbreviation and archaic entries per game.
- [ ] ESDB list lacks some common inflections/words players may expect; collect rejected-word reports during pilot.
- [ ] No daily editions exist; content bank sizes are below the docs/08 "10 per difficulty" target for most games (see each game). Home and game pages label rounds "limited preview".
- [ ] Difficulty labels on new rounds are author intentions, not calibrated. Needs observed pilot.
- [ ] Real screen-reader (NVDA/VoiceOver) passes have not been performed; only automated/keyboard checks.
- [ ] Recipient's main device/browser unknown; test on it when known.
- [ ] shadcn/ui not used (see DECISIONS D1); confirm this is acceptable.

## Letter Wheel
- [ ] Practice rounds lw-g1..lw-e5: targets were generated as ESDB membership AND SCOWL size-35 words fitting the rack, minus a small blocklist (ANUS, CRAP, VISAING, TIEING, GENII, FULCRA, EKING, INKIER, TINNIER, POISING, VISING, HIVING, HALING, TREED, RIFTED, PETER, PETERED, ACUTES, ARSE, SORTA, TORSI, APTER, RECTA, OARED, LOPING, POLING, SUBS, TARRY, ARDOUR, DEFTER, REINED). An editor should read every target list for oddities (e.g. CRETIN, RACIST, EROTIC appear only on racks not used; check used racks).
- [ ] Difficulty bands are heuristics: gentle = vowel centre, 20-25 targets; standard = 45-51 targets; expert = consonant centre (F/G/V/P), 20-33 targets. Needs pilot calibration.
- [ ] Only 5 rounds per difficulty (+3 demo at standard); docs/08 asks 10 per advertised difficulty. Pages show "limited preview".
- [ ] Demo rounds are played with full membership (not the finite fixture lexicon) so reasonable words are not rejected; fixture lexicons are kept as regression data (maximumScore reproduced in tests).
- [ ] Hints reveal words from the curated list only; there are no authored definitions yet (brief mentions a definition tier). Recommend adding editor-written short definitions per target.
- [ ] Shuffle uses a client-time seed; the resulting order is stored in the action, so replay is exact.

## Hexabble
- [ ] Publication permission for the Hexabble name, board/premium layout and the supplied source code is unconfirmed; the originating rules PDF is not in the pack. `productionEnabled` stays false.
- [ ] Rules decisions R1–R14 in `docs/hexabble-rules-decisions.md` (rules version `hexabble-rules-1.0`) keep the source engine's behaviour where the pack is silent. A rules owner should confirm in particular: exchanges counting as scoreless turns (R1), Pivot path rules and Pivots counting towards the seven-tile bonus (R4), the centre staying a free start after a Key opening (R6), and the main-word ranking for ambiguous moves (R3).
- [ ] Dictionary: Hexabble uses the ESDB candidate membership (D4). Some familiar tile-game two-letter words (QI, ZA, AA, AE, AI and others) are rejected and a few abbreviations (CF, JR) are accepted. The rules text says so. Needs an editorial word-game membership decision before release.
- [ ] Simulation evidence uses a test-only bot that plays short words; it exercises conservation, exchange, pass, challenge and both end paths, but rarely produces seven-tile bonuses or Pivot plays (those are covered by targeted tests instead).

## Word Deduction
- [ ] 30 practice answers (10 per difficulty) plus 3 demo fixtures (CRANE, PLANT, SHARE at standard). All are in ESDB membership and the SCOWL size-35 familiar layer; an editor should confirm each is a suitable everyday UK answer and check the author-written definitions (gentle: HOUSE LEMON CHAIR WATER MUSIC BREAD TIGER CLOUD SMILE OCEAN; standard: TOWEL APPLE KNIFE FLOOR QUEEN BADGE SWEET CRUMB VOICE GREEN; expert: LIGHT WAFER CATCH HOLLY TASTE BOUND PUPPY GRAZE SHAVE FEVER). This list is itself a spoiler: keep it out of player-facing pages.
- [ ] Difficulty bands are author hypotheses: gentle = very common, mostly distinct letters, first-letter clue offered at the start; standard = everyday words, some doubled letters (APPLE, SWEET, GREEN, QUEEN, FLOOR); expert = words in crowded families (-IGHT, -ATCH, -OUND, -OLLY, -ASTE, -AVE, -AZE) played in hard mode. Needs calibration with players.
- [ ] Decision: rounds are distinct per difficulty (AGENTS rule 5) rather than one daily answer across modes as the brief prefers for dailies. When dailies exist, one edition answer should be shared across assistance modes with separate cohorts.
- [ ] Decision: hints are available in every mode (the brief allows switching to assistance mid-round); in Standard/Expert the hint dialog says the result will be marked assisted. Gentle additionally shows an inline "Show the first letter" offer before the first guess.
- [ ] Decision: after six misses the round is recorded as failed without showing the answer; the player chooses Reveal (with definition) or "Keep guessing" (3 extra rows at a time, counted as assistance, result headline says "after the 6-guess limit"). A later solve never becomes an in-limit unassisted success.
- [ ] Decision: hard mode (Expert) enforces green positions, minimum counts (including duplicates) and yellow-position exclusion; greys are not banned. Hint-revealed letters/places also become constraints. The player may switch hard mode off (recorded, counted as one assist).
- [ ] Decision: repeating an earlier guess is rejected at no cost (brief is silent).
- [ ] Demo rounds are played against full ESDB membership; the fixtures' 11-word guess lists are kept only as regression data (SLATE-restricted test in engine.test.ts).
- [ ] Answers ship in the client bundle (acceptable for unranked private practice per the brief, but not spoiler-resistant against a technical reader). A daily service must serve answers server-side.
- [ ] On-screen keyboard keys are about 30-34px wide on a 390px phone (full height 52px). Typed input remains the primary route; confirm this is acceptable on the recipient's device.
- [ ] Rejections are enforced in the engine only (membership, length, repeats, hard mode). ESDB may reject some familiar plurals/inflections players try; collect reports.

## Shrinking Staircase
- [ ] Practice rounds sc-g1..g5, sc-s1..s5, sc-e1..e5: chains were found by an exact multiset search over ESDB membership and SCOWL size-35, then clues were written by the build agent. An editor must check every clue picks out its rung among the other words the same letters make (e.g. SPOT vs STOP/POTS/TOPS, POT vs TOP/OPT, NOSE vs ONES, TAPE vs PEAT/PATE).
- [ ] Accepted branches (sc-e1 ANGERED/ENRAGED "Made furious", sc-e2 NOTES/TONES "Musical sounds", sc-e3 PAT/TAP "Touch lightly and gently") need review that both answers genuinely fit and that no other same-letter word also fits (e.g. GRENADE is ruled out by the clue).
- [ ] Two-letter endpoints reuse AT, AN, HE, TO across rounds; clue wording differs, but an editor may want more variety.
- [ ] Decision: a rung filled by the "Fill this rung" hint scores 0; the letter-to-remove and first-letter nudges cost nothing but are recorded. Confirm this scoring.
- [ ] Decision: wrong guesses are rejected atomically and are not stored in the action log, so attempt counts are not persisted across a refresh (accepted answers, hints and revisions are). Recording misses would need an accepted "miss" action; revisit if attempt counts are wanted in results.
- [ ] Decision: Standard and Expert hide the letter tiles until "Show letter tiles" is pressed. This is a display preference, not a scored hint, because the same letters are already shown in the word above.
- [ ] "Report an answer issue" after a rejected submission is not implemented (no editorial queue backend yet).
- [ ] Only 5 practice rounds per difficulty (plus 2 gentle demos); docs/08 asks for 10 per advertised difficulty.

## Hidden Word Trail
- [ ] Practice boards hwt-g1..g5, hwt-s1..s5, hwt-e1..e4 were placed by an offline randomised generator and proved by exact-cover search: the listed theme words tile every square, and every board has exactly one complete partition (so any alternative route for a word on these boards is rejected with the "would strand the remaining words" explanation). Each theme also had a list of near-theme words (for example PEAR on the fruit board, ACE/CLUBS on the cards board) that the generator made sure are NOT traceable anywhere. An editor should still solve each board and look for accidental theme words outside those lists.
- [ ] Theme words and the short clues used by the first hint are original; check fairness and UK wording. KING appears in both the cards (hwt-e1) and chess (hwt-e4) themes.
- [ ] Expert rounds use a theme-defining answer (CARDS, SEASON, HAND, PIECES), marked "names the theme" and explained in the result; it is never the first hint focus. The brief makes this optional; confirm the labelling.
- [ ] Decision: bonus (non-theme) words are any 4+ letter ESDB membership word traced over unsolved squares; three distinct bonus words earn one free hint. A hint paid for with those credits is recorded as "earned" and not counted as help; other hints and every reveal are counted. The pack fixtures keep their empty off-theme lists (no bonus words there). Confirm this reading of the brief.
- [ ] Bonus words come from the raw ESDB candidate list, so crude words (e.g. ARSE is traceable on hwt-e1) can earn credits. Shared exclusion list needs review.
- [ ] Hint ladder: starting square (+ clue), first half of the trail, reveal the word, reveal everything. The hinted word follows the player's current feasible solution, not only the stored reference path.
- [ ] Difficulty bands are heuristics: gentle 4x5 with about one turn per word and at most one straight-line word; standard 5x6 with no straight-line words; expert 5x6/5x7 with an indirect theme and as many turns as the generator could find. Needs pilot calibration. Only 4-5 practice rounds per difficulty (docs/08 asks 10).
- [ ] Drag is optional (tap, keyboard or drag all work); the grid disables touch scrolling while dragging, and 7-column boards scroll inside their own container on narrow phones.

## Letter Set
- [ ] Practice rounds ls-g1..ls-e4 (4 per difficulty, plus 3 demo fixtures at standard): targets were hand-picked from ESDB membership AND the SCOWL size-35 familiar layer. Deliberately left out of the everyday lists (they still score as bonus words if in ESDB): KINK, NETT, CHINK (slur), THENCE, TENET, CINCH, HENCE, INCITE, ETHNIC, NINETIETH, NINETEENTH, ACED, CEDE, CEDED, ACCEDE, ACCEDED, CABBED, CABLED, CANED, CANDLED, CALLABLE, LANCED, CADENCE, DECADENCE, RACY, AORTA, CARAT, RATTY, TARRY, TARTAR, ORATORY, ROTOR, ANON, UNTO, FOUNT, INFO, INTONATION, NEURONE, NEURON, COERCE, CONCURRENCE, CHAR, HART, HATH, CACTI, CIRCA, HURRAH, ARTHRITIC, BUGGER (vulgar), BURR, BUGLER, BURBLE, BLUER, BUMMER, DUDE, DUDED, LAUD, LAUDED, GULLED, HULLED, LEAGUED, LULLED, LUGGED, DUELLED, ELUDED, MATT, TATTY, ERGO, HUGER, EAGERER, CONDOM, DAMN, MADMAN, MINIMA, MANIA, MANIC, MANIAC, PALL, PAPA, PLOP, POOP, PAPAL, OPTIMA. An editor should confirm each target list and these exclusions.
- [ ] Bonus-word universe is the whole ESDB candidate list (minus the shared exclusions). Boards were chosen without S to avoid plural-dominated sets; the three pack demos (parents, teachers) do include S and are kept as-is.
- [ ] Every target has an original short definition (used by the Definition hint and after a reveal). 339 definitions need an editorial accuracy read, particularly multi-sense entries (FONT, TRACT, CATARACT, LUMBER, GORGE, TILL, CANON).
- [ ] Board presentation uses the v2 "word garden" petal arrangement from ui/app.js and themes.css (six petals around a gold required centre, labelled "required"). The brief suggests a non-derivative arrangement such as two rows of three; the v2 petal design is the pack's own identity, but a designer should confirm it does not read as another product's honeycomb.
- [ ] Validation order follows the brief exactly (length, letters, required letter, membership, duplicate), so a duplicate that is also a revealed word says "Already found".
- [ ] Revealing an all-letter word scores 0 (no bonus) and is shown as revealed in the all-letter area. Confirm this is the intended treatment.
- [ ] Difficulty bands are author hypotheses: gentle = accessible all-letter word, 23-27 targets; standard = 26-27 targets with a less obvious all-letter word; expert = 19-24 targets with a harder all-letter word (CALAMITY, ROUGHAGE, NOMADIC, OPTIMAL). Needs pilot calibration; docs/08 asks for 10 per difficulty.

## Shared Word Board
- [ ] **Rules 1.0 as a playable local rule set**: 1.0 is the pack's uniform fixture rules. Its tile set for new local matches is exactly the fixture's 32 letters (both opening racks + fixture bag: A×5 B C D E×5 G I L×2 N×2 O×2 R×4 S×3 T×4), reshuffled by seed. Offered as a "short match"; with four players only four tiles remain in the bag, so exchanges are impossible. Confirm this is an acceptable reading of "uniform fixture rules".
- [ ] **Pass/exchange threshold for 3–4 players**: the pack's "six consecutive pass/exchange turns" is written for two players. Generalised as three full rounds (3 × active players: 6/9/12). Needs a rules decision.
- [ ] **Resignation with 3–4 players**: the pack only defines two-player resignation (opponent wins, no invented score). With more players the resigning player leaves (their rack is frozen, never scored), the others continue, and the last remaining player wins if everyone else resigns. Needs a rules decision.
- [ ] **Going-out transfer with 3–4 players**: the player who goes out gains the sum of all other active players' rack values; each of those loses their own. Standard generalisation; confirm.
- [ ] **1.1-candidate balance** (open gate): seeded simple-bot simulations (tests) show every 1.1 match ending by consecutive passes/exchanges with the 9x9 board blocked and 11–23 of 93 tiles still in the bag (1.0's 32-tile matches end by going out). The test bot is simple, but this strongly suggests 93 tiles is too many for a 9x9 board, or the board should grow. Balance review and playtests are required before 1.1 is anything but "proposed".
- [ ] **Word list**: gameplay uses the ESDB candidate list (gb-esdb-v1-candidate). It has only 68 two-letter words: it lacks common tile-game two-letter words such as AA, AB, AI, JO, QI and ZA, and includes abbreviation-like entries CF, JR and OZ that the pack's policy would normally exclude. Players will find some two-letter plays refused (the rules text says so). The pack requires a reviewed two-letter-and-longer GB tile-game list before production.
- [ ] **Hint** ("word ideas from your rack"): lists up to 8 words spellable from the rack alone (blanks as wildcards), longest first, drawn from the full membership list, so it can suggest obscure words. It never looks at the bag or other racks and is recorded as assistance in history and the result. Consider limiting ideas to the familiar (SCOWL-35) layer once a browser copy exists.
- [ ] **Local shuffle**: new matches take a seed from `crypto.getRandomValues` in the browser (Fisher–Yates via a serialisable mulberry32). This is fine for local play, but the pack requires a server-side cryptographic shuffle with a hidden bag for online play; the local bag is in localStorage and a determined player could read it. Local pass-and-play makes no claim of security.
- [ ] **Blank face policy**: a blank's letter is chosen at placement (A–Z, one letter) and fixed once committed; preview and history show it marked "(blank)".
- [ ] **Pack fixture as a round**: the fixture is replayed exactly by tests/validator but is not listed as a playable round (match games have no round list). Consider a "watch the worked example" replay view.

## Word Families
- [ ] **Gentle size decision**: the brief says Gentle normally has 12 terms in 3 groups; the task brief said 16/4x4. The game brief is the rules authority, so the authored Gentle rounds wf-g1..wf-g5 are 3x4 (12 tiles). The starter demo stays at 16. Editors may prefer 4x4 Gentle boards.
- [ ] **One away** is shown, defined exactly as in the brief: three of the four selected tiles belong to one *unsolved* group. Confirm the product wants this nudge (it is optional in the brief).
- [ ] **Budget**: 4 mistakes (fixtures say continueAfterBudget=true). At the budget, Check is blocked until the player chooses Continue (recorded as an assisted continuation and counted as one hint in the result), a hint or Reveal answers. The engine also supports continueAfterBudget=false (round fails) for future content; no current round uses it.
- [ ] **Hint ladder** (per group, state-aware): name a category, then two terms from that group (the first two authored terms), then reveal the group. The ladder moves to the next unsolved group in authored order once the hinted group is solved. Editors may want to choose which pair is named per group.
- [ ] **Phone layout**: boards with a word of 8+ letters use 2 columns under 520px wide instead of shrinking type (checked in e2e for wf-e2, wf-e4, wf-g1, wf-demo-2). Validator caps single words at 10 letters.
- [ ] **Blind solve + rival partitions needed for every round** (two editors). Red herrings are stored per round in `src/games/word-families/content/rounds.json` (`redHerrings`) and summarised here:
  - wf-demo-1 (fixture, Gentle tutorial): CRANE (machine), SAGE (colour/wise person). No rival full group.
  - wf-demo-2 (fixture, Standard): DASH (run), BOOT (car boot), ZIP teeth fairness (per brief). Check BED/BATH/CLASS/SHOW + ROOM consistency.
  - wf-g1: none intended. wf-g2: ASH (fire residue). wf-g3: GREEN (golf), CRICKET (insect). wf-g4: STUDY (verb). wf-g5: BOXER (sportsperson).
  - wf-s1: PIN (PINBALL) resolved because the sewing kit has only four candidates; POKER (fireplace tool); BRIDGE (rivers); SEVERN rises in Wales, label is "Rivers in England" (confirm or relabel "British rivers").
  - wf-s2: FLOWER (beside flowers, forms SUNFLOWER); DIAL (clock, units of time); MINUTE (tiny).
  - wf-s3: SOLE (fish), POUND (weight), TONGUE (body part).
  - wf-s4: FLY (insect) resolved because no insect forms FIRE+; IRON (fire iron, two words); LEAD (dog lead).
  - wf-s5: FISH (beside fish, forms FISHCAKE), PAN (kitchen), TEAL (duck), KEEP (verb).
  - wf-e1: YEW (sounds like U) and JAY (sounds like J) are forced into trees/birds by candidate counts; ROOK (chess) forced to birds; KNIGHT/NIGHT; TEA as a "tree" (tea plant is a shrub; tea tree is a different plant): confirm this is not a fair fifth tree.
  - wf-e2: BEARD and GOATEE (facial hair) forced into hidden animals; GRAPEFRUIT hides APE but citrus needs it; LIME (citrus) forced into greens; LEMON (a yellow shade); WHISKERS (cats). Hidden-animal claims are checked mechanically in engine.test.ts against a list of common animals.
  - wf-e3: SWORD/STAR/JELLY each fit weapons/space/desserts but no other tile forms ___FISH; MACE (spice). SPEAR (SPEARFISH) and MOON (MOONFISH) were deliberately kept off the board because they allowed rival partitions.
  - wf-e4: CANINE (tooth), FREIGHT (train), STONE (weight) forced into hidden numbers (exactly four tiles hide a number, checked mechanically); TON (slang for 100); DRAM (whisky measure; confirm familiar enough). HUNDREDWEIGHT was rejected because it hides EIGHT and allowed a rival partition.
- [ ] Only 5 authored rounds for Gentle and Standard and 4 for Expert (plus 1 demo each for Gentle and Standard); docs/08 asks for 10 per difficulty.
- [ ] Reporting an ambiguity from the completion screen (brief) is not implemented; there is no editorial queue backend yet.
