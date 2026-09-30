-- Word Club private family space (Batch 8).
--
-- Canonical names follow docs/03 + docs/07 of the build pack:
--   memberships -> family_memberships, invitations -> family_invites, assets -> family_media,
--   posts -> family_posts, comments -> family_comments (replies).
-- Every private table carries family_id, has RLS enabled and is scoped by an active membership.
-- Cross-family references use composite (id, family_id) foreign keys so they cannot mix families.
-- No policy grants anything to the anon role. Puzzle editors (editor_roles) are separate from
-- family curators and grant no family powers.

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.family_role as enum ('viewer', 'contributor', 'curator'); -- ordered: viewer < contributor < curator
create type public.family_membership_status as enum ('active', 'revoked');
create type public.family_post_status as enum ('draft', 'submitted', 'published', 'withdrawn', 'deleted');
create type public.family_media_kind as enum ('image', 'audio');
create type public.family_media_processing as enum ('reserved', 'ready', 'failed', 'deleted');
create type public.family_consent_status as enum ('pending', 'approved', 'withdrawn');
create type public.family_book_entry_kind as enum ('letter', 'photo', 'story');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  -- Supplied by the owner. Never guessed; null until configured.
  recipient_name text check (recipient_name is null or char_length(recipient_name) between 1 and 80),
  birthday_date date,
  timezone text not null default 'Europe/London',
  contributor_publish_policy text not null default 'review_required'
    check (contributor_publish_policy in ('review_required')),
  is_fictional_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_memberships (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.family_role not null default 'viewer',
  status public.family_membership_status not null default 'active',
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (family_id, user_id)
);
create index family_memberships_user_idx on public.family_memberships (user_id);

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  invited_email text not null check (invited_email = lower(btrim(invited_email)) and invited_email like '%_@_%'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  role public.family_role not null default 'viewer',
  -- sha256 hex of the single-use secret. The raw token is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  unique (id, family_id)
);
create index family_invites_family_idx on public.family_invites (family_id, created_at desc);

create table public.family_media (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind public.family_media_kind not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 600),
  alt_text text check (alt_text is null or char_length(alt_text) <= 300),
  consent_status public.family_consent_status not null default 'pending',
  processing_status public.family_media_processing not null default 'reserved',
  -- Private bucket object key: <family_id>/<media_id>. Original filenames are never stored.
  storage_path text generated always as (family_id::text || '/' || id::text) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, family_id),
  check (
    (kind = 'image' and mime_type in ('image/jpeg', 'image/png', 'image/webp') and byte_size <= 10485760)
    or (kind = 'audio' and mime_type in ('audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm') and byte_size <= 31457280)
  ),
  check (kind <> 'image' or processing_status <> 'ready' or (width is not null and height is not null and alt_text is not null and char_length(btrim(alt_text)) > 0))
);
create index family_media_family_idx on public.family_media (family_id, created_at desc);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  media_id uuid,
  recorded_by uuid not null references auth.users (id) on delete cascade,
  -- The actual permission or rights basis, in the recorder's words. A checkbox alone is not enough.
  permission_basis text not null check (char_length(btrim(permission_basis)) between 10 and 500),
  people_pictured_confirmed boolean not null,
  restrictions text check (restrictions is null or char_length(restrictions) <= 500),
  download_allowed boolean not null default false,
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (id, family_id),
  foreign key (media_id, family_id) references public.family_media (id, family_id) on delete cascade
);
create index consent_records_media_idx on public.consent_records (media_id);

create table public.family_posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  caption text not null check (char_length(caption) <= 500),
  status public.family_post_status not null default 'draft',
  version integer not null default 1,
  submitted_at timestamptz,
  published_at timestamptz,
  withdrawn_at timestamptz,
  deleted_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);
create index family_posts_feed_idx on public.family_posts (family_id, status, published_at desc, id desc);

create table public.family_post_media (
  post_id uuid not null,
  family_id uuid not null,
  media_id uuid not null,
  position smallint not null default 0 check (position between 0 and 9),
  primary key (post_id, position),
  unique (post_id, media_id),
  foreign key (post_id, family_id) references public.family_posts (id, family_id) on delete cascade,
  foreign key (media_id, family_id) references public.family_media (id, family_id) on delete cascade
);
create index family_post_media_media_idx on public.family_post_media (media_id);

