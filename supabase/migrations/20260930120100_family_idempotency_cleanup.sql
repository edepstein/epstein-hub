-- Idempotent retries: a client-generated request id per author/owner means an interrupted
-- upload or a double-clicked submit can be retried without duplicate posts or media.
alter table public.family_posts add column client_request_id uuid;
create unique index family_posts_client_request_idx
  on public.family_posts (author_id, client_request_id) where client_request_id is not null;

alter table public.family_media add column client_request_id uuid;
create unique index family_media_client_request_idx
  on public.family_media (owner_id, client_request_id) where client_request_id is not null;

-- Orphan cleanup (grace period 24 hours by default): reserved or failed uploads that never
-- reached a post or book entry are marked deleted. Storage objects under deleted media are no
-- longer readable by any member (policies require a non-deleted media row) and are removed by
-- the owner's storage cleanup step documented in docs/FAMILY-SPACE.md.
-- Service role / SQL editor only (e.g. scheduled with pg_cron).
create function public.cleanup_orphan_family_media(p_grace interval default interval '24 hours')
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.family_media m
     set processing_status = 'deleted'
   where m.processing_status in ('reserved', 'failed')
     and m.created_at < now() - p_grace
     and not exists (select 1 from public.family_post_media pm where pm.media_id = m.id)
     and not exists (select 1 from public.book_entries e where e.media_id = m.id);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke all on function public.cleanup_orphan_family_media(interval) from public, anon, authenticated;

-- Soft deletes through PostgREST: the API reads the row back (RETURNING), so the new row must
-- stay visible to the actor who deleted it. Authors and curators may therefore see their own
-- deleted posts/media; readers (viewers) never do. Queries filter deleted items out explicitly.
drop policy posts_select on public.family_posts;
create policy posts_select on public.family_posts for select to authenticated
  using (
    (status = 'published' and public.has_family_role(family_id, 'viewer'))
    or (author_id = auth.uid() and public.has_family_role(family_id, 'contributor'))
    or public.has_family_role(family_id, 'curator')
  );

drop policy media_select on public.family_media;
create policy media_select on public.family_media for select to authenticated
  using (
    (owner_id = auth.uid() and public.has_family_role(family_id, 'contributor'))
    or public.has_family_role(family_id, 'curator')
    or (
      public.has_family_role(family_id, 'viewer')
      and processing_status = 'ready' and consent_status = 'approved'
      and public.media_is_shared(id)
    )
  );

-- Download permission for media the caller can see: true only when the latest active consent
-- record allows downloads. Readers cannot read consent records themselves (they may hold private
-- notes), so this exposes just the flag.
create function public.media_download_flags(p_ids uuid[])
returns table (media_id uuid, allowed boolean)
language sql stable security definer set search_path = ''
as $$
  select m.id,
         coalesce((
           select c.download_allowed from public.consent_records c
           where c.media_id = m.id and c.withdrawn_at is null
           order by c.recorded_at desc limit 1
         ), false)
  from public.family_media m
  where m.id = any (p_ids)
    and m.processing_status = 'ready'
    and m.consent_status = 'approved'
    and (
      public.has_family_role(m.family_id, 'curator')
      or (m.owner_id = auth.uid() and public.has_family_role(m.family_id, 'contributor'))
      or (public.has_family_role(m.family_id, 'viewer') and public.media_is_shared(m.id))
    )
$$;
revoke all on function public.media_download_flags(uuid[]) from public, anon, authenticated;
grant execute on function public.media_download_flags(uuid[]) to authenticated;
