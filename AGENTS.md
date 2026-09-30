# Word Club: agent and contributor instructions

Read this first. The authoritative product specification is the build pack in
`reference/build-pack-v3/` (START-CLAUDE-CODE.md, docs/01–09, games/*.md, upgrades/*.md,
content/*.json). `reference/` is read-only: never edit it, especially
`reference/build-pack-v3/vendor/hexabble-original/` (byte-preserved original).

## Stack and commands (pnpm)

Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind 4 (+ ported v2 reference CSS),
zod, Vitest, Playwright 1.56 (uses the preinstalled Chromium in /opt/pw-browsers).

```sh
pnpm install
pnpm lint          # eslint
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest (all unit/engine tests)
pnpm vitest run src/games/<id>   # one game's tests
pnpm validate:content            # every game's content validator
pnpm build         # production build
pnpm test:e2e      # playwright (needs `pnpm build` first; starts `next start` on E2E_PORT, default 3100)
E2E_PORT=3217 pnpm exec playwright test tests/e2e/<id>.spec.ts   # one game, own port
```

Do not add dependencies without recording a decision in docs/DECISIONS.md.

## Layout

```
src/lib/engine/types.ts      shared GameEngine contract (docs/08)
src/lib/progress/            versioned attempt envelope, action replay, localStorage, library index
src/hooks/useGameSession.ts  autosave/restore/draft/idempotent dispatch hook for puzzle games
src/components/game/         GameShell, HintDialog, ResultPanel, RulesView, LiveFeedback, SaveIndicator
src/components/ui/Dialog.tsx native <dialog> modal + ConfirmDialog (focus return, Escape)
src/lib/dictionary/          ESDB candidate membership loader (browser + node), exclusions
src/games/<id>/              EVERYTHING game-specific lives here:
    definition.ts            metadata, theme, rules text, availability, release gates
    rounds.ts                RoundBundle[] (meta + payload) for practice/demo rounds
    content/*.json           authored round data (imported by rounds.ts)
    engine.ts                pure engine implementing GameEngine
    engine.test.ts           positive/negative/edge/invariant tests
    validate.ts              validateContent(): string[] used by pnpm validate:content
    Play.tsx                 client component (default export) using useGameSession + GameShell
    *.module.css / board css game-specific styles
tests/e2e/<id>.spec.ts       browser walkthrough for that game
src/games/registry.ts, play-components.tsx, scripts/content/validate-all.ts
                             shared registries: already list all 19 games; do not edit to add a game
```

## Rules for game modules

1. Engines are pure: no React, DOM, Date.now or Math.random. Use `createRng(seed)` from
   `src/lib/rng.ts` when randomness is needed. `apply` rejects illegal actions atomically
   (return the same state object with ok=false and a stable code + UK English message).
2. The session layer persists raw actions and replays them on restore. Therefore every
   accepted action must be replayable deterministically, and hints/reveals must be actions.
3. Invalid input is retained for correction (drafts are UI state, persisted via `setDraft`).
4. Rounds pin `rulesVersion`, `dictionaryVersion` and `contentHash = contentHash(payload)`.
   Pack fixtures keep `status: "demo"` and `sourceFixtureId`; new authored rounds use
   `status: "practice"`. Never mark anything published/scheduled.
5. Distinct difficulty = distinct authored rounds. No fake difficulty switch.
6. Rules text in `definition.ts` must be complete and accurate (displayed in the Rules dialog
   and on /games/<id>). Set `availability: "playable-preview"` only when the full loop works.
   `productionEnabled` stays false (human editorial gates are open).
7. Keyboard + touch: no drag-only interactions, 44px targets, visible focus, colour-independent
   state (text/symbols), polite live feedback via the shell.
8. Log anything uncertain or needing human review in `docs/REVIEW-LOG.md` (append a section for
   your game; keep other sections intact).
