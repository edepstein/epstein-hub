> **V3 scope update:** the approved scope now includes nineteen games (Hexabble added) and complete functional parity. Read docs/08 and docs/09 and the individual upgrades/ documents. The v3 batch plan supersedes earlier sequencing that stops at four launch games; established rules, private-data safeguards and per-game release gates remain in force. Preserve vendor/hexabble-original unchanged.

# Claude Code project instructions

Read `AGENTS.md`, `README.md`, the six core files in `docs/` and `docs/07-decisions-and-open-inputs.md` before implementation. These files describe the intended application; `ui/` is a design reference, not the application architecture.

## Working agreement

- Inspect the existing repository, its own AGENTS.md, package scripts, lockfile and documentation. Preserve unrelated changes and use its package manager.
- In a new repository, use Next.js App Router, TypeScript, Tailwind, shadcn/ui, lucide-react, Supabase for accounts/database/private storage, Vitest for engines and Playwright for flows. Pin compatible maintained versions at implementation time. Verify official documentation before introducing version-specific APIs.
- Keep game engines pure and separate from React. Reducers return typed errors/events; components render them. Share infrastructure, not incompatible game rules.
- Build the four launch games first. Never present an unimplemented catalogue tile as playable. Hide deferred games or label them Coming soon without broken links.
- Preserve UK English and independent names/content. No publisher puzzles, copied branding, scraped dictionaries, invented family facts or live unchecked AI generation.
- Import demo fixtures as demo/practice only. Their difficulty labels are design intentions, not calibrated evidence.
- No API keys are required to play local public demos. Birthday production access must remain unavailable until genuine authentication and private storage are configured. Do not substitute a fake login for security.
- Use `ui/` for layout, colour, typography and board geometry. Replace its demo behaviour with tested engines; never copy a generic alert or placeholder submit as the final action.
- Make reasonable independent implementation choices within this scope. Stop only for missing credentials or personal content that genuinely blocks the dependent feature, and report the exact gap.

## Completion report for every batch

List changed files, user-visible outcome, commands run and their results, known limitations, remaining release gates and next batch. Describe work as tested only to the extent actually verified. Write substantial changes as focused commits / PRs where a repository is available; do not publish externally without an authorised deployment task.
