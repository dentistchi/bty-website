-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- Chi Karaoke V0 — schema for the ISOLATED bty-karaoke Supabase project.
-- Project ref: zycwaqignioawtqynopj. No BTY core tables live here.
--
-- Access model: the browser NEVER talks to Supabase directly. All reads and
-- writes go through server API routes using the service-role key. RLS is
-- enabled default-deny as defense-in-depth (service_role bypasses RLS; anon /
-- authenticated get nothing). No XP / score / rank columns exist by design.

create extension if not exists pgcrypto;

-- ROOMS ---------------------------------------------------------------------
create table if not exists public.karaoke_rooms (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  display_name  text not null,
  status        text not null default 'open' check (status in ('open','closed')),
  dj_secret     text not null,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

-- REQUESTS ------------------------------------------------------------------
create table if not exists public.karaoke_requests (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references public.karaoke_rooms(id) on delete cascade,
  guest_name            text not null check (char_length(guest_name) between 1 and 40),
  search_query          text,
  youtube_video_id      text not null,
  youtube_title         text,
  youtube_channel_title text,
  youtube_thumbnail_url text,
  position              integer not null,
  status                text not null default 'waiting'
                          check (status in ('waiting','playing','completed','skipped','removed')),
  created_at            timestamptz not null default now(),
  started_at            timestamptz,
  completed_at          timestamptz
);

create index if not exists karaoke_requests_queue_idx
  on public.karaoke_requests (room_id, status, position);
create index if not exists karaoke_requests_created_idx
  on public.karaoke_requests (room_id, created_at);

-- RLS: default-deny. Only the server (service_role) reads/writes.
alter table public.karaoke_rooms    enable row level security;
alter table public.karaoke_requests enable row level security;

revoke all on public.karaoke_rooms    from anon, authenticated;
revoke all on public.karaoke_requests from anon, authenticated;
