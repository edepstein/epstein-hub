# Birthday Book

## Goal

A complete, browsable birthday gift that is valuable even without future contributions. Digital chapters combine supplied letters, pictures and optional recordings. Milestone age, names and dates are supplied and approved, never inferred.

## UX

Private cover with authored title, dedication and optional approved portrait. Contents page gives chapter names and item counts. Each chapter displays readable text alongside photos, with large previous/next chapter actions and a persistent contents link. Offer continuous reading as an alternative to page turns; no decorative flip animation required. Resume last chapter per user. All recordings have transcript. Photos can enlarge into a keyboard-accessible dialog with Escape and return focus.

Curator editor: arrange chapters/items; preview as viewer; validate missing assets/captions; publish explicit version. Incomplete drafts remain private to curator. Viewer empty state says book is being prepared, not a mock personal letter. Broken media retains text and retry.

## Data

- `books(id,family_id,title,dedication text?,status enum(draft,published,withdrawn),published_version int?,published_at?)`.
- `book_chapters(id,family_id,book_id,title,position int)`.
- `book_items(id,family_id,chapter_id,type enum(letter,photo,audio,story),heading?,body text?,asset_id?,position int,contributor_credit?,permission_record_id?)`.
- `book_progress(family_id,user_id,book_id,chapter_id,updated_at)`.

Use tenant-safe FKs and stable ordering. Immutable published revision or transactionally consistent snapshot avoids viewers seeing half-reordered content. Store contributor credit only as supplied. Curator owns composition, viewers read published versions.

## Print/export

Optional print view uses real text (not screenshots), chapter breaks, labelled images and audio QR/link only to authenticated private viewer. PDF generated server-side only after membership check; keep export in private storage, expire signed link. An exported/downloaded book is an independent copy and cannot be remotely withdrawn; make permission expectations explicit. Do not put secret-bearing signed asset URLs into lasting QR codes.

## Acceptance and prerequisites

Minimum launch: approved dedication plus several completed chapters or a deliberately short complete book; no empty chapter shells. Every personal claim is sourced from supplied material. Keyboard, zoom and phone layout work. Print preview has no clipped text, missing images or orphan headings. Export remains private and second-family access fails. Withdrawal of a consented asset must remove it from current book view and future exports; explain that existing downloaded copies remain outside service control. Test progress restoration and publication atomicity.
