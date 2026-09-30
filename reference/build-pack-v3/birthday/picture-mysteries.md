# Picture Mysteries

## Goal

A playful reveal of a genuine approved family photograph, followed by its story. Requires a fair question and supplied answer; do not assume she recognises every distant relative or event.

## UX and gameplay

Choose a card, see crop or partial image, read a question. Modes: 3-option gentle recognition; typed answer with explicit accepted aliases; optional progressive reveal. Up to three authored hints provide more useful context, then “Show the picture and story”. Untimed by default. No penalty for revealing and no public scoreboard. Offer full-image descriptive text for users who cannot use the visual crop; this alternative may change challenge and should be described plainly.

Never make a person's appearance an embarrassing punchline. No automatic face analysis or image inference. Curator selects crop and approved labels manually. Reveal sheet shows actual story and optional text reply to share a related memory. Crop rendering must not require publicly hosted originals.

## Data

`picture_mysteries(id,family_id,title,asset_id,question text,answer_mode enum(choice,text),options_json?,accepted_answers_json,normalisation_rules_json,crop_json,hints_json,reveal_story text,source_note private text,status enum(draft,validated,published,withdrawn),version)`.
`picture_mystery_progress(family_id,user_id,mystery_id,version,hints_used int,revealed bool,answer_state?,updated_at)`.

Curator owns factual answers and normalisation rules. Use limited, explicitly authored aliases; do not use a live LLM to decide whether a personal claim is correct. Do not store every wrong personal guess unnecessarily.

## Acceptance

Image approved, crop coordinate bounds valid, at least one correct option, distractors plausible and kind, hints do not contradict source story. British punctuation/case handling tested and aliases explicit. A user can reveal without typing. Visual alternative, keyboard and reduced motion work. First launch needs at least three edited cards or present one as a single bonus, not an empty collection. Private API/media isolation passes. Fictional fixture cards do not ship.
