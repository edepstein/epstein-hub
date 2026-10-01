# Membership sources (word-list inputs)

| File | Source | Licence / notes |
|---|---|---|
| `scowl95-bza.txt` | ESDB/SCOWL at the pinned commit 1e5b7d3a (see `gb-esdb-v1.manifest.json`), size 95, spelling categories B (British -ise), Z (British -ize) and A (American), variant level 5, abbreviations excluded | SCOWL licence (see `public/dictionaries/ESDB-Copyright.txt`) |
| `enable1.txt` | ENABLE2K word list (https://github.com/dolph/dictionary) | Public domain |
| `collins-two-letter.txt` | The 127 two-letter words valid in Collins Scrabble Words 2021 (factual list; Collins Scrabble Words itself is not included) | Two-letter list only |
| `licensed/csw.txt` (optional, gitignored) | Collins Scrabble Words, if you hold a licence | Proprietary (HarperCollins). Never committed. |

`pnpm build:membership` merges these into `public/dictionaries/wc-membership-v2.txt`.
Two-letter entries are restricted to the Collins two-letter list (the abbreviation leak in the larger sources, e.g. CF, JR, OZ, is removed).
