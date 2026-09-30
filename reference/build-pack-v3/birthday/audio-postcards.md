# Audio Postcards

## Goal

Let her hear actual birthday wishes and updates from relatives. Receiving is primary; she need not record anything. Requires real recordings and explicit permission, never synthetic relatives or cloned voices.

## UX and states

Cards show supplied sender name, short title, duration, transcript and play/pause. No autoplay; starting another card pauses previous playback. Seek slider keyboard accessible, elapsed/total times announced sensibly without continuous screen-reader noise. Playback speed optional (0.75x/1x/1.25x). Large text transcript independently useful.

Contributor chooses recording or uploads approved audio. Recording: explanation → permission request → visible recording timer → stop → listen → retake/delete → submit. Denied permission suggests upload or written message. Upload/processing/failed states keep the message draft and explain retry. Caller should know that recording is not live communication. Empty state offers text messages already present, not fake audio.

## Data and permissions

`audio_postcards(id,family_id,author_id,title,body_text?,audio_asset_id,transcript text,transcript_status enum(draft,approved),status enum(draft,pending,published,withdrawn),published_at?,position?)`.

Curator approves transcript, sender credit and publication. Automated transcription is optional only with an explicitly selected processor and privacy review; transcript must be editable and reviewed before release. Do not send recordings to third-party AI by default. Supported format list, duration and upload limits match README and actual implementation.

## Acceptance

Published postcard requires approved transcript and ready/approved audio. Playback supported on recipient's actual browser/device; no autoplay. Microphone-denied, offline, failed transcode and signed-link-expired paths handled. Media requests require family membership. Record/delete does not leave published/orphan audio; cleanup policy tested. Deleted/withdrawn audio disappears from cards and related book chapters, with shared references resolved deliberately. No generated voice or fictional birthday wish in production.