create table public.family_comments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  post_id uuid not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (post_id, family_id) references public.family_posts (id, family_id) on delete cascade
);
create index family_comments_post_idx on public.family_comments (post_id, created_at);

create table public.family_favourites (
  family_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id),
  foreign key (post_id, family_id) references public.family_posts (id, family_id) on delete cascade
);

-- Birthday Book: curator-owned drafts (chapters/entries) and immutable published snapshots.
create table public.family_books (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  dedication text check (dedication is null or char_length(dedication) <= 2000),
  published_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

create table public.book_chapters (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  book_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  position integer not null,
  created_at timestamptz not null default now(),
  unique (id, family_id),
  unique (book_id, position) deferrable initially deferred,
  foreign key (book_id, family_id) references public.family_books (id, family_id) on delete cascade
);

create table public.book_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  chapter_id uuid not null,
  kind public.family_book_entry_kind not null,
  heading text check (heading is null or char_length(heading) <= 160),
  body text check (body is null or char_length(body) <= 5000),
  media_id uuid,
  contributor_credit text check (contributor_credit is null or char_length(contributor_credit) <= 120),
  position integer not null,
  created_at timestamptz not null default now(),
  unique (chapter_id, position) deferrable initially deferred,
  foreign key (chapter_id, family_id) references public.book_chapters (id, family_id) on delete cascade,
  foreign key (media_id, family_id) references public.family_media (id, family_id) on delete restrict,
  check ((kind = 'photo' and media_id is not null) or (kind <> 'photo' and body is not null and char_length(btrim(body)) > 0))
);

create table public.book_snapshots (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  book_id uuid not null,
  version integer not null,
  content jsonb not null,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (book_id, version),
  unique (id, family_id),
  foreign key (book_id, family_id) references public.family_books (id, family_id) on delete cascade
);

-- Media referenced by a published snapshot (lets members fetch those photos).
create table public.book_snapshot_media (
  snapshot_id uuid not null,
  family_id uuid not null,
  media_id uuid not null,
  primary key (snapshot_id, media_id),
  foreign key (snapshot_id, family_id) references public.book_snapshots (id, family_id) on delete cascade,
  foreign key (media_id, family_id) references public.family_media (id, family_id) on delete cascade
);

create table public.book_progress (
  family_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null,
  chapter_index integer not null check (chapter_index >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id),
  foreign key (book_id, family_id) references public.family_books (id, family_id) on delete cascade
);

-- No raw captions, message bodies, emails or token values are ever written here.
create table public.audit_events (
  id bigint generated always as identity primary key,
  family_id uuid references public.families (id) on delete cascade,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  occurred_at timestamptz not null default now()
);
create index audit_events_family_idx on public.audit_events (family_id, occurred_at desc);

-- Puzzle-editor roles. Deliberately unrelated to family curators.
create table public.editor_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'reviewer', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER, fixed search_path). They read family_memberships with
-- the owner's rights, so policies on family_memberships can call them without recursion.
-- ---------------------------------------------------------------------------------------------
create function public.family_role_for(p_family_id uuid)
returns public.family_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.family_memberships m
  where m.family_id = p_family_id and m.user_id = auth.uid() and m.status = 'active'
$$;

create function public.has_family_role(p_family_id uuid, p_min public.family_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select m.role >= p_min from public.family_memberships m
    where m.family_id = p_family_id and m.user_id = auth.uid() and m.status = 'active'
  ), false)
$$;

revoke all on function public.family_role_for(uuid) from public, anon, authenticated;
revoke all on function public.has_family_role(uuid, public.family_role) from public, anon, authenticated;
grant execute on function public.family_role_for(uuid) to authenticated;
grant execute on function public.has_family_role(uuid, public.family_role) to authenticated;

-- Is this media item part of published family content (a published post or the current
-- published book)? Definer so the media policy does not recurse through post-media policies.
create function public.media_is_shared(p_media_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.family_post_media pm
    join public.family_posts p on p.id = pm.post_id and p.family_id = pm.family_id
    where pm.media_id = p_media_id and p.status = 'published'
  ) or exists (
    select 1 from public.book_snapshot_media sm
    join public.book_snapshots s on s.id = sm.snapshot_id
    join public.family_books b on b.id = s.book_id and b.published_version = s.version
    where sm.media_id = p_media_id
  )
