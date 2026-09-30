# Quality standard: complete games, not decorated demonstrations

This document and `../upgrades/` extend the preserved rules, fixtures and v2 design. They supersede any earlier instruction to stop at a visual shell or leave difficulty as descriptive labels. They do not silently alter established game rules. The collection now has nineteen games, including the actual Hexabble reference implementation.

## The benchmark

Hexabble earns its depth from a complete loop: prepare → compose → analyse → revise → commit → explain → continue → finish → replay. It also has stateful rack/bag resources, alternative legal choices and decisions about position. Daily puzzles need their own equivalent decisions, not copied board-game complexity. Letter Wheel explores a substantial answer space; Families reasons about plausible rival classifications; Ladder optimises paths; Fragments allocates a finite shared inventory; Detective uses supporting evidence. Each game must expose its own satisfying decision.

The adapted Hexabble adds interruption recovery, phone usability and keyboard placement. Remaining rules/content/accessibility gaps are recorded, so use the benchmark's strengths without importing its weaknesses. All nineteen games must meet the common gates below before their own productionEnabled flag becomes true.

## Required capability contract

| Area | Required behaviour | Evidence |
|---|---|---|
| Rules | Pure engine validates every action and derives score/outcome | Positive, negative, edge and invariant tests |
| Drafts | Compose, revise and cancel without committing state | Browser flow plus unchanged engine snapshot |
| Feedback | Precise rejection reason and score derivation; input retained | Assertions for invalid, duplicate and accepted action |
| Difficulty | Different reviewed rounds/mechanical constraints with published descriptions | Fixture/content audit and calibration observations |
| Hints | Optional progressive guidance tied to current state | No repeated charge; assist/reveal tracking |
| Completion | Honest result explains what was achieved, assisted and left unexplored | Complete-round walkthrough, success/failure/reveal cases |
| Replay | Another unseen round or new valid session; exhausted pool explained | Stable round ID/history tests |
| Recovery | Exact action/draft restore with versioned rules/dictionary/round | Reload, mismatch, quota and corrupt-save checks |
| Accessibility | Keyboard, touch, zoom, focus and colour-independent information | Manual and automated checks with stated limits |
| Content | Valid solvable rounds, curated familiarity, alternatives accepted | Validator plus independent editorial solve |
| Reliability | Deterministic scoring, idempotent commits, no impossible state | Pure tests, seeded sessions, crash/reconnect cases |
| Privacy | Puzzle data public; family media request-protected | Viewer/contributor/curator permission tests |

## Pure engine API

Define a common interface with game-specific state/action types:

```ts
interface GameEngine<R, S, A, P, F> {
  initialise(round: R, options: SessionOptions): S;
  preview(state: S, draft: P): Analysis<F>;
  apply(state: S, action: A): Transition<S, F>;
  hint(state: S, tier: HintTier): HintOffer;
  result(state: S): ResultSummary | null;
  validateSnapshot(snapshot: unknown): SnapshotCheck<S>;
}
```

An Analysis includes legal status, stable error codes, human explanation and a score breakdown where relevant. Preview does not mutate. Apply rejects illegal actions atomically and returns a new state. A client event carries an action ID; replayed action IDs cannot award points twice. SessionOptions contains locale, mode and pinned rule/dictionary versions. Random generation takes a seeded RNG and emits an immutable round, not hidden runtime randomness on every render.

UI components use the engine output, never infer correctness from DOM classes. Shared framework owns navigation, content loading, player preferences, autosave and result storage. Game modules own geometry, vocabulary/round checks, score derivation and progression. Persist drafts separately from committed actions; hints/reveals are actions whose effect on results is explicit. Score denominators include only eligible targets under the pinned round definition.

## Content strategy

Keep all existing 43 demo fixtures and the three Hexabble opening fixtures as regression inputs. They are not a release content bank. Dictionaries provide accepted membership; editor-authored answer pools determine appropriate daily answers. Never promote the uploaded 252,209-word merge to every game's target pool merely because it is larger.

Provide a reviewed practice bank before public discovery: at least ten distinct rounds per advertised difficulty for finite puzzle games, with per-game validators and no knowingly repetitive answer/clue sequences. A smaller preview bank must be labelled limited preview and show exhaustion. A daily service additionally needs at least thirty scheduled reviewed editions ahead of launch and a coverage alert with a curator fallback. Do not advertise endless daily availability without a content operation. Hexabble/Shared Word Board use valid session generation, rules versions and a reviewed membership list; they do not need fabricated daily rounds unless solo turn challenges are added.

Publish only rounds where a solver verifies a familiar route to success. Difficulty depends on branching, overlap, deductions, step count, clue support and familiarity, not mandatory rare words or less readable text. Start with hypothesis bands, observe completion/assistance during consented playtests and recalibrate. Scores from simulated agent reviews are prioritisation hypotheses, not evidence Mum will enjoy them.

## Design parity

Retain warm paper, strong serif hierarchy, rounded actions and shared navigation from v2. Keep the observatory, code room, garden, ladder, notebook, collage, bridge, weaving and dossier identities. Hexabble keeps navy/amber and hex tiles as its own room in the same club. The birthday section stays a personal album. A complete game gets state-driven progress, history, tools and result layouts, not additional decorative cards around a minimal input.

Required screen inventory: first visit; returning player; loading; initial active; composed draft; invalid action; accepted progress; hint preview; assisted continuation; completed; revealed/failed where applicable; restored session; content unavailable; offline/save unavailable; fresh practice. Family pages additionally need permission denied, invitation expired, awaiting moderation, upload failure and published private post states.

Add restrained engine-driven motion for tile placement, group discovery, lane completion and results, with reduced motion respected. Prioritise clear causality over celebration. Never require dragging or rely solely on colour. Board zoom and coordinate focus are essential for dense geometry. Test long real terms, not only short sample words.

## Integration and publication

Each catalogue item has its own enablement gate. A finished home/card never enables an unfinished game. Keep implemented practice separate from scheduled daily content and local family play separate from remote multiplayer. Public release requires actual end-to-end evidence and verified content/source notices. Private birthday media requires real request-level authorisation. The working prototype does not remove those requirements.

Read `09-implementation-batches-v3.md` for executable work batches and the individual `../upgrades/<game>.md` for exact game gaps. Preserve unrelated repository changes and report precise remaining work. Do not declare parity complete because screenshots look similar.
