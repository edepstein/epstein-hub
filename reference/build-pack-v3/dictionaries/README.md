# British English dictionaries

## Included files

- `gb-candidate-words.txt`: 81,901 uppercase ASCII candidates, length 2–24, sorted and unique.
- `source-manifest.json`: exact upstream revision, export command, post-filter and SHA-256.
- `ESDB-Copyright.txt`: preserved full upstream notice; keep it with redistributed lists and supporting documentation.

This list was actually built for this pack from ESDB revision `1e5b7d3a72f47a71da5d28686c1dd4b397178485`, checked 30 September 2026. It includes GB -ise and recognised -ize variants. It is a spellings candidate list, not an approved answer bank or a dictionary of definitions.

The export excludes marked abbreviations and special categories, then retains only originally lowercase A–Z tokens before uppercasing. This removes capitalised source forms, spaces, punctuation and accented forms, but cannot guarantee that every name, offensive term, specialist term or surprising inflection is removed. An editor must curate approved gameplay membership and common targets. The build emitted unmatched-source compound warnings; they are recorded in the manifest. Do not advertise completeness.

## Reproduce

Run `python scripts/build-gb-dictionary.py /path/to/output-directory` from the pack root. It clones only the upstream project, checks out the pinned commit, builds its database, exports the selected spellings and applies this pack's documented filter. It needs git, make, Python 3, SQLite and network access to GitHub. A normal run can take a minute. Preserve the full upstream notice in the output. Compare resulting checksum to source-manifest.json; if upstream tooling differs, investigate rather than silently replacing the frozen list.

No online dictionary API is required for public solo play. Bundle the approved membership with offline engines where appropriate, or use server-backed validation. A large candidate file must not be sent repeatedly with each puzzle request.

## Create production layers

1. Read the provenance and full notice.
2. Import candidates with usage flags and reviewer state.
3. Approve a family-safe gameplay list per game; include normal inflections according to explicit policy.
4. Create manually reviewed common-answer pools. Do not use all 81,901 entries as Wheel completion goals or Deduction answers.
5. Pin version/hash, run solvers and review actual rounds.
6. Include the original notice in the distribution and credits.

Each game's JSON has a deliberately finite fixture vocabulary and complete demonstration solutions. For replayable demos, validate only against that fixture vocabulary and clearly label it. Production import recalculates routes, optimums and accepted answer sets against the approved dictionary; the demonstration optimum might change.

## Definitions and quotations

ESDB supplies spellings, not publishable third-party dictionary definition text. Author original definitions and clue explanations, check their accuracy and keep source notes in editorial records. Do not scrape Oxford/Merriam-Webster or assume an API plan permits redistribution. Private family clues use supplied genuine facts and are not added to public word lists.

Optional wordfreq-based familiarity scoring is not included or necessary. It has distinct code/data licence obligations; add it only after inspecting the selected version and recording its terms. Human editorial familiarity judgement is sufficient for the first launch.
