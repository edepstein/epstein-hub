# Family Window

## Goal and release dependency

An invite-only place to receive photographs and short family updates. She gets full value by reading; posting and replying are optional. Requires shared privacy/security baseline in README, real approved assets and a named curator. No advertising, public discovery, social ranking or follower counts.

## Journeys and UI

1. Signed-in home shows latest published card and birthday collection link. “Family” navigation leads to chronological feed; date grouping uses family's supplied timezone.
2. Card: image with authored alt text, contributor's approved display name, short caption, publication date, optional audio/transcript and replies. Expand lengthy text without losing position.
3. “Favourite” saves a private in-site bookmark. “Download photo” is separate, shown only when asset permission permits it; explain this saves a copy on the device.
4. Reply composer defaults to text. Recording requires deliberate action and just-in-time microphone permission; permission denial leaves text available. Preview/delete recording before upload. No automatic recording.
5. Contributor: choose asset, caption, preview, save draft, submit/publish per family policy. Show upload progress and prevent duplicate submission. Curator can edit presentation, reject or withdraw a post.
6. Viewer sees no draft upload affordance. Curator first-use state invites adding genuine content, not generating memories.

Feed uses stable cursor pagination; newest-first, accessible “Load more”, return restores scroll. No autoplay and no endless compulsory scroll. Birthday collection remains prominent when feed is quiet.

## Data

- `posts(id, family_id, author_id, caption text, status enum(draft,pending,published,withdrawn), published_at?, created_at, updated_at, version int)`.
- `post_assets(post_id, family_id, asset_id, position int)` unique position; tenant-safe FKs.
- `replies(id, family_id, post_id, author_id, text?, audio_asset_id?, status enum(published,withdrawn), created_at)`; require text or audio, approved media only.
- `favourites(family_id,user_id,post_id,created_at)` unique per viewer/post; visible only to owner.
- `family_preferences(family_id, contributor_publish_policy enum(review_required,direct), download_policy enum(per_asset,disabled))`.
- Optional `notification_preferences(family_id,user_id,enabled bool,frequency enum(weekly,per_post))`; disabled initially. Email content must not contain private images/captions; authenticated link only. Do not build notifications unless delivery/opt-out is tested.

Viewer reads published records only. Contributor modifies own unpublished drafts, replies and favourites; curator moderates all family content. Approval or withdrawal must cascade to visibility of linked items. Optimistic concurrency/version conflicts display “This was changed elsewhere” with reload, never silently discard edits.

## Acceptance

- Fresh authorised viewer can open, read and reply with keyboard and phone.
- Signed-out preview reveals no family information.
- Pending posts stay hidden to viewers; another contributor cannot query drafts.
- Upload interrupted halfway can retry without duplicate post/assets; orphan upload cleanup job has documented grace period.
- Media link expiry refreshes successfully for active membership and fails after revocation.
- Empty and quiet feed remain welcoming, without promised updates or fictitious relatives.
- Delete/withdraw post removes it from feed, favourites and any module that embeds it; assets follow documented shared-reference/deletion policy.
- Loading/retry retains caption draft locally only on a known device; never leak private draft text into global logs or public storage.

## Content prerequisite

Suggested seed: 20–30 selected photographs with genuine short captions, five birthday messages and three memories, all permission checked. Numbers are targets, not presumed supplied. Release smaller if complete and meaningful; never pad with generated family stories.
