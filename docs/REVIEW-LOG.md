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
- [ ] **Board size on phones**: the 9x9 board fits a 390px screen with about 31px squares (above the 24px WCAG AA minimum, below the site's 44px aim). A "Bigger squares" toggle gives 48px squares that scroll inside the board frame (never the page). Rack tiles and all buttons are 44px or more. Check on the recipient's real device.
- [ ] **Keyboard move builder**: the board is one tab stop with roving focus (arrow keys, Home/End). Typing a letter places a matching rack tile (or a blank standing for that letter if no tile matches) and moves on across or down (toggle); Backspace takes a tile back. Needs a real screen-reader pass.
- [ ] **Pass-and-play privacy**: racks are hidden behind a handover screen after every turn and after any reload; an unsubmitted draft reappears only when that player shows their rack. The whole match (including the bag) is in localStorage, so this is not secure against a determined player. Stated in setup and rules.
- [ ] **Leave match**: stops a local match with no result (library shows "finished early") and keeps one previous copy on the device (`wc:v1:match:shared-word-board:previous`). The pack does not define an agreed stop; confirm this is acceptable alongside resignation.
- [ ] **Difficulty**: the pack's Gentle/Standard/Expert bands depend on bots and online rated play that do not exist yet. No difficulty switch is offered; the library records matches as "standard". Needs a product decision once bots/online play are built.

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

## Cryptic Workshop
Decisions (best-effort, need editorial confirmation):
- [ ] A round is three clues (games/cryptic-workshop.md is the rules authority). 2 demo rounds (pack fixtures cryptic-001/002) + 12 original practice rounds: 5 gentle (incl. demo), 5 standard (incl. demo), 4 expert. docs/08 asks for 10 per difficulty; shortfall remains, pages show "limited preview".
- [ ] Wrong answers are rejected (not recorded as actions), so "attempts" are not persisted; hints never cost points; a revealed clue scores 0; reveal-all or all clues revealed gives a "revealed" outcome, otherwise "completed" (assisted if any hint/reveal).
- [ ] Hint ladder per clue: definition, device, indicator, wordplay material, some letters (every third letter), then reveal (confirm dialog). Gentle names the device, so that stage is skipped. A correct device-practice guess also skips it.
- [ ] Gentle uses initial letters as well as anagram/hidden/reversal (brief lists only the first three).
- [ ] House lists: indicators per device and abbreviations (TA thanks, O ring, E energy, T time, P quiet) live in construction.ts; the validator rejects anything off-list.
- [ ] "Report an answer issue" (brief) is not implemented: there is no editorial backend.
- [ ] ROME (cw-e4) is a proper noun outside ESDB; allowed explicitly in validate.ts. Check house policy on capitals.

Every original clue, mechanically verified by validate.ts (letters) but needing independent solve + semantic review (docs/05 asks for two semantic reviews):
- [ ] cw-g1: "Cheap mixture makes a fruit (5)" PEACH (anagram) · "Metal found in hot interior (3)" TIN (hidden) · "Snare part sent back (4)" TRAP (reversal)
- [ ] cw-g2: "Sword, broken, becomes lyrics (5)" WORDS (anagram) · "Bird found in theme music (3)" EMU (hidden) · "Prize drawer turned over (6)" REWARD (reversal; "turned over" is more natural for a down clue)
- [ ] cw-g3: "Shore scrambled for a mount (5)" HORSE · "Stone hidden in huge mound (3)" GEM · "Rodents: star returned (4)" RATS
- [ ] cw-g4: "Peaceful: initially cats and lions mingle (4)" CALM (initials) · "Object made by night shift (5)" THING (anagram) · "Beer that's regal when sent back (5)" LAGER (reversal)
- [ ] cw-s1: "Vehicle and pet make a floor covering (6)" CARPET (charade; PET used literally) · "Chief dealer is out (6)" LEADER (anagram) · "Sin receives thanks for a mark (5)" STAIN (container, TA = thanks)
- [ ] cw-s2: "Leap season (6)" SPRING (double definition) · "Heavenly being found in Cuban gelato (5)" ANGEL (hidden) · "Number with insect is a renter (6)" TENANT (charade; "Number" = TEN is a loose convention)
- [ ] cw-s3: "Courage when earth moves (5)" HEART (anagram) · "Fiend lived in reverse (5)" DEVIL (reversal) · "Cat swallowing ring makes a layer of paint (4)" COAT (container, O = ring)
- [ ] cw-s4: "Look at timepiece (5)" WATCH (double definition) · "Average boy becomes a clergyman (6)" PARSON (charade) · "Discharge time, going back (4)" EMIT (reversal)
- [ ] cw-e1: "Bird to box and quarrel (7)" SPARROW (charade) · "Headless card game's crest (5)" RIDGE (deletion of BRIDGE) · "Buttonhole motor state (9)" CARNATION (charade; buttonhole = flower worn in a lapel)
- [ ] cw-e2: "Ocean wrecked a small boat (5)" CANOE (anagram) · "Tie support? There's a snag (8)" DRAWBACK (charade) · "Dark time, we hear, for a chess piece (6)" KNIGHT (homophone of NIGHT; pronunciation identical in UK English)
- [ ] cw-e3: "Factory absorbing energy is a world (6)" PLANET (container, E = energy) · "Demon ale shaken up for a soft drink (8)" LEMONADE (anagram) · "Soft offer (6)" TENDER (double definition)
- [ ] cw-e4: "Nose around insect in larder (6)" PANTRY (container PR(ANT)Y) · "Capital served in bistro menu (4)" ROME (hidden) · "Celebrate pulling lever back (5)" REVEL (reversal; only "back" is the listed indicator)
- [ ] Help-card examples (MATE, PEAR, STUN, PIGLET, BOAT, ROW, SUN, MATCH, WEAK) are original and checked not to collide with any answer.

## Word Ladder
- [ ] 15 original practice ladders (5 per difficulty) plus 3 demo fixtures (COLD/WARM and CAT/DOG gentle, HEAD/TAIL standard). Endpoints were hand-picked by the author from everyday words; optima are BFS-proven over ESDB membership and each stored example route uses only size-35 familiar words of the same length. An editor should read every example route for oddities (e.g. SLAKE in expert 3, TRACT and TRAIT in expert 5, FRET in expert 1) and confirm endpoints are not a published puzzle's.
- [ ] Difficulty bands (validator-enforced): gentle = 3-4 letters, 3-4 moves, optional word bank; standard = 4-5 letters, 4-6 moves; expert = 6-8 moves where the optimum exceeds the letter difference (a forced detour). Needs calibration with players.
- [ ] Demo fixture optima re-checked against ESDB: COLD/WARM 4, HEAD/TAIL 5, CAT/DOG 3 (same as the fixtures). The fixture dictionaries are kept as regression data and shown as the demo word bank; play uses the full list.
- [ ] Hints are computed by BFS from the current word, avoiding words already on the route; ties prefer the stored example route, then routes using only familiar words, then alphabetical. The familiar layer for 3-5 letter words ships in `src/games/word-ladder/content/familiar.json` (about 44KB, ladder chunk only) purely for this tie-break.
- [ ] Hint 3 "Insert the next word" is confirmed by the hint dialog's separate Reveal button (the dialog states the effect first) rather than a second confirmation dialog.
- [ ] Decision: the brief's explicit `not_started` state (start only after Play) is not implemented; the shared shell starts the round on load, as for every other game. Revealing the route ends the round with no score; an inserted hint step still counts as a move for scoring.
- [ ] Decision: steps taken back never count against the score (moves = edges in the final route, per the brief); tried and taken-back counts are shown separately.
- [ ] "Report an answer issue" after a rejected word is not implemented (no editorial queue exists yet).
- [ ] Endpoints and the example route ship in the client bundle; acceptable for unranked practice only.

## Anagram Relay
- [ ] Practice rounds ar-g1..g5, ar-s1..s6, ar-e1..e5: chains found by an exact add-one multiset search over ESDB membership and SCOWL size-35; clues written by the build agent. An editor must check each clue against the other words the same letters make (e.g. HEART vs EARTH/HATER, STONE vs NOTES/ONSET/TONES, SCORE vs CORES, ALIEN vs ANILE).
- [ ] Accepted branches: ar-s6 NOTE/TONE ("A single musical sound") and ar-e2 ANGERED/ENRAGED ("Made very cross"). Confirm both fit and nothing else of the same letters does.
- [ ] Clue judgement calls: CARROT clued as "a reward offered as an incentive, the opposite of a stick" (ar-e1); CORNET as "a small brass instrument, or an ice-cream cone" (ar-s6); OBSCURE as "little known, or hard to make out" (ar-s5); HEARTS as the card suit (ar-g1).
- [ ] ar-g4 ends on the plural PAINTS as a deliberate gentle step (brief allows one in Gentle); the validator forbids plural-only stages outside Gentle and more than one per chain.
- [ ] Decision: "backward work" (docs/05) is implemented as revising an earlier stage with confirmed dependent clearing; the brief says only the current stage accepts input, so later stages cannot be answered out of order.
- [ ] Decision: tagline changed from "Solve the scramble. Carry a letter onwards." to "Add one letter. Discover the next word." because the upgrade brief says the old tagline misdescribes the add-one rule. The strap line changed to match.
- [ ] Decision: hint ladder is letter to add, opening two letters, pattern with the new letter's position, fill stage (scores 0), reveal all. The brief's "demonstrate reordering" tier is the pattern hint; confirm it is helpful enough.
- [ ] Decision: wrong answers are rejected atomically and not persisted, so guess counts are not stored (same as Shrinking Staircase).
- [ ] "Report an answer issue" is not implemented (no editorial queue backend yet).

## Letter Circuit
- [ ] Decision: par is proved by breadth-first search over (last letter, coverage mask) using an "everyday pool" = ESDB membership ∩ SCOWL size-35, 3-8 letters, minus simple superlatives and a small blocklist (src/games/letter-circuit/pool.ts). Players may use any membership word, so par can be beaten; the rules say so. The superlative filter is crude (it also drops e.g. FOREST, HONEST from the pool); this only affects par and hints, never acceptance.
- [ ] Hint words and the shown par chain come from that pool; size-35 still contains odd entries (e.g. DIRGES, TWELFTHS, SKIDS). An editor should read each board's par chain (stored in content/rounds.json) and the pool blocklist.
- [ ] Pack fixtures keep their 4-word reference chains and finite lexicons as regression data (validator re-proves optimum 4 inside the fixture lexicon); with the everyday pool each fixture has par 2, which is what players see.
- [ ] Difficulty bands: gentle = par 2 with 700-1100 everyday words and tens of thousands of 3-word routes; standard = par 3, no 2-word everyday finish, 250-420 words; expert = par 4, 130-200 words, awkward letters (V, Z, W, Y). Heuristic, not calibrated. 5 practice boards per difficulty (docs/08 asks 10).
- [ ] Any hint marks the chain being built as helped; the best chain records which words were played by the hint. "Start a new chain" asks for confirmation and always keeps the best completed chain.

## Family space (Batch 8)
- [ ] **Needs the owner's Supabase project** before any signed-in flow can be exercised: URL/publishable key, auth redirect URLs, email template, SMTP, migrations applied, first curator bootstrapped (steps in docs/FAMILY-SPACE.md). Until then pages show "Setup needed" and APIs return 503.
- [ ] Signed-in browser journeys (sign-in by link/code, invite acceptance, upload with real storage, curator approval, favourite/reply persistence, book resume, withdrawal) are implemented but untested end to end: no credentials exist. The database rules they rely on are proven in `tests/family/rls.test.ts` against real Postgres 16 with a Supabase shim, not against a real Supabase stack (PostgREST/Storage/GoTrue behaviour is assumed from their documentation).
- [ ] Open inputs: recipient's display name and birthday date (optional, entered by the curator), a named curator, approved photographs and genuine messages with recorded permission. Nothing is prefilled; no age or "Mum" wording appears anywhere.
- [ ] Decision: contributor publishing is fixed to "curator review required". Direct publishing is not offered.
- [ ] Decision: images are validated by bytes and metadata is stripped losslessly (no re-encoding, no native dependency). A curator should still look at every photo before approving. HEIC is refused; audio upload is switched off until Audio Postcards has real recordings and a transcript review step.
- [ ] Decision: media is only served through the authenticated proxy (no signed URLs), so revocation is immediate; downloads exist only when the uploader ticked "may download".
- [ ] Decision: invitation links are shown once to the curator, who sends them personally; the app sends no invitation emails. Invitations bind to the invited email address.
- [ ] Decision: a user with several families sees their earliest active membership; there is no family switcher.
- [ ] Rate limits are per server instance; confirm Supabase Auth rate limits and SMTP limits for the chosen host.
- [ ] Hosting body-size limits (e.g. Vercel ~4.5 MB) may reject large uploads; the browser resizes photos above 4 MB. Verify on the chosen host.
- [ ] Optional modules (Audio Postcards, Newspaper, Timeline, Crossword, Picture Mysteries, Oral History, Calendar) are not built; each needs genuine content first.
- [ ] Backup/restore, orphan storage clean-up schedule and a threat review must be done on the real project. A real recipient walkthrough has not happened.
- [ ] Copy review: all family-space wording (states, errors, form hints) needs a human read for tone.

## Missing Links
- [ ] Decision: a practice round holds three boards (the brief describes one board per round). The three pack fixtures stay as one-board demo rounds (ml-demo-1..3). Each board is scored and reported separately; the round is complete when every board is solved or revealed. Nothing advances automatically; the player moves between boards with the board buttons.
- [ ] Decision: the enumeration (link length) is always shown, as the brief requires, so there is no separate "letter count" hint. The hint ladder follows the brief per board: first letter, one completed branch (never auto-submitted), full reveal (0 points, recorded as revealed).
- [ ] Decision: a correct link always scores 100; hints and opening the Standard/Expert word bank do not reduce the score but mark that board "solved with help" (the brief says to track them separately). Wrong guesses are recorded (count, and which branches the word fits) at no cost; wrong-length, spaced and whole-compound entries are refused without counting.
- [ ] Partial-fit feedback ("makes a word in 2 of 3 branches") uses the ESDB candidate list as the compound lexicon. It may occasionally call an odd string a word (ESDB includes some rare entries). Branch-level detail is shown only on request.
- [ ] Missing-spaces policy: every branch is a closed one-word compound present in ESDB; entries with spaces, hyphens or apostrophes are refused with a reason, never stripped. Compounds whose closed/open/hyphenated status varies across UK sources and need an editor's check: DROPOUT (often "drop-out"), STEPLADDER, KEYPAD, DOORKEEPER, DOORPOST, CORNFIELD, OILFIELD, SNAKESKIN, WALKOVER, SLEEPWALK, STONEWALL (verb), PIECEWORK, FIELDWORK, SEABED, CAMPFIRE, TEACUP, EARACHE, WATCHWORD, SWEETCORN.
- [ ] Accepted alternatives: DOOR or GATE (ml-s2 board 1) and MOTHER or FATHER (ml-e1 board 1), with clues written to fit both. validate.ts searches the whole membership list for any other word that completes every branch of every practice board and fails if one is unlisted; none remain. An editor should still consider words that fit the definitions loosely.
- [ ] Clues are original. Check in particular: BEARSKIN ("worn by some British guards"), MILLSTONE ("a lasting burden"), STONEWALL, SKINFLINT, WALKOVER, KEYNOTE, FLAGSHIP.
- [ ] Standard/Expert word banks were chosen by hand to include plausible near-misses (e.g. GOAL for DOOR, PARENT for MOTHER, LINE/REST/BELT/LOCK for BAND). Bank order is shuffled per attempt with the attempt seed.
- [ ] "Report an answer issue" after a rejected guess (brief) is not implemented: there is no editorial queue or server yet.
- [ ] Only 4 practice rounds (12 boards) per difficulty; docs/08 asks for 10 per advertised difficulty.

## Clue Pairs
- [ ] **Every answer needs UK reference-dictionary support for both senses and an independent blind solve** (brief). Authored cards were checked against the ESDB membership list and the SCOWL size-35 familiarity layer only. Cards: cp-g1 RING, PALM, ORANGE, KEY, DUCK; cp-g2 MOUSE, NAIL, SQUASH, TRUNK, PITCH; cp-g3 FAN, BOW, CLUB, SHELL, TIE; cp-g4 CHEST, POUND, STAMP, LETTER, WAVE; cp-s1 DRAFT, CHARGE, RULER, CURRENT, GRAVE; cp-s2 FAIR, CAPITAL, LIGHT, PATIENT, BRIGHT; cp-s3 TENDER, MEAN, SOUND, CONTENT, STEEP; cp-s4 NOVEL, STABLE, ROW, COUNT, PRESS; cp-e1 DRAUGHT, PUNCH, HAMPER, SPELL, TACKLE; cp-e2 COMPOUND, FLAG, BUST, HAIL, FAST; cp-e3 TIP, SPRUCE, TEMPLE, MINT, REFUSE; cp-e4 STRAND, CRAFT, COBBLER, RAKE, BATTER.
- [ ] Senses to check specifically: DRAFT as "a written order for a bank to pay" (banker's draft, British spelling DRAFT); BUST as "bankrupt" (informal, "go bust"); RAKE as a dissolute man (literary); COBBLER as a fruit pudding; TIP as a rubbish dump (UK); FLAG as "to tire"; COUNT as a European nobleman; ROW (quarrel) and BOW, CONTENT, REFUSE are heteronyms (same spelling, different pronunciation), which the rules allow because only spelling matters.
- [ ] Possible same-length rivals considered and judged not to fit both meanings: HERON (bird only, used in tests), DRAW for TIE (4 vs 3 letters), DUMP for TIP (4 vs 3). Editors should search for others.
- [ ] Difficulty is the author's intention: some Expert cards (PUNCH, HAIL) may be easier than intended; some Standard cards (LIGHT, FAIR) may be Gentle-level. Needs pilot calibration.
- [ ] Accepted alternates: no current card has more than one accepted spelling; the engine and tests support alternates. DRAFT is never accepted for DRAUGHT senses (validator rule plus tests).
- [ ] Usage-example hints were authored per card (including the two pack demos); the pack's round-level hint strings are kept only as `fixtureHints` metadata.
- [ ] "Report an answer issue" stores a minimal report (round, card, contentHash, guess, time) in this browser's localStorage (`wc:v1:reports:clue-pairs`). There is no editorial queue backend yet, so reports never leave the device.
- [ ] Only 4 authored rounds per difficulty (plus 2 Gentle demos); docs/08 asks for 10 per difficulty.

## Phrase Repair
- [ ] The brief's deferred-release warning stands: every phrase needs independent review of alternative grammatical orders. Known variants deliberately NOT accepted: WHAT COMES AROUND GOES AROUND (pr-e4, differs from the enumeration), IN FOR A POUND IN FOR A PENNY (pr-e2), OUT OF MIND OUT OF SIGHT (pr-e3). pr-e1 accepts both ONE FOR ALL AND ALL FOR ONE and ALL FOR ONE AND ONE FOR ALL.
- [ ] Policy decision: an accepted alternative must fit the displayed enumeration exactly, so orders with different word lengths per position cannot be alternatives. Confirm.
- [ ] Practice phrases (pr-g1..g5, pr-s1..s5, pr-e1..e5) and clues are written by the build agent; check each is a familiar British form (e.g. PRACTICE as the noun with C; A STITCH IN TIME kept as in the pack). pr-e5 contains the proper nouns ROME and ROMANS (exempt from the spelling check).
- [ ] Starting orders were chosen by hand; minimums (gentle 2 to 6, standard 3 to 9, expert 4 to 14) are exact (inversion count with order-preserving duplicate matching, confirmed by exhaustive search). Motor effort versus difficulty needs pilot observation.
- [ ] Decision: completion needs an explicit "Check phrase" (as in the brief's Submit); a wrong check is rejected atomically and not counted.
- [ ] Decision: Restart (shell) is the brief's Reset: it archives the attempt and starts a fresh count; the side panel shows the best earlier completed score read from this device's attempt history.
- [ ] Decision: "Efficient next move" can be asked for repeatedly; each use counts as a hint but costs no points (moves still count). Reveal scores 0.
- [ ] The standard band includes the four-word EASY COME EASY GO (brief suggests five to seven words at Standard) because it is a good duplicate-token case.
- [ ] Only 5 practice rounds per difficulty plus 3 demos; docs/08 asks for 10.

## Daily Crossword
Decisions and shortfalls:
- [ ] Content: 2 pack word squares (demo, gentle quick, kept as engine regression boards) + 9 original grids: 3 per difficulty, each difficulty has Quick and Cryptic (gentle: 5x5 quick, 7x7 quick, 5x5 cryptic; standard: two 7x7 quick, 7x7 cryptic; expert: 9x9 quick, 7x7 quick, 7x7 cryptic). docs/08 asks for 10 per advertised difficulty and 30 scheduled editions; this is far short (grids are expensive to author well). Pages show "limited preview".
- [ ] House style (enforced by validate.ts for non-demo grids): 180-degree symmetry, connected, answers of 3+ letters, at least roughly half of each entry checked (British-style lattice grids with alternate unchecked letters), no repeated answers, every single-word answer in ESDB. Confirm this style suits the audience; a denser, fully checked grid would need a different fill.
- [ ] Fills were found with a local backtracking filler over the ESDB size-35 familiar list (tooling not committed), then every clue was written by hand. An editor should check for dull or awkward entries (e.g. OVERRAN, ZIGZAGGED).
- [ ] No timer (brief says optional). Pencil mode, check/reveal letter/word/grid, clue-first answer form and paste are implemented. Checks count as "hints" in the shared result panel; reveals as reveals.
- [ ] Mobile: 9x9 grid cells are about 38px at 100% on a 390px phone (below the 44px target); zoom to 125%-200% scrolls inside the grid frame. Needs real-device review.
- [ ] Filled-grid verdict never locates errors; ordinary keystrokes are not announced (only verdicts). Screen-reader behaviour of the input-per-cell grid needs a manual NVDA/VoiceOver pass.
- [ ] Typing does not skip over already-filled squares (it overwrites); confirm preference.
- [ ] The word-square demos number conventionally (1, 5, 6, 7 Across; 1-4 Down), unlike the pack's reference UI which listed 1-4 for both.

Quick clues needing independent solve (definitions original):
- [ ] dc-gq1 PRICE "What you pay for something"; ALOFT "High up in the air"; MAYOR "Head of a town council"; PSALM "Sacred song from the Bible"; IVORY "Creamy white colour"; ENTER "Go into a room".
- [ ] dc-gq2 FROSTY "Icy cold, as on a winter morning"; MATADOR "Bullfighter"; LOOKOUT "Person keeping watch"; FREELY "Without restriction"; FUMBLE "Handle clumsily"; OUTDOOR "Done in the open air"; TADPOLE "Young frog"; GRITTY "Sandy, or showing determination".
- [ ] dc-sq1 MISTAKE "Blunder or oversight"; CHERISH "Hold dear"; BATHTUB "Place for a long soak"; EXCERPT "Passage taken from a longer work"; MACABRE "Gruesomely preoccupied with death"; SCEPTIC "Doubting Thomas"; AVIATOR "Pilot, especially an early one"; EXHIBIT "Item on display in a museum or a courtroom".
- [ ] dc-sq2 SPLASH "Scatter water noisily"; GONDOLA "Venetian boat"; REACTOR "Core of a nuclear power station"; TENDON "Cord joining muscle to bone"; SUGARY "Sickly sweet"; LINKAGE "Connection"; SPOTTED "Seen, or dotted"; MATRON "Senior nurse, in old-fashioned hospitals".
- [ ] dc-eq1 EAGLE "Two under par, for a golfer"; FEZ "Tasselled hat"; BOOMERANG "Something that comes back to its sender"; OKRA "Ladies' fingers"; ZETA "Sixth letter from Athens"; DIPHTHONG "Vowel glide, as in 'coin'"; RAY "Beam, or flat fish"; NAKED "Unclothed; undisguised, as ambition may be"; EMBROIDER "Embellish, with a needle or with the truth"; GEOGRAPHY "Lie of the land"; EVEN "Level, or divisible by two"; STUN "Knock senseless; amaze"; FRAMEWORK "Skeleton structure"; ZIGZAGGED "Tacked this way and that".
- [ ] dc-eq2 CONVENT "Where habits are worn"; OUTRAGE "Fury at an atrocity"; HABITAT "Natural home"; TREACLE "Black syrup, or cloying sentimentality"; CROCHET "Hooked needlework"; NOTABLE "Worthy of mention"; ELASTIC "Springy; adaptable"; TRESTLE "Support for a table top".

Cryptic clues (letters verified by the Cryptic Workshop checker; synonyms and surfaces need semantic review):
- [ ] dc-gc1 "Snoop around for a piece of cutlery" SPOON (anagram); "Change seen in metal terminal" ALTER (hidden); "Clean out weapon" LANCE (anagram); "Nails, bent, give a slow creature" SNAIL (anagram); "Frequently found in roof tent" OFTEN (hidden); "Courage never broken" NERVE (anagram).
- [ ] dc-sc1 "Draw at area of land" ATTRACT (AT + TRACT); "Invaded when finished and managed" OVERRAN (OVER + RAN); "Crowd with era for a captive" HOSTAGE; "Call and allow a curl" RINGLET; "An alternative? One more" ANOTHER; "Betrayal of senator, changed" TREASON (anagram); "Tune and letters for overseas post" AIRMAIL; "Brown man's digression" TANGENT (TAN + GENT; check fairness of "digression").
- [ ] dc-ec1 "Walked by den, trampled" TRODDEN; "Away from home, develop and become too big for" OUTGROW; "Stern expert pulls a face" GRIMACE; "The rate changed at the playhouse" THEATRE (anagram); "However, time for reflection" THOUGHT (THOUGH + T); "Exterior of away team" OUTSIDE; "Sleeping quarters with insect, inactive" DORMANT (DORM + ANT); "Currently attending, in no place" NOWHERE (NOW + HERE).
