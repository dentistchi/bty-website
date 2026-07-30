-- Isolated verification prerequisites: Supabase roles + the base tables that the
-- shadow-metering (20260726) + timed-pass (20260728) + lease v2 (20260803) migrations
-- reference. Minimal column shapes matching those migrations' usage.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;

create table if not exists public.karaoke_accounts (
  id uuid primary key default gen_random_uuid(),
  timezone text,
  timezone_source text not null default 'default',
  timezone_captured_at timestamptz
);
create table if not exists public.karaoke_rooms (id uuid primary key default gen_random_uuid());
create table if not exists public.karaoke_room_ownership (room_id uuid, workspace_id uuid);
create table if not exists public.karaoke_workspace_members (
  workspace_id uuid, account_id uuid, status text not null default 'active', role text not null default 'owner'
);
create table if not exists public.karaoke_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  status text not null default 'active',
  ended_at timestamptz
);
create table if not exists public.karaoke_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  event_id uuid,
  status text not null default 'waiting',
  ready_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  position int not null default 1,
  created_at timestamptz not null default now(),
  youtube_video_id text
);
create table if not exists public.karaoke_host_plan_assignments (
  account_id uuid not null, plan_code text not null, status text not null default 'active'
);
