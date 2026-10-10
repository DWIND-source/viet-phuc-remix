-- Việt Phục Remix: database schema for Supabase.
-- Paste the whole file into Supabase → SQL Editor → Run. It is safe to run again.
--
-- Tables
--   profiles  one row per account (auto-created on sign-up)
--   looks     each user's saved Lookbook, synced across devices
--   events    usage events, only sent after the visitor accepts analytics
--   admins    who may open admin.html (managed only from the SQL Editor)
--
-- Every table has Row Level Security. The browser only ever holds the public
-- anon/publishable key, so these policies are the only thing guarding the data.

create extension if not exists pgcrypto;

-- ─── admins ──────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text check (char_length(display_name) <= 80),
  lang              text not null default 'vi' check (lang in ('vi', 'en')),
  analytics_consent boolean,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, lang, analytics_consent) on public.profiles to authenticated;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile row when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, lang)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 80),
    case when new.raw_user_meta_data ->> 'lang' = 'en' then 'en' else 'vi' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── looks ───────────────────────────────────────────────────────────────────
create table if not exists public.looks (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists looks_created_idx on public.looks (created_at desc);
alter table public.looks enable row level security;
revoke all on public.looks from anon, authenticated;
grant select, insert, update, delete on public.looks to authenticated;

drop policy if exists "looks: read own or admin" on public.looks;
create policy "looks: read own or admin" on public.looks
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "looks: insert own" on public.looks;
create policy "looks: insert own" on public.looks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "looks: update own" on public.looks;
create policy "looks: update own" on public.looks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "looks: delete own" on public.looks;
create policy "looks: delete own" on public.looks
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists looks_touch on public.looks;
create trigger looks_touch before update on public.looks
  for each row execute function public.touch_updated_at();

-- ─── events ──────────────────────────────────────────────────────────────────
-- Anyone may insert (only after accepting analytics in the banner); only admins
-- may read. user_id and created_at always come from the server, never the client.
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  visitor_id uuid not null,
  session_id uuid not null,
  name       text not null check (name ~ '^[a-z][a-z_]{1,39}$'),
  data       jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2000),
  lang       text check (lang in ('vi', 'en')),
  view       text check (char_length(view) <= 20),
  device     text check (device in ('mobile', 'tablet', 'desktop'))
);
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_name_idx on public.events (name, created_at desc);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant insert (visitor_id, session_id, name, data, lang, view, device) on public.events to anon, authenticated;
grant select on public.events to authenticated;

drop policy if exists "events: anyone can insert" on public.events;
create policy "events: anyone can insert" on public.events
  for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));

drop policy if exists "events: admin read" on public.events;
create policy "events: admin read" on public.events
  for select to authenticated
  using ((select public.is_admin()));

-- ─── self-service account deletion ───────────────────────────────────────────
-- Deletes the caller's account. Profile and looks cascade; events keep no link.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ─── admin dashboard ─────────────────────────────────────────────────────────
create or replace function public.admin_overview(days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(days, 365)));
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since',        since,
    'users_total',  (select count(*) from auth.users),
    'users_new',    (select count(*) from auth.users where created_at >= since),
    'looks_total',  (select count(*) from public.looks),
    'looks_new',    (select count(*) from public.looks where created_at >= since),
    'events',       (select count(*) from public.events where created_at >= since),
    'sessions',     (select count(distinct session_id) from public.events where created_at >= since),
    'visitors',     (select count(distinct visitor_id) from public.events where created_at >= since),
    'by_name',      coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc)
                              from (select name, count(*) n from public.events where created_at >= since group by name) s), '[]'),
    'by_device',    coalesce((select jsonb_agg(jsonb_build_object('device', coalesce(device, '?'), 'n', n) order by n desc)
                              from (select device, count(distinct session_id) n from public.events where created_at >= since group by device) s), '[]'),
    'daily',        coalesce((select jsonb_agg(jsonb_build_object('day', d, 'sessions', s, 'events', e) order by d)
                              from (select (created_at at time zone 'Asia/Ho_Chi_Minh')::date d, count(distinct session_id) s, count(*) e
                                    from public.events where created_at >= since group by 1) x), '[]'),
    'top_garments', coalesce((select jsonb_agg(jsonb_build_object('id', k, 'n', n) order by n desc)
                              from (select data ->> 'garment' k, count(*) n from public.looks where created_at >= since group by 1) s where k is not null), '[]'),
    'top_occasions', coalesce((select jsonb_agg(jsonb_build_object('id', k, 'n', n) order by n desc)
                              from (select data ->> 'event' k, count(*) n from public.looks where created_at >= since group by 1) s where k is not null), '[]'),
    'recent_users', coalesce((select jsonb_agg(r order by r.created_at desc) from (
                                select u.id, u.email, p.display_name, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null as confirmed,
                                       (select count(*) from public.looks l where l.user_id = u.id) as looks
                                from auth.users u left join public.profiles p on p.id = u.id
                                order by u.created_at desc limit 100) r), '[]')
  );
end $$;
revoke execute on function public.admin_overview(int) from public, anon;
grant execute on function public.admin_overview(int) to authenticated;

-- ─── make yourself admin ─────────────────────────────────────────────────────
-- After you have signed up on the site, run this once with your own email:
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
