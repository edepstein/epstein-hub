# Optional Oral History Notebook

## Goal and boundary

Preserve her own words if she wants to contribute. Not a launch dependency. No homework framing, reminder pressure, AI interrogation, synthetic voices or assumed life story. Recipient can decline or delete an answer without losing access to the rest of the gift.

## UX

One family-authored optional question at a time, with “Skip”, “Write instead” and “Record an answer”. Examples are neutral prompts, not asserted facts: “Is there a memory you would like to share?” Curator can supply a more specific prompt only from actual known context. Recording flow follows Audio Postcards; preview, retake, save privately, choose audience and submit. Drafts visible only to author. Explicit audience confirmation before family publication. Transcript editing always available. No automatic recording or upload during preview.

If no prompt exists, “You can add a memory whenever you like.” If permission fails, written answer works. Returning to draft explains whether recording was saved or lost; do not promise browser persistence the implementation cannot provide.

## Data and roles

`history_prompts(id,family_id,author_id,question,status enum(draft,available,withdrawn),position)`.
`history_responses(id,family_id,prompt_id?,author_id,text?,audio_asset_id?,transcript?,audience enum(author_only,family),status enum(draft,published,withdrawn),created_at,published_at?)`.

Author-only responses are invisible to other family members, including curator through product APIs. Operational privileged access must be narrowly limited, audited and honestly described; do not imply end-to-end encryption if absent. Curator cannot change audience without author's explicit approval. Require text or audio. Sharing to Birthday Book requires a separate clear approval or recorded scope allowing reuse.

## Acceptance

Skip is as prominent as answer; no nag or missed-response indicators. Test audience boundaries, author deletion, permission denial, accidental navigation warning while unsaved recording, transcript correction and family reuse consent. No private response sent to external AI by default. No response generated on her behalf. Optional module ships only if she expresses interest and a support person can help with setup.
