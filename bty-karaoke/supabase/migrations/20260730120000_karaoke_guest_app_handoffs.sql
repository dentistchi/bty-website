-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — GUEST-TO-APP OPAQUE HANDOFF INFRASTRUCTURE V1 (BUILD 19B). Lets a SUCCESSFUL
-- guest song request mint a short-lived, opaque, navigation-only handoff so a Universal Link
-- (norebang.btydaily.com/app/join/{token}) can later open the SAME Room/Event in the native
-- Guest destination (BUILD 19A). Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj).
-- Additive + idempotent; never rewrites/backfills/deduplicates any existing row.
--
-- Product/security decisions encoded here:
--   * The RAW token is NEVER stored: only its SHA-256 hash (token_hash) is persisted and
--     indexed, exactly like the DJ pairing / admin-setup token pattern. The raw token is
--     returned once to the authorized creation caller and otherwise discarded.
--   * A handoff is navigation context, NOT authentication. It grants NO Host/Manager/pass
--     authority and cannot mutate the source request, Event, Room, ownership, or usage.
--   * Scoped to ONE Room + ONE Event, tied to ONE successful source request. source_request_id
--     is UNIQUE (V1): repeated creation for the same request returns the SAME canonical row.
--   * TTL is set by the app (default 24h); expires_at > created_at is enforced. Expiry is lazy
--     (resolved against server time; a status flip is app-driven — no cron, no trigger).
--   * Reopenable during validity: open_count / first_opened_at / last_opened_at track opens;
--     repeated opens never create a duplicate durable object.
--   * Append-only audit table records privacy-clean lifecycle events (no raw token, no identity).
--
-- Depends on: karaoke_rooms, karaoke_events, karaoke_requests, karaoke_sessions.
--
-- Rollback:
--   drop table if exists public.karaoke_guest_app_handoff_audit;
--   drop table if exists public.karaoke_guest_app_handoffs;

-- 1. HANDOFF ENTITY -----------------------------------------------------------
create table if not exists public.karaoke_guest_app_handoffs (
  id                      uuid primary key default gen_random_uuid(),
  -- SHA-256 hex of the raw token. The raw token is never stored. Unique so a token maps to
  -- at most one handoff and lookup is a single indexed probe.
  token_hash              text not null unique,
  room_id                 uuid not null references public.karaoke_rooms(id) on delete cascade,
  event_id                uuid not null references public.karaoke_events(id) on delete cascade,
  -- One handoff per successful source request (V1): repeated creation returns the same row.
  source_request_id       uuid not null unique references public.karaoke_requests(id) on delete cascade,
  -- The guest night session the source request was accepted under (nullable / legacy-safe).
  source_guest_session_id uuid references public.karaoke_sessions(id) on delete set null,
  created_at              timestamptz not null default now(),
  expires_at              timestamptz not null,
  first_opened_at         timestamptz,
  last_opened_at          timestamptz,
  open_count              int not null default 0 check (open_count >= 0),
  status                  text not null default 'ACTIVE'
                            check (status in ('ACTIVE', 'EXPIRED', 'REVOKED')),
  revoked_at              timestamptz,
  -- The timeline is always honest: a live token has a future expiry; a revoked one is stamped.
  constraint handoff_expiry_after_creation check (expires_at > created_at),
  constraint handoff_revoked_time check (
    (status = 'REVOKED') = (revoked_at is not null)
  )
);

-- Hot reads: resolve-by-token (unique above), and lazy-expiry sweeps by window.
create index if not exists karaoke_handoff_expiry_idx
  on public.karaoke_guest_app_handoffs (expires_at) where status = 'ACTIVE';
create index if not exists karaoke_handoff_room_event_idx
  on public.karaoke_guest_app_handoffs (room_id, event_id);

alter table public.karaoke_guest_app_handoffs enable row level security;
revoke all on table public.karaoke_guest_app_handoffs from public, anon, authenticated;
grant select, insert, update on table public.karaoke_guest_app_handoffs to service_role;

-- 2. APPEND-ONLY AUDIT --------------------------------------------------------
-- Privacy-clean lifecycle log. NEVER stores the raw token, guest name, or any identity.
create table if not exists public.karaoke_guest_app_handoff_audit (
  id                uuid primary key default gen_random_uuid(),
  handoff_id        uuid references public.karaoke_guest_app_handoffs(id) on delete cascade,
  room_id           uuid,
  event_id          uuid,
  source_request_id uuid,
  event_type        text not null
                      check (event_type in ('CREATED', 'OPENED', 'RESOLVED', 'EXPIRED', 'INVALID', 'ROOM_ENTERED')),
  result            text,
  platform          text,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists karaoke_handoff_audit_handoff_idx
  on public.karaoke_guest_app_handoff_audit (handoff_id, created_at desc);

alter table public.karaoke_guest_app_handoff_audit enable row level security;
revoke all on table public.karaoke_guest_app_handoff_audit from public, anon, authenticated;
grant select, insert on table public.karaoke_guest_app_handoff_audit to service_role;

create or replace function public.karaoke_guest_app_handoff_audit_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'karaoke_guest_app_handoff_audit is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function public.karaoke_guest_app_handoff_audit_immutable() from public, anon, authenticated;
drop trigger if exists karaoke_guest_app_handoff_audit_no_mutate on public.karaoke_guest_app_handoff_audit;
create trigger karaoke_guest_app_handoff_audit_no_mutate
  before update or delete on public.karaoke_guest_app_handoff_audit
  for each row execute function public.karaoke_guest_app_handoff_audit_immutable();
