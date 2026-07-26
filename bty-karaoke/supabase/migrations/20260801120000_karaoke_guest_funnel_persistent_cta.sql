-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — PERSISTENT WEB-TO-APP ENTRY CTA (BUILD 19C). Additive + idempotent: widen the
-- karaoke_guest_funnel_events.event_type allow-list to include the two PERSISTENT CTA touchpoints,
-- recorded SEPARATELY from the one-time invitation events (never merged). Touches no other table,
-- rewrites and backfills nothing, preserves every existing row. Isolated bty-karaoke Supabase
-- project (ref zycwaqignioawtqynopj). Mirrors the single source of truth in
-- src/domain/app-invite.ts (GUEST_FUNNEL_EVENTS) — the DB CHECK is kept in sync manually.
--
-- The original CHECK is an inline, Postgres-auto-named column constraint
-- (karaoke_guest_funnel_events_event_type_check). Dropping-if-exists then re-adding the widened
-- constraint is idempotent (safe to re-run) and keeps the append-only/privacy contract intact.
--
-- Rollback (narrow the allow-list back to the one-time set):
--   alter table public.karaoke_guest_funnel_events
--     drop constraint if exists karaoke_guest_funnel_events_event_type_check;
--   alter table public.karaoke_guest_funnel_events
--     add constraint karaoke_guest_funnel_events_event_type_check
--     check (event_type in ('INVITE_ELIGIBLE','INVITE_SHOWN','APP_OPEN_TAPPED','APP_STORE_TAPPED','CONTINUE_WEB'));

alter table public.karaoke_guest_funnel_events
  drop constraint if exists karaoke_guest_funnel_events_event_type_check;

alter table public.karaoke_guest_funnel_events
  add constraint karaoke_guest_funnel_events_event_type_check
  check (event_type in (
    'INVITE_ELIGIBLE',
    'INVITE_SHOWN',
    'APP_OPEN_TAPPED',
    'APP_STORE_TAPPED',
    'CONTINUE_WEB',
    'PERSISTENT_APP_CTA_SHOWN',
    'PERSISTENT_APP_CTA_TAPPED'
  ));