$$;
revoke all on function public.media_is_shared(uuid) from public, anon, authenticated;
grant execute on function public.media_is_shared(uuid) to authenticated;

create function public.safe_uuid(p text)
returns uuid language plpgsql immutable set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end
$$;

-- Audit writer used by triggers and definer functions.
create function public.write_audit(p_family_id uuid, p_action text, p_target_type text, p_target_id text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_events (family_id, actor_id, action, target_type, target_id)
  values (p_family_id, auth.uid(), p_action, p_target_type, p_target_id)
$$;
revoke all on function public.write_audit(uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------------------------
create function public.tg_touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger families_touch before update on public.families
  for each row execute function public.tg_touch_updated_at();
create trigger family_books_touch before update on public.family_books
  for each row execute function public.tg_touch_updated_at();

create function public.tg_membership_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id or new.user_id <> old.user_id then
      raise exception 'immutable_field' using errcode = '42501';
    end if;
    new.updated_at := now();
    if new.status = 'revoked' and old.status = 'active' then
      new.revoked_at := now();
    elsif new.status = 'active' then
      new.revoked_at := null;
    end if;
    -- A family must keep at least one active curator.
    if old.role = 'curator' and old.status = 'active' and (new.role <> 'curator' or new.status <> 'active') then
      if not exists (
        select 1 from public.family_memberships m
        where m.family_id = old.family_id and m.user_id <> old.user_id and m.role = 'curator' and m.status = 'active'
      ) then
        raise exception 'last_curator' using errcode = 'P0001';
      end if;
    end if;
    if new.role <> old.role or new.status <> old.status then
      perform public.write_audit(new.family_id, 'membership.' || case when new.status <> old.status then new.status::text else 'role:' || new.role::text end, 'membership', new.user_id::text);
    end if;
  end if;
  return new;
end
$$;
create trigger family_memberships_guard before update on public.family_memberships
  for each row execute function public.tg_membership_guard();

create function public.tg_media_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.family_id <> old.family_id or new.owner_id <> old.owner_id or new.kind <> old.kind or new.id <> old.id then
    raise exception 'immutable_field' using errcode = '42501';
  end if;
  -- Only a curator may change consent once recorded as approved/withdrawn, and only the
  -- server upload path (owner) moves reserved -> ready/failed.
  if new.processing_status = 'deleted' and old.processing_status <> 'deleted' then
    new.deleted_at := now();
    perform public.write_audit(new.family_id, 'media.deleted', 'media', new.id::text);
  end if;
  if new.consent_status = 'withdrawn' and old.consent_status <> 'withdrawn' then
    perform public.write_audit(new.family_id, 'media.consent_withdrawn', 'media', new.id::text);
  end if;
  new.updated_at := now();
  return new;
end
$$;
create trigger family_media_guard before update on public.family_media
  for each row execute function public.tg_media_guard();

create function public.tg_post_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'invalid_status' using errcode = '42501';
    end if;
    new.version := 1;
    new.published_at := null;
    new.withdrawn_at := null;
    new.deleted_at := null;
    new.reviewed_by := null;
    new.submitted_at := case when new.status = 'submitted' then now() end;
    return new;
  end if;
  if new.family_id <> old.family_id or new.author_id <> old.author_id or new.id <> old.id then
    raise exception 'immutable_field' using errcode = '42501';
  end if;
  if old.status = 'deleted' then
    raise exception 'post_deleted' using errcode = 'P0001';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  if new.status <> old.status then
    case new.status
      when 'submitted' then new.submitted_at := now();
      when 'published' then new.published_at := now(); new.reviewed_by := auth.uid(); new.withdrawn_at := null;
      when 'withdrawn' then new.withdrawn_at := now(); new.reviewed_by := auth.uid();
      when 'deleted' then new.deleted_at := now();
      else null;
    end case;
    perform public.write_audit(new.family_id, 'post.' || new.status::text, 'post', new.id::text);
  else
    -- Timestamps are server-controlled.
    new.published_at := old.published_at;
    new.submitted_at := old.submitted_at;
    new.withdrawn_at := old.withdrawn_at;
    new.deleted_at := old.deleted_at;
    new.reviewed_by := old.reviewed_by;
  end if;
  return new;
end
$$;
create trigger family_posts_guard before insert or update on public.family_posts
  for each row execute function public.tg_post_guard();

create function public.tg_invite_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.accepted_at := null;
    new.accepted_by := null;
    new.revoked_at := null;
    new.created_at := now();
    if (select count(*) from public.family_invites i where i.invited_by = new.invited_by and i.created_at > now() - interval '1 hour') >= 20 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    perform public.write_audit(new.family_id, 'invite.created', 'invite', new.id::text);
    return new;
  end if;
  if new.family_id <> old.family_id or new.token_hash <> old.token_hash or new.invited_email <> old.invited_email
     or new.role <> old.role or new.expires_at <> old.expires_at or new.invited_by <> old.invited_by then
    raise exception 'immutable_field' using errcode = '42501';
  end if;
  if new.revoked_at is not null and old.revoked_at is null then
    perform public.write_audit(new.family_id, 'invite.revoked', 'invite', new.id::text);
  end if;
  return new;
end
$$;
create trigger family_invites_guard before insert or update on public.family_invites
  for each row execute function public.tg_invite_guard();

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
alter table public.families enable row level security;
alter table public.family_memberships enable row level security;
alter table public.family_invites enable row level security;
alter table public.family_media enable row level security;
alter table public.consent_records enable row level security;
alter table public.family_posts enable row level security;
alter table public.family_post_media enable row level security;
alter table public.family_comments enable row level security;
alter table public.family_favourites enable row level security;
alter table public.family_books enable row level security;
alter table public.book_chapters enable row level security;
alter table public.book_entries enable row level security;
alter table public.book_snapshots enable row level security;
alter table public.book_snapshot_media enable row level security;
alter table public.book_progress enable row level security;
alter table public.audit_events enable row level security;
alter table public.editor_roles enable row level security;

-- families
create policy families_select on public.families for select to authenticated
  using (public.has_family_role(id, 'viewer'));
create policy families_update on public.families for update to authenticated
  using (public.has_family_role(id, 'curator')) with check (public.has_family_role(id, 'curator'));

-- memberships: members see the member list of their own family (display names for credits).
create policy memberships_select on public.family_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_family_role(family_id, 'viewer'));
create policy memberships_update on public.family_memberships for update to authenticated
  using (public.has_family_role(family_id, 'curator'))
  with check (public.has_family_role(family_id, 'curator'));
-- No insert/delete policies: memberships are created only by accept_family_invite().

-- invites: curator only.
create policy invites_select on public.family_invites for select to authenticated
  using (public.has_family_role(family_id, 'curator'));
create policy invites_insert on public.family_invites for insert to authenticated
  with check (public.has_family_role(family_id, 'curator') and invited_by = auth.uid());
create policy invites_update on public.family_invites for update to authenticated
  using (public.has_family_role(family_id, 'curator') and accepted_at is null)
  with check (public.has_family_role(family_id, 'curator'));

-- posts
create policy posts_select on public.family_posts for select to authenticated
  using (
    (status = 'published' and public.has_family_role(family_id, 'viewer'))
    or (author_id = auth.uid() and status <> 'deleted' and public.has_family_role(family_id, 'contributor'))
    or (status <> 'deleted' and public.has_family_role(family_id, 'curator'))
  );
create policy posts_insert on public.family_posts for insert to authenticated
  with check (author_id = auth.uid() and public.has_family_role(family_id, 'contributor'));
create policy posts_update_author on public.family_posts for update to authenticated
  using (author_id = auth.uid() and status in ('draft', 'submitted') and public.has_family_role(family_id, 'contributor'))
  with check (author_id = auth.uid() and status in ('draft', 'submitted', 'deleted'));
create policy posts_update_curator on public.family_posts for update to authenticated
  using (public.has_family_role(family_id, 'curator'))
  with check (public.has_family_role(family_id, 'curator'));

-- media: visible when you own it, you curate, or it is part of published family content.
create policy media_select on public.family_media for select to authenticated
  using (
    processing_status <> 'deleted' and (
      (owner_id = auth.uid() and public.has_family_role(family_id, 'contributor'))
      or public.has_family_role(family_id, 'curator')
      or (
        public.has_family_role(family_id, 'viewer')
        and processing_status = 'ready' and consent_status = 'approved'
        and public.media_is_shared(id)
      )
    )
  );
create policy media_insert on public.family_media for insert to authenticated
  with check (
    owner_id = auth.uid() and processing_status = 'reserved' and consent_status = 'pending'
    and public.has_family_role(family_id, 'contributor')
  );
create policy media_update_owner on public.family_media for update to authenticated
  using (owner_id = auth.uid() and processing_status <> 'deleted' and public.has_family_role(family_id, 'contributor'))
  with check (owner_id = auth.uid() and consent_status in ('pending', 'withdrawn'));
create policy media_update_curator on public.family_media for update to authenticated
  using (public.has_family_role(family_id, 'curator'))
  with check (public.has_family_role(family_id, 'curator'));

-- consent records: the recorder and curators.
create policy consent_select on public.consent_records for select to authenticated
  using ((recorded_by = auth.uid() and public.has_family_role(family_id, 'contributor')) or public.has_family_role(family_id, 'curator'));
create policy consent_insert on public.consent_records for insert to authenticated
  with check (
    recorded_by = auth.uid() and withdrawn_at is null and public.has_family_role(family_id, 'contributor')
    and (media_id is null or exists (
      select 1 from public.family_media m where m.id = media_id and m.family_id = consent_records.family_id
        and (m.owner_id = auth.uid() or public.has_family_role(m.family_id, 'curator'))
    ))
  );
create policy consent_update on public.consent_records for update to authenticated
  using ((recorded_by = auth.uid() and public.has_family_role(family_id, 'contributor')) or public.has_family_role(family_id, 'curator'))
  with check (withdrawn_at is not null);

-- post media links: follow the post.
create policy post_media_select on public.family_post_media for select to authenticated
  using (exists (select 1 from public.family_posts p where p.id = post_id));
create policy post_media_insert on public.family_post_media for insert to authenticated
  with check (
    exists (select 1 from public.family_posts p where p.id = post_id and p.family_id = family_post_media.family_id
            and p.author_id = auth.uid() and p.status in ('draft', 'submitted'))
    and exists (select 1 from public.family_media m where m.id = media_id and m.family_id = family_post_media.family_id
                and m.owner_id = auth.uid())
    and public.has_family_role(family_id, 'contributor')
  );
create policy post_media_delete on public.family_post_media for delete to authenticated
  using (
    exists (select 1 from public.family_posts p where p.id = post_id and p.author_id = auth.uid() and p.status in ('draft', 'submitted'))
    or public.has_family_role(family_id, 'curator')
  );

-- replies: any member may reply to a published post; authors soft-delete their own.
create policy comments_select on public.family_comments for select to authenticated
  using (public.has_family_role(family_id, 'viewer') and exists (select 1 from public.family_posts p where p.id = post_id and p.status = 'published'));
create policy comments_insert on public.family_comments for insert to authenticated
  with check (
    author_id = auth.uid() and deleted_at is null and public.has_family_role(family_id, 'viewer')
    and exists (select 1 from public.family_posts p where p.id = post_id and p.family_id = family_comments.family_id and p.status = 'published')
  );
create policy comments_update on public.family_comments for update to authenticated
  using ((author_id = auth.uid() and public.has_family_role(family_id, 'viewer')) or public.has_family_role(family_id, 'curator'))
  with check (deleted_at is not null);

-- favourites: private to their owner.
create policy favourites_select on public.family_favourites for select to authenticated
  using (user_id = auth.uid() and public.has_family_role(family_id, 'viewer'));
create policy favourites_insert on public.family_favourites for insert to authenticated
  with check (
    user_id = auth.uid() and public.has_family_role(family_id, 'viewer')
    and exists (select 1 from public.family_posts p where p.id = post_id and p.family_id = family_favourites.family_id and p.status = 'published')
  );
create policy favourites_delete on public.family_favourites for delete to authenticated
  using (user_id = auth.uid());

-- book: curator composes; every member reads the published snapshot.
create policy books_select on public.family_books for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
create policy books_insert on public.family_books for insert to authenticated
  with check (public.has_family_role(family_id, 'curator') and published_version = 0);
create policy books_update on public.family_books for update to authenticated
  using (public.has_family_role(family_id, 'curator')) with check (public.has_family_role(family_id, 'curator'));

create policy chapters_all on public.book_chapters for all to authenticated
  using (public.has_family_role(family_id, 'curator')) with check (public.has_family_role(family_id, 'curator'));
create policy entries_all on public.book_entries for all to authenticated
  using (public.has_family_role(family_id, 'curator')) with check (public.has_family_role(family_id, 'curator'));

create policy snapshots_select on public.book_snapshots for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
create policy snapshot_media_select on public.book_snapshot_media for select to authenticated
  using (public.has_family_role(family_id, 'viewer'));
-- Snapshots are written only by publish_family_book().

create policy progress_select on public.book_progress for select to authenticated
  using (user_id = auth.uid() and public.has_family_role(family_id, 'viewer'));
create policy progress_insert on public.book_progress for insert to authenticated
  with check (user_id = auth.uid() and public.has_family_role(family_id, 'viewer'));
create policy progress_update on public.book_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_family_role(family_id, 'viewer'));

