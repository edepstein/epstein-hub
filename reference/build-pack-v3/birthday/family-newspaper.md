# Family Newspaper

## Goal

A curated periodic edition with a few meaningful updates, photographs and a private puzzle. Better than a frequent feed if contributors cannot sustain regular posts. “Sunday Edition” is a suggested title, not a scheduled promise. Monthly is a sensible initial cadence only if a curator agrees.

## UX

Private cover: supplied title, edition date, short contents. Readable story cards; no tiny broadsheet columns on phones. Curator selects existing approved posts or writes supplied stories, adds one puzzle, previews print layout and publishes an immutable edition. Viewer browses latest then archive; no unfinished edition shown. A quiet period does not produce a fabricated filler edition. Reuse story content by approved snapshot; withdrawal must flag/remove future access to withdrawn material.

## Data

- `newspaper_editions(id,family_id,title,issue_date date,status enum(draft,published,withdrawn),published_at?,revision int)`.
- `newspaper_sections(id,family_id,edition_id,heading,position)`.
- `newspaper_items(id,family_id,section_id,type enum(story,photo,audio,puzzle),source_post_id?,body_snapshot?,asset_id?,private_puzzle_id?,position,permission_record_id?)`.

Curator-only editing/publication; viewers read published editions. No public sitemap/index and no private personal clues in public puzzle catalogues. Export follows Birthday Book's private PDF rules.

## Requirements and acceptance

One complete edition before adding navigation. Suggested edition: 3–5 supplied updates plus photos and a validated private puzzle; fewer is acceptable if coherent. Printed text remains legible and pictures captioned. Optional audio always has transcript. Concurrent edit conflicts handled. Edition date uses family timezone. Source asset withdrawal propagates to archive rendering and export. Public route/API test cannot retrieve edition content. Curator preview catches missing puzzle answers, unsupported images and empty stories before publication.
