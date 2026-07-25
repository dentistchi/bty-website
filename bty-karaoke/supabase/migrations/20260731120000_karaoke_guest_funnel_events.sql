-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — GUEST-TO-APP WEB CONVERSION FUNNEL V1 (BUILD 19C). Append-only, privacy-clean
-- record of the WEB-side funnel touchpoints (invitation shown / app-open tapped / continue-web),
-- distinct from the BUILD 19B handoff audit (which is the authoritative source for the RESOLUTION
-- funnel: CREATED/OPENED/RESOLVED). Isolated bty-karaoke Supabase project (ref zycwaqignioawtqynopj).
-- Additive + idempotent; touches NO BUILD 19B table and rewrites/backfills nothing.
--
-- Product/privacy decisions encoded here:
--   * NO raw handoff token, guest name, email, or provider identity is ever stored — only the
--     event type + the already-public room/event/request/handoff ids for joining to the audit.
--   * Append-only (immutable trigger). Best-effort analytics: a failed insert never blocks the
--     guest flow.
--   * Analytics/reconciliation count these events + the BUILD 19B handoff audit — NEVER the
--     non-authoritative open_count (BUILD 19B finding).
--
-- Rollback:
--   drop table if exists public.karaoke_guest_funnel_events;

create table if not exists public.karaoke_guest_funnel_events (
  id                uuid primary key default gen_random_uuid(),
  event_type        text not null
                      check (event_type in ('INVITE_ELIGIBLE', 'INVITE_SHOWN', 'APP_OPEN_TAPPED', 'APP_STORE_TAPPED', 'CONTINUE_WEB')),
  -- All nullable + already-public ids (never identity). handoff_id joins to the 19B audit.
  handoff_id        uuid references public.karaoke_guest_app_handoffs(id) on delete set null,
  room_id           uuid,
  event_id          uuid,
  source_request_id uuid,
  platform          text,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists karaoke_funnel_room_event_idx
  on public.karaoke_guest_funnel_events (room_id, event_id, created_at desc);
create index if not exists karaoke_funnel_type_idx
  on public.karaoke_guest_funnel_events (event_type, created_at desc);

alter table public.karaoke_guest_funnel_events enable row level security;
revoke all on table public.karaoke_guest_funnel_events from public, anon, authenticated;
grant select, insert on table public.karaoke_guest_funnel_events to service_role;

create or replace function public.karaoke_guest_funnel_events_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'karaoke_guest_funnel_events is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function public.karaoke_guest_funnel_events_immutable() from public, anon, authenticated;
drop trigger if exists karaoke_guest_funnel_events_no_mutate on public.karaoke_guest_funnel_events;
create trigger karaoke_guest_funnel_events_no_mutate
  before update or delete on public.karaoke_guest_funnel_events
  for each row execute function public.karaoke_guest_funnel_events_immutable();
