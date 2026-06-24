-- =============================================================================
-- Event QR — Slice 1 (BUILD 5)
--
-- Commander-LOCKED DDL. Transcribed exactly; columns/constraints not modified.
-- PRODUCTION-EFFECTIVE: single shared Supabase project backs all workers; this
-- lands on live data once applied. This file is WRITTEN only — apply is a
-- separate Commander-authorized step (snapshot before/after).
--
-- Scope: Event QR is the second official QR family. Slice 1 = 2 tables only,
-- NO org_unit / NO TII (deferred to a later slice via nullable ALTER ADD once
-- the org model is measured — not guessed here).
--   - bty_events: one row per event (creator = leader-track-approved+).
--   - bty_event_participation: one row per (event, participant scan); idempotent
--     via unique(event_id, user_id); xp snapshotted; links to activity_xp_events.
-- Core XP / avatar growth only — no band / consecutive_verified_completions
-- linkage (Commander decision). Write path = service-role (route gate).
-- =============================================================================

create table if not exists public.bty_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  event_type text not null,
  xp_value int not null,
  valid_until timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint bty_events_xp_value_check check (xp_value >= 10 and xp_value <= 100),
  constraint bty_events_status_check check (status in ('active', 'cancelled'))
);

create table if not exists public.bty_event_participation (
  id bigserial primary key,
  event_id uuid not null references public.bty_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  xp_awarded int not null,
  activity_xp_event_id bigint references public.activity_xp_events (id) on delete set null,
  constraint bty_event_participation_unique unique (event_id, user_id)
);

create index if not exists bty_events_creator_created_idx
  on public.bty_events (creator_id, created_at desc);
create index if not exists bty_event_participation_user_scanned_idx
  on public.bty_event_participation (user_id, scanned_at desc);
create index if not exists bty_event_participation_event_idx
  on public.bty_event_participation (event_id);

alter table public.bty_events enable row level security;
create policy "bty_events_select_auth" on public.bty_events
  for select to authenticated using (true);

alter table public.bty_event_participation enable row level security;
create policy "bty_event_participation_select_own" on public.bty_event_participation
  for select to authenticated using (auth.uid() = user_id);
