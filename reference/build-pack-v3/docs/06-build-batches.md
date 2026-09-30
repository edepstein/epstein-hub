> V3 uses docs/09-implementation-batches-v3.md as the current sequence for nineteen games. This older plan is retained as background.

# Claude Code work batches

Each batch begins by inspecting the repository's AGENTS.md, relevant files, lockfile and existing scripts. Preserve unrelated work. Keep the scope focused; inspect the listed reference UI and fixture before building. A batch ends with exact commands/results, changed files, visible behaviour and remaining risks. Do not deploy simply because build passes.

## Batch 0: inspect and establish foundation

Read README, CLAUDE, AGENTS and docs/01–05. Inspect all launch briefs. Identify whether there is an existing app. Keep its compatible stack. Otherwise initialise maintained Next.js App Router/TypeScript/Tailwind/shadcn/ui/lucide-react. Pin versions, provide .env.example and scripts below. Avoid dependencies for features not being built yet.

Create pure engine directories, runtime schemas, typed catalogue registry, deterministic fixture importer, public routes and a design-token layer based on ui/styles.css, ui/themes.css and ui/DESIGN-HANDOFF.md. Define demo versus published content before importing anything. Add a decision log and remaining-input list. Acceptance: build/typecheck works; home matches layout at mobile/desktop; no broken deferred-game links; fixture envelope preserves game payloads.

## Batch 1: dictionary and content foundation

Read docs/04, dictionaries/README, source manifest and game seed files. Import bundled GB candidate words and demo sets, preserving upstream notices. Implement approved-membership and common-answer layers with explicit versions; never treat every candidate as approved. Create content schemas and validators for four launch games. Store demo data as practice and keep answers out of production public payloads where required.

Acceptance: broken fixtures fail with actionable messages; imports are deterministic; dictionary versions and content hashes pin attempts; demo rounds cannot publish; provenance is rendered on /credits.

## Batch 2: four launch engines

Implement Wheel, Deduction, Families and Ladder as pure reducers. Start with sample rounds, build tests, then React UI. Read each game MD and inspect its standalone HTML. Implement rules, keyboard/touch, hints, undo where allowed, scoring, full explanations and win/loss/reveal. Families semantic quality remains an editorial gate, not an algorithmic certainty.

Acceptance: every supplied launch demo completes; illegal actions and duplicate submissions behave correctly; APPLE/ALLEY duplicate feedback passes; any approved legal Ladder route works; engine tests prove minimum in demo graph; UI interactions visibly update real engine state. No generic alert as final feedback.

## Batch 3: daily site and reliability

Implement home, games catalogue, archive, settings, local attempts, results and spoiler-free share. Add Europe/London editions, immutable puzzle routes, resume, hint dialogs, loading/error/empty states and optional statistics/streak settings. Keep local demos playable without credentials. If the production inventory is absent, display Practice clearly rather than fabricating today's content.

Acceptance: all browser flows in docs/05 pass at 390px/1440px; no body overflow; refresh/date rollover preserve instance; large text and keyboard work; all selected launch games are fully playable. This is the stopping point of the starter prompt.

## Batch 4: private birthday foundation

Read all birthday briefs, docs/03 and UI birthday references. Configure actual Supabase Auth/Postgres/private Storage. Add schema migrations, RLS, invite acceptance, viewer/contributor/curator roles and access tests. No fake sign-in. Build receiving-first Birthday Book and Family Window; real content remains a prerequisite for gift launch. Credentials genuinely required can be requested after completing migrations, UI and test scaffolding that do not depend on them.

Acceptance: unrelated families/anonymous users cannot access any private data/media; permitted roles work; remembered login and recovery supported; public landing leaks no private content; approved images and captions populate the book. Replace every placeholder explicitly.

## Batch 5: editorial tools and release bank

Build puzzle authoring/import, validation reports, independent review, scheduling, withdrawal and correction. Prepare 28-day inventory per launch game plus reserve. Generate candidates offline only, validate and edit every scheduled board. Pilot with real enthusiasts and tune difficulty. Do not say software generation equals human approval.

Acceptance: publishing requires approvals and every scheduled board passes validation; future answers do not leak through public endpoints; content supply and named editor documented; pilot outcomes recorded.

## Batch 6: first expansions

Implement Clue Pairs and Letter Set first, followed by Daily Crossword and chosen alternative games. Each is a separate task using its brief/UI/fixture and tests. Only activate after complete gameplay and dependable editorial supply. Hide incomplete features. Trail, Circuit and Weave need particular attention to accessible board input.

## Batch 7: optional birthday formats

Select from audio postcards, family newspaper, memory timeline, family crossword, picture mysteries, oral history and calendar. These are modules within the private space, not separate public sites. Implement only approved modules with genuine content and role-scoped access. Recording remains optional; no automated fabricated memories.

## Batch 8: multiplayer

Implement Shared Word Board last. Read deterministic rules/config and fixture, then server-authoritative turns, private racks, tile bag, scoring, reconnects, pass/exchange/end conditions. Start invitation-only; public matchmaking and chat are explicitly outside initial multiplayer scope. Two-user tests and idempotency are mandatory.

## Commands to create in the application

Use npm below only when repository package manager is npm; otherwise equivalent commands. These are required future scripts, not commands claimed to exist in this reference pack.

```bash
npm run lint
npm run typecheck
npm run test
npm run validate:content
npm run test:e2e
npm run build
```

`test` uses engine/schema tests; `validate:content` checks all scheduled rounds; `test:e2e` uses browser flows against the local app. Configure CI to fail on these failures. Do not replace tests with a build command alone. Accessibility and semantic review remain separate evidence.

## Final handoff / deployment

Supply README setup, migrations, configuration guide, owner/editor guide, content schedule, real pilot results and release checklist. Validate production secrets/config and recovery redirects. Deploy only when requested and authorised for the target project. Completion summary names what is live, what is demo, open gates and next best action.
