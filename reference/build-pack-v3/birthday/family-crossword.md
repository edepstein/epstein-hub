# Family Crossword

## Goal

An occasional private puzzle blending normal wordplay with supplied family anecdotes. Public game engine may be reused; family clues/answers/puzzle IDs must remain private. No invented memories, nicknames, addresses or factual relationships.

## Editorial specification

Use a genuine interlocking crossword, not disconnected trivia boxes. Prefer 70–85% general vocabulary and 15–30% family references so solving does not depend entirely on remembering private facts. These proportions are editorial targets, not rigid validation rules. Explain personal context through fair clues; avoid intimate facts, bereavement surprises and obscure dates. Offer an optional “Family context” hint that reveals the relevant supplied anecdote without automatically revealing the answer. Easy/standard/challenging editions differ in clue craft and cross-check support, not tiny text or obscure personal knowledge.

Clues include enumeration; exact answer/spelling, accepted variants and allowed punctuation specified. Every answer has a source: approved dictionary/editorial clue or supplied family anecdote. Reject unchecked/generated personal facts. If a clue needs another person's permission, record it before publication.

## UX and data

Reuse accessible crossword entry, across/down navigation, undo, progress save, hint ladder, check and reveal semantics from public engine. Saved state is namespaced by user/family/private puzzle. Optional checking does not penalise or shame. Reveal completion states distinguish solved with assistance from unaided without public rankings.

`private_crosswords(id,family_id,title,difficulty enum(easy,standard,challenging),grid_json,clues_json,solution_private_json,source_refs_json,version int,status enum(draft,validated,published,withdrawn),published_at?)`.
`private_puzzle_progress(family_id,user_id,puzzle_id,puzzle_version,state_json,updated_at)`.

Answers served by authorised private puzzle endpoint; no public build-time bundle, sitemap or public share payload. Public site should not accidentally prefetch private content. Curator validates and publishes; viewers play. Personal solution/source fields are private even if public answers are handled differently.

## Acceptance

Validate grid dimensions, blocks, connected white cells, numbering, answer lengths, all crossings and duplicate clue IDs. Editorially review family clues and accepted UK spelling variants. Test every clue solves to its intended answer; solver output must not substitute for human ambiguity review. Keyboard and mobile entry complete; navigating away restores progress. Anonymous and other-family requests fail for clues and answers. Private spoiler-free sharing remains disabled initially. Release only with one complete validated puzzle and authentic source material, never placeholders.
