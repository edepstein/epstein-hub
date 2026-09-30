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