create policy audit_select on public.audit_events for select to authenticated
  using (public.has_family_role(family_id, 'curator'));

create policy editor_roles_select on public.editor_roles for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Privileges: nothing for anon; authenticated gets table privileges gated by RLS above.
-- ---------------------------------------------------------------------------------------------
revoke all on table
  public.families, public.family_memberships, public.family_invites, public.family_media,
  public.consent_records, public.family_posts, public.family_post_media, public.family_comments,
  public.family_favourites, public.family_books, public.book_chapters, public.book_entries,
  public.book_snapshots, public.book_snapshot_media, public.book_progress, public.audit_events,
  public.editor_roles
from anon, authenticated;

grant select, update on public.families to authenticated;
grant select on public.family_memberships to authenticated;
grant update (role, status, display_name) on public.family_memberships to authenticated;
grant select, insert, update on public.family_invites to authenticated;
grant select, insert on public.family_media to authenticated;
grant update (alt_text, consent_status, processing_status, width, height, duration_seconds, byte_size) on public.family_media to authenticated;
grant select, insert, update on public.consent_records to authenticated;
grant select, insert, update on public.family_posts to authenticated;
grant select, insert, delete on public.family_post_media to authenticated;
grant select, insert on public.family_comments to authenticated;
grant update (deleted_at) on public.family_comments to authenticated;
grant select, insert, delete on public.family_favourites to authenticated;
grant select, insert, update on public.family_books to authenticated;
grant select, insert, update, delete on public.book_chapters to authenticated;
grant select, insert, update, delete on public.book_entries to authenticated;
grant select on public.book_snapshots, public.book_snapshot_media to authenticated;
grant select, insert, update on public.book_progress to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.editor_roles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPC functions
-- ---------------------------------------------------------------------------------------------

