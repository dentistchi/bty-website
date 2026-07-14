-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — EVENT ENGINE V1. A manager-facing orchestration layer ON TOP of
-- the existing room/queue engine. Isolated bty-karaoke Supabase project
-- (ref zycwaqignioawtqynopj). No BTY core tables. Same access model as prior
-- migrations: the browser NEVER talks to Supabase; every read/write goes through
-- server routes on the service-role key. RLS stays default-deny.
--
-- Additive + idempotent (safe to re-run; never regresses v0 / 2C / admin-pin):
--   1. karaoke_events        — the user-facing "event" that OWNS one room
--   2. create_karaoke_event  — ONE transactional RPC: create room + event
--        (+ optional first session) atomically, so a mid-way failure can never
--        leave an orphan room or event. Pre-hashed dj_secret only; the raw room
--        master credential never reaches Postgres.
--
-- DJ enrollment REUSES karaoke_pairing_tokens (one-use, hash-only, short TTL).
-- Live-gating REUSES karaoke_sessions (a night; guests submit only while active).
-- No new DJ-enrollment table is introduced.

create extension if not exists pgcrypto;

-- EVENTS --------------------------------------------------------------------
-- One event owns exactly one room (1:1 in V1). `public_code` is the short, human
-- code (no confusable chars); `guest_slug` is the pretty guest-URL segment. Both
-- are unique so a code/slug maps to exactly one event. Status drives the
-- lifecycle; ending an event blocks new guest requests but preserves history.
create table if not exists public.karaoke_events (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.karaoke_rooms(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  host_name   text check (host_name is null or char_length(host_name) <= 80),
  public_code text not null unique,
  guest_slug  text not null unique,
  status      text not null default 'active'
                check (status in ('draft', 'active', 'ended', 'archived')),
  starts_at   timestamptz,
  ended_at    timestamptz,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Hot paths: the manager "tonight's events" list (newest first) and room lookup.
create index if not exists karaoke_events_created_idx
  on public.karaoke_events (created_at desc);
create index if not exists karaoke_events_status_idx
  on public.karaoke_events (status, created_at desc);
create index if not exists karaoke_events_room_idx
  on public.karaoke_events (room_id);

-- RLS: default-deny (only the server's service_role reads/writes).
alter table public.karaoke_events enable row level security;
revoke all on public.karaoke_events from anon, authenticated;

-- Keep updated_at honest: a BEFORE UPDATE trigger stamps it on EVERY update, so
-- the column is never a misleading timestamp that silently never changes.
create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists karaoke_events_touch_updated_at on public.karaoke_events;
create trigger karaoke_events_touch_updated_at
  before update on public.karaoke_events
  for each row execute function public.touch_updated_at();

-- ATOMIC EVENT CREATION -----------------------------------------------------
-- All writes commit together (a function body is one transaction) or roll back
-- together, so a failed insert can never leave an orphan room or event. Receives
-- ONLY the pre-hashed room master credential; the raw credential never reaches
-- Postgres. A unique violation on the room slug / public_code / guest_slug
-- propagates (SQLSTATE 23505) so the caller can retry with a fresh code.
create or replace function public.create_karaoke_event(
  p_room_slug     text,
  p_display_name  text,
  p_dj_secret_hash text,
  p_name          text,
  p_host_name     text,
  p_public_code   text,
  p_guest_slug    text,
  p_created_by    text,
  p_start_session boolean
) returns table (event_id uuid, room_id uuid)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_room_id  uuid;
  v_event_id uuid;
begin
  insert into public.karaoke_rooms (slug, display_name, status, dj_secret)
       values (p_room_slug, p_display_name, 'open', p_dj_secret_hash)
    returning id into v_room_id;

  insert into public.karaoke_events
         (room_id, name, host_name, public_code, guest_slug, status, starts_at, created_by)
       values (
         v_room_id, p_name, p_host_name, p_public_code, p_guest_slug,
         case when p_start_session then 'active' else 'draft' end,
         case when p_start_session then now() else null end,
         p_created_by
       )
    returning id into v_event_id;

  if p_start_session then
    insert into public.karaoke_sessions (room_id, status)
         values (v_room_id, 'active');
  end if;

  return query select v_event_id, v_room_id;
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.create_karaoke_event(
  text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.create_karaoke_event(
  text, text, text, text, text, text, text, text, boolean
) to service_role;
