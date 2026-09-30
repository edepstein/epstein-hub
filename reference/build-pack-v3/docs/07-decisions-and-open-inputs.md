# Final decisions, naming and genuinely missing inputs

This file resolves shorthand differences across specialist briefs. Read it before creating migrations or UI components. Exact game rules in the corresponding game MD take precedence over a high-level summary; shared privacy and release gates always apply.

## Decisions made

- Launch games are Wheel, Deduction, Families and Ladder; the full 18-game catalogue is a specification roadmap, not a requirement to launch every game together.
- Difficulty labels are Gentle, Standard and Expert. Demo references do not supply three calibrated banks; production modes need reviewed variants or explicitly labelled assistance differences.
- Shrinking Staircase removes exactly one letter then permits rearrangement. Anagram Relay retains every existing letter and adds one supplied letter. Phrase Repair uses **adjacent** token swaps. Definition Detective uses four definition options and three evidence options in the final demo; this is a precise refinement of the earlier broad concept.
- Crossword and Weave demo grids are complete, mechanically checked development boards. Word-square crossword seeds are not the intended quality ceiling for daily editorial puzzles.
- No game data or dictionary is promoted into public daily content merely because validators pass.
- Shared Word Board has uniform deterministic fixture rules 1.0 plus a complete proposed premium/tile configuration 1.1-candidate. They must never be replayed under interchangeable scoring rules. Balance review remains open.
- UI aliases `crossword.html` and `tile-table.html` are legacy reference filenames. Canonical game IDs are `daily-crossword` and `shared-word-board`; catalogue.json maps canonical brief/data/UI paths. Do not create duplicate production games.
- The public home links to family access without private previews. An authenticated member can see previews only through private scoped retrieval.

## Canonical schema mapping

`docs/03-architecture-data-api.md` establishes source names. Some birthday briefs use shorter conceptual names. These are aliases, not separate duplicate tables:

| Birthday shorthand | Canonical table | Merge guidance |
|---|---|---|
| memberships | family_memberships | Include active/revoked status; no user role escalation |
| invitations | family_invites | Hash tokens, expiry, invited email and one-use acceptance |
| assets | family_media | Merge kind/mime/size/dimensions/duration/consent/processing fields; family_id immutable |
| posts | family_posts | Include draft/published/deleted status, author and family |
| comments | family_comments | Scope author, family and referenced post |
| consent_records | consent_records | Add explicit permission evidence; never assume a checkbox proves permission |

Use composite family+entity foreign keys where content references media from a family. Apply the richer per-module constraints in birthday briefs; the common schema is a baseline, not a reason to drop consent or media dimensions. Schema changes require migration and tests.

Image upload default is **10 MB** for JPEG/PNG/WebP, matching the reference preview; configure a documented limit and validate decoded bytes server-side. Audio default remains 10 minutes/30 MB. HEIC can be accepted only when the implementation includes actual safe conversion and source validation; show a useful alternative otherwise.

## Inputs still required from owner

| Input | Blocks | Independent work can continue |
|---|---|---|
| Recipient display name, birthday date and chosen wording | Personal birthday launch | UI, private schema, public games |
| Her main device/browser | Final recipient-specific testing | Responsive prototype and standard browser tests |
| Approved photographs, real messages/recordings and permission | Populated gift | Collection checklist, uploader, album/book layout |
| A willing curator | Sustainable Family Window | Finished book and archive |
| Hosting/auth/database project configuration | Real private sign-in and deployment | Engines, local public demo, migrations and test plans |
| Human editorial reviews and pilot feedback | Public daily launch | Validators, authoring tools and draft inventory |

Do not ask the owner to solve routine coding choices already specified. State a missing dependency precisely, finish independent work and then request the input for that dependent step. Do not guess names, dates, stakeholders or memories.