-- Accept an invitation. The opaque token alone is not enough: the signed-in account's email
-- must be confirmed and equal the invited address.
create function public.accept_family_invite(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_invite public.family_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 128 then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  select * into v_invite from public.family_invites
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite_used' using errcode = 'P0001';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_confirmed is null then
    raise exception 'email_unverified' using errcode = 'P0001';
  end if;
  if v_email is distinct from v_invite.invited_email then
    raise exception 'invite_email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.family_memberships (family_id, user_id, role, status, display_name)
  values (v_invite.family_id, v_uid, v_invite.role, 'active', v_invite.display_name)
  on conflict (family_id, user_id) do update
    set status = 'active', role = excluded.role, display_name = excluded.display_name;

  update public.family_invites set accepted_at = now(), accepted_by = v_uid where id = v_invite.id;
  perform public.write_audit(v_invite.family_id, 'invite.accepted', 'invite', v_invite.id::text);
  return v_invite.family_id;
end
$$;
revoke all on function public.accept_family_invite(text) from public, anon, authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;

-- Publish the current draft book as an immutable snapshot (atomic: viewers never see a
-- half-reordered book). Invoker rights: RLS decides what the caller can read and the explicit
-- curator check decides whether they may publish.
create function public.publish_family_book(p_book_id uuid)
returns integer
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_book public.family_books%rowtype;
  v_content jsonb;
  v_version integer;
  v_snapshot uuid;
  v_problem text;
begin
  select * into v_book from public.family_books where id = p_book_id for update;
  if not found or not public.has_family_role(v_book.family_id, 'curator') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.book_chapters c where c.book_id = p_book_id) then
    raise exception 'book_empty' using errcode = 'P0001';
  end if;
  select c.title into v_problem from public.book_chapters c
    where c.book_id = p_book_id and not exists (select 1 from public.book_entries e where e.chapter_id = c.id)
    limit 1;
  if v_problem is not null then
    raise exception 'chapter_empty' using errcode = 'P0001', detail = v_problem;
  end if;
  if exists (
    select 1 from public.book_entries e join public.book_chapters c on c.id = e.chapter_id
    join public.family_media m on m.id = e.media_id
    where c.book_id = p_book_id and (m.processing_status <> 'ready' or m.consent_status <> 'approved')
  ) then
    raise exception 'media_not_ready' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'title', v_book.title,
    'dedication', v_book.dedication,
    'chapters', coalesce(jsonb_agg(ch order by ch_pos), '[]'::jsonb)
  ) into v_content
  from (
    select c.position as ch_pos, jsonb_build_object(
      'title', c.title,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'kind', e.kind, 'heading', e.heading, 'body', e.body, 'mediaId', e.media_id,
          'altText', m.alt_text, 'width', m.width, 'height', m.height, 'credit', e.contributor_credit
        ) order by e.position)
        from public.book_entries e left join public.family_media m on m.id = e.media_id
        where e.chapter_id = c.id
      ), '[]'::jsonb)
    ) as ch
    from public.book_chapters c where c.book_id = p_book_id
  ) chapters;

  v_version := v_book.published_version + 1;
  -- Snapshot rows are written with definer helper below (members have no insert privilege).
  v_snapshot := public.write_book_snapshot(v_book.family_id, p_book_id, v_version, v_content);
  update public.family_books set published_version = v_version where id = p_book_id;
  return v_version;
