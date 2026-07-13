-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang STEP 2C — pairing + device sessions + karaoke sessions.
-- Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj). No BTY core
-- tables. Same access model as v0: the browser NEVER talks to Supabase; every
-- read/write goes through server routes on the service-role key. RLS stays
-- default-deny (service_role bypasses; anon/authenticated get nothing).
--
-- Adds, all additive and idempotent (safe to re-run, never regresses v0):
--   1. karaoke_sessions       — a "karaoke night" per room (<=1 active at a time)
--   2. karaoke_dj_devices     — durable paired DJ/Admin device sessions (hash only)
--   3. karaoke_pairing_tokens — one-use, short-lived pairing tokens (hash only)
--   4. karaoke_requests.session_id — stamp each request with its night

create extension if not exists pgcrypto;

-- SESSIONS ------------------------------------------------------------------
-- A karaoke night. Guests can only submit while a session is active; ending a
-- night blocks new requests but preserves history. At most one active per room.
create table if not exists public.karaoke_sessions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.karaoke_rooms(id) on delete cascade,
  status      text not null default 'active' check (status in ('active','ended')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- Enforce "at most one active session per room" at the DB level (partial unique).
create unique index if not exists karaoke_sessions_one_active_idx
  on public.karaoke_sessions (room_id)
  where status = 'active';

create index if not exists karaoke_sessions_room_idx
  on public.karaoke_sessions (room_id, started_at desc);

-- DJ / ADMIN DEVICES --------------------------------------------------------
-- A durable device session established by pairing (or admin bootstrap). We store
-- ONLY the SHA-256 hash of the opaque device token; the raw token lives only in
-- the paired device's localStorage. Revoking a row (or rotating) blocks that
-- device immediately on the next authenticated call.
create table if not exists public.karaoke_dj_devices (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.karaoke_rooms(id) on delete cascade,
  role          text not null default 'dj' check (role in ('dj','admin')),
  label         text not null default 'DJ device',
  token_hash    text not null unique,
  status        text not null default 'active' check (status in ('active','revoked')),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index if not exists karaoke_dj_devices_room_idx
  on public.karaoke_dj_devices (room_id, status);

-- PAIRING TOKENS ------------------------------------------------------------
-- One-use, high-entropy pairing tokens minted by Admin. Only the hash is stored.
-- Redemption is atomic (conditional UPDATE on redeemed_at IS NULL AND not expired),
-- so concurrent double-redeem yields exactly one winner.
create table if not exists public.karaoke_pairing_tokens (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.karaoke_rooms(id) on delete cascade,
  token_hash         text not null unique,
  role               text not null default 'dj' check (role in ('dj','admin')),
  label              text,
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now(),
  redeemed_at        timestamptz,
  redeemed_device_id uuid references public.karaoke_dj_devices(id) on delete set null
);

create index if not exists karaoke_pairing_tokens_room_idx
  on public.karaoke_pairing_tokens (room_id, expires_at);

-- REQUESTS: link to the night it belongs to --------------------------------
alter table public.karaoke_requests
  add column if not exists session_id uuid
    references public.karaoke_sessions(id) on delete set null;

create index if not exists karaoke_requests_session_idx
  on public.karaoke_requests (session_id);

-- RLS: default-deny for every new table (service_role bypasses).
alter table public.karaoke_sessions       enable row level security;
alter table public.karaoke_dj_devices     enable row level security;
alter table public.karaoke_pairing_tokens enable row level security;

revoke all on public.karaoke_sessions       from anon, authenticated;
revoke all on public.karaoke_dj_devices     from anon, authenticated;
revoke all on public.karaoke_pairing_tokens from anon, authenticated;
