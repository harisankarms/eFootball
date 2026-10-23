-- =====================================================================
--  Squad League - database setup
--
--  Paste this whole file into Supabase -> SQL Editor -> New query -> Run.
--  It is safe to run again later (for example after an update):
--  it never deletes your data.
-- =====================================================================


-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  user_id     uuid unique references auth.users (id) on delete set null,
  avatar_url  text,
  is_admin    boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id               uuid primary key default gen_random_uuid(),
  played_at        timestamptz not null default now(),
  home_id          uuid not null references public.players (id),
  away_id          uuid not null references public.players (id),
  home_goals       smallint not null check (home_goals between 0 and 99),
  away_goals       smallint not null check (away_goals between 0 and 99),
  pens_winner_id   uuid references public.players (id),
  home_team        text check (char_length(home_team) <= 40),
  away_team        text check (char_length(away_team) <= 40),
  notes            text check (char_length(notes) <= 280),
  screenshot_path  text,
  thumb_path       text,
  submitted_by     uuid references public.players (id),
  status           text not null default 'ok' check (status in ('ok', 'disputed')),
  dispute_reason   text check (char_length(dispute_reason) <= 200),
  disputed_by      uuid references public.players (id),
  created_at       timestamptz not null default now(),
  constraint different_players check (home_id <> away_id),
  constraint pens_only_after_a_draw check (
    pens_winner_id is null
    or (home_goals = away_goals and pens_winner_id in (home_id, away_id))
  )
);

create index if not exists matches_played_at_idx on public.matches (played_at desc);
create index if not exists matches_home_id_idx on public.matches (home_id);
create index if not exists matches_away_id_idx on public.matches (away_id);

-- One row of group-wide settings. The admin edits these from the Admin page.
create table if not exists public.settings (
  id                  int primary key default 1 check (id = 1),
  group_name          text not null default 'Squad League' check (char_length(group_name) between 1 and 40),
  timezone            text not null default 'Asia/Kolkata',
  potw_win            numeric not null default 3 check (potw_win >= 0),
  potw_draw           numeric not null default 1 check (potw_draw >= 0),
  potw_goal           numeric not null default 0.5 check (potw_goal >= 0),
  potw_clean_sheet    numeric not null default 1 check (potw_clean_sheet >= 0),
  potw_min_matches    int not null default 3 check (potw_min_matches between 0 and 50),
  require_screenshot  boolean not null default true,
  dispute_hours       int not null default 24 check (dispute_hours between 1 and 168)
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- People who signed in but are not in the squad yet. The admin approves them.
create table if not exists public.join_requests (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
--  Helper functions
-- ---------------------------------------------------------------------

-- The squad player linked to the signed-in account (null if none).
create or replace function public.my_player_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.players where user_id = auth.uid() and active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.players where user_id = auth.uid() and active),
    false
  )
$$;

-- Called by the app after every sign-in. Returns the caller's player, or null
-- if they are waiting for approval. The very first account becomes the admin.
create or replace function public.link_my_player()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.players;
  u_email text;
  u_meta jsonb;
  display_name text;
begin
  if uid is null then
    return null;
  end if;

  select * into p from public.players where user_id = uid;
  if found then
    return to_jsonb(p);
  end if;

  select email, coalesce(raw_user_meta_data, '{}'::jsonb)
    into u_email, u_meta
    from auth.users
   where id = uid;

  display_name := left(coalesce(
    nullif(trim(u_meta ->> 'full_name'), ''),
    nullif(trim(u_meta ->> 'name'), ''),
    nullif(split_part(u_email, '@', 1), ''),
    'Player'
  ), 40);

  if not exists (select 1 from public.players where is_admin) then
    insert into public.players (name, user_id, avatar_url, is_admin)
    values (display_name, uid, u_meta ->> 'avatar_url', true)
    returning * into p;
    return to_jsonb(p);
  end if;

  insert into public.join_requests (user_id, email, name, avatar_url)
  values (uid, u_email, display_name, u_meta ->> 'avatar_url')
  on conflict (user_id) do nothing;

  return null;
end;
$$;