end
$$;

create function public.write_book_snapshot(p_family_id uuid, p_book_id uuid, p_version integer, p_content jsonb)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_family_role(p_family_id, 'curator') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.family_books b where b.id = p_book_id and b.family_id = p_family_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.book_snapshots (family_id, book_id, version, content, published_by)
  values (p_family_id, p_book_id, p_version, p_content, auth.uid())
  returning id into v_id;
  insert into public.book_snapshot_media (snapshot_id, family_id, media_id)
  select distinct v_id, p_family_id, e.media_id
  from public.book_entries e join public.book_chapters c on c.id = e.chapter_id
  where c.book_id = p_book_id and c.family_id = p_family_id and e.media_id is not null;
  perform public.write_audit(p_family_id, 'book.published', 'book', p_book_id::text);
  return v_id;
end
$$;
revoke all on function public.write_book_snapshot(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.publish_family_book(uuid) from public, anon, authenticated;
grant execute on function public.write_book_snapshot(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.publish_family_book(uuid) to authenticated;

-- Swap chapter positions atomically (deferred unique constraint).
create function public.move_book_chapter(p_chapter_id uuid, p_direction integer)
returns void
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_ch public.book_chapters%rowtype;
  v_other public.book_chapters%rowtype;
begin
  select * into v_ch from public.book_chapters where id = p_chapter_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_direction < 0 then
    select * into v_other from public.book_chapters where book_id = v_ch.book_id and position < v_ch.position order by position desc limit 1;
  else
    select * into v_other from public.book_chapters where book_id = v_ch.book_id and position > v_ch.position order by position asc limit 1;
  end if;
  if not found then
    return;
  end if;
  update public.book_chapters set position = v_other.position where id = v_ch.id;
  update public.book_chapters set position = v_ch.position where id = v_other.id;
end
$$;
revoke all on function public.move_book_chapter(uuid, integer) from public, anon, authenticated;
grant execute on function public.move_book_chapter(uuid, integer) to authenticated;

create function public.move_book_entry(p_entry_id uuid, p_direction integer)
returns void
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_e public.book_entries%rowtype;
  v_other public.book_entries%rowtype;
begin
  select * into v_e from public.book_entries where id = p_entry_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_direction < 0 then
    select * into v_other from public.book_entries where chapter_id = v_e.chapter_id and position < v_e.position order by position desc limit 1;
  else
    select * into v_other from public.book_entries where chapter_id = v_e.chapter_id and position > v_e.position order by position asc limit 1;
  end if;
  if not found then
    return;
  end if;
  update public.book_entries set position = v_other.position where id = v_e.id;
  update public.book_entries set position = v_e.position where id = v_other.id;
end
$$;
revoke all on function public.move_book_entry(uuid, integer) from public, anon, authenticated;
grant execute on function public.move_book_entry(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Private storage bucket. Objects live at <family_id>/<media_id>; access is decided by the
-- family_media row (evaluated under the caller's RLS), so a guessed path grants nothing.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-media', 'family-media', false, 31457280,
        array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'])
on conflict (id) do update set public = false;

create policy family_media_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'family-media'
    and exists (
      select 1 from public.family_media m
      where m.family_id = public.safe_uuid(split_part(name, '/', 1))
        and m.id = public.safe_uuid(split_part(name, '/', 2))
        and m.storage_path = name
    )
  );
create policy family_media_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and exists (
      select 1 from public.family_media m
      where m.family_id = public.safe_uuid(split_part(name, '/', 1))
        and m.id = public.safe_uuid(split_part(name, '/', 2))
        and m.storage_path = name
        and m.owner_id = auth.uid()
        and m.processing_status = 'reserved'
        and public.has_family_role(m.family_id, 'contributor')
    )
  );
create policy family_media_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'family-media'
    and exists (
      select 1 from public.family_media m
      where m.family_id = public.safe_uuid(split_part(name, '/', 1))
        and m.id = public.safe_uuid(split_part(name, '/', 2))
        and m.storage_path = name
        and (m.owner_id = auth.uid() or public.has_family_role(m.family_id, 'curator'))
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Moderation: approve (publish) or withdraw a post with optimistic concurrency. Approval is the
-- curator's review of the recorded permission, so it also marks the linked media consent approved.
-- ---------------------------------------------------------------------------------------------
create function public.moderate_family_post(p_post_id uuid, p_action text, p_version integer)
returns integer
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_post public.family_posts%rowtype;
  v_version integer;
begin
  select * into v_post from public.family_posts where id = p_post_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.has_family_role(v_post.family_id, 'curator') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_version is not null and v_post.version <> p_version then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  if p_action = 'approve' then
    if v_post.status not in ('submitted', 'withdrawn') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.family_post_media pm join public.family_media m on m.id = pm.media_id
      where pm.post_id = p_post_id and (m.processing_status <> 'ready' or m.consent_status = 'withdrawn')
    ) then
      raise exception 'media_not_ready' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.family_post_media pm
      where pm.post_id = p_post_id and not exists (
        select 1 from public.consent_records c where c.media_id = pm.media_id and c.withdrawn_at is null
      )
    ) then
      raise exception 'consent_missing' using errcode = 'P0001';
    end if;
    if char_length(btrim(v_post.caption)) = 0 and not exists (select 1 from public.family_post_media pm where pm.post_id = p_post_id) then
      raise exception 'post_empty' using errcode = 'P0001';
    end if;
    update public.family_media m set consent_status = 'approved'
      from public.family_post_media pm where pm.post_id = p_post_id and pm.media_id = m.id;
    update public.family_posts set status = 'published' where id = p_post_id returning version into v_version;
  elsif p_action = 'withdraw' then
    if v_post.status not in ('published', 'submitted') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.family_posts set status = 'withdrawn' where id = p_post_id returning version into v_version;
  elsif p_action = 'delete' then
    update public.family_posts set status = 'deleted' where id = p_post_id returning version into v_version;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  return v_version;
end
$$;
revoke all on function public.moderate_family_post(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.moderate_family_post(uuid, text, integer) to authenticated;

-- Owner bootstrap (run from the Supabase SQL editor / service role only; never exposed to members).
create function public.bootstrap_family(p_title text, p_curator_user_id uuid, p_curator_display_name text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.families (title) values (p_title) returning id into v_id;
  insert into public.family_memberships (family_id, user_id, role, status, display_name)
  values (v_id, p_curator_user_id, 'curator', 'active', p_curator_display_name);
  insert into public.audit_events (family_id, actor_id, action, target_type, target_id)
  values (v_id, null, 'family.bootstrapped', 'family', v_id::text);
  return v_id;
end
$$;
revoke all on function public.bootstrap_family(text, uuid, text) from public, anon, authenticated;