-- Admin: let a waiting account in, either as a brand-new player or linked to
-- an existing player that has no account yet.
create or replace function public.approve_join(p_user_id uuid, p_player_id uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r public.join_requests;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can approve players';
  end if;

  select * into r from public.join_requests where user_id = p_user_id;
  if not found then
    raise exception 'That join request no longer exists';
  end if;

  if p_player_id is null then
    insert into public.players (name, user_id, avatar_url)
    values (coalesce(r.name, 'Player'), r.user_id, r.avatar_url);
  else
    update public.players
       set user_id = r.user_id,
           avatar_url = coalesce(avatar_url, r.avatar_url)
     where id = p_player_id
       and user_id is null;
    if not found then
      raise exception 'That player is already linked to another account';
    end if;
  end if;

  delete from public.join_requests where user_id = p_user_id;
end;
$$;

-- The other player in a match can flag it within the dispute window.
-- Disputed matches stop counting until an admin resolves them.
create or replace function public.dispute_match(p_match_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  m public.matches;
  me uuid := public.my_player_id();
  window_hours int;
begin
  select dispute_hours into window_hours from public.settings where id = 1;

  select * into m from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found';
  end if;

  if me is null or me not in (m.home_id, m.away_id) or me = m.submitted_by then
    raise exception 'Only the other player in this match can dispute it';
  end if;

  if m.created_at < now() - make_interval(hours => window_hours) then
    raise exception 'The % hour dispute window has closed', window_hours;
  end if;

  update public.matches
     set status = 'disputed',
         dispute_reason = left(nullif(trim(p_reason), ''), 200),
         disputed_by = me
   where id = p_match_id;
end;
$$;

create or replace function public.update_my_name(p_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_name is null or char_length(trim(p_name)) not between 1 and 40 then
    raise exception 'Name must be between 1 and 40 characters';
  end if;
  update public.players set name = trim(p_name) where user_id = auth.uid();
end;
$$;


-- ---------------------------------------------------------------------
--  Row level security: who may read and change what
--  Everyone can view. Squad members add results. Admins manage the rest.
-- ---------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.settings enable row level security;
alter table public.join_requests enable row level security;

drop policy if exists "Anyone can view players" on public.players;
create policy "Anyone can view players" on public.players
  for select using (true);

drop policy if exists "Admins add players" on public.players;
create policy "Admins add players" on public.players
  for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins edit players" on public.players;
create policy "Admins edit players" on public.players
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins remove players" on public.players;
create policy "Admins remove players" on public.players
  for delete to authenticated using (public.is_admin());

drop policy if exists "Anyone can view matches" on public.matches;
create policy "Anyone can view matches" on public.matches
  for select using (true);

drop policy if exists "Squad members add matches" on public.matches;
create policy "Squad members add matches" on public.matches
  for insert to authenticated
  with check (
    submitted_by = public.my_player_id()
    and status = 'ok'
    and disputed_by is null
  );

drop policy if exists "Admins edit matches" on public.matches;
create policy "Admins edit matches" on public.matches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins or the submitter delete matches" on public.matches;
create policy "Admins or the submitter delete matches" on public.matches
  for delete to authenticated
  using (
    public.is_admin()
    or (
      submitted_by = public.my_player_id()
      and created_at > now() - make_interval(hours => (select dispute_hours from public.settings where id = 1))
    )
  );

drop policy if exists "Anyone can view settings" on public.settings;
create policy "Anyone can view settings" on public.settings
  for select using (true);

drop policy if exists "Admins change settings" on public.settings;
create policy "Admins change settings" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins and the requester view join requests" on public.join_requests;
create policy "Admins and the requester view join requests" on public.join_requests
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

drop policy if exists "Admins dismiss join requests" on public.join_requests;
create policy "Admins dismiss join requests" on public.join_requests
  for delete to authenticated using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.players, public.matches, public.settings to anon, authenticated;
grant insert, update, delete on public.players, public.matches to authenticated;
grant update on public.settings to authenticated;
grant select, delete on public.join_requests to authenticated;
grant execute on function
  public.my_player_id(),
  public.is_admin(),
  public.link_my_player(),
  public.approve_join(uuid, uuid),
  public.dispute_match(uuid, text),
  public.update_my_name(text)
  to anon, authenticated;


-- ---------------------------------------------------------------------
--  Screenshot storage (public bucket, max 3 MB per file)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view screenshots" on storage.objects;
create policy "Anyone can view screenshots" on storage.objects
  for select using (bucket_id = 'screenshots');

drop policy if exists "Squad members upload screenshots" on storage.objects;
create policy "Squad members upload screenshots" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'screenshots' and public.my_player_id() is not null);

drop policy if exists "Admins or the uploader delete screenshots" on storage.objects;
create policy "Admins or the uploader delete screenshots" on storage.objects
  for delete to authenticated
  using (bucket_id = 'screenshots' and (public.is_admin() or owner_id = (auth.uid())::text));


-- ---------------------------------------------------------------------
--  Live updates: everyone's screen refreshes when a result is added
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
     ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
