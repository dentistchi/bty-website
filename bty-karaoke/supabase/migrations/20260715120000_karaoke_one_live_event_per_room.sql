-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — UNIFIED EVENT OWNERSHIP V5 (Increment 2A). Enforce the core
-- invariant so a room can never hold two live groups at once:
--
--   AT MOST ONE live (draft | active) Event per room.
--
-- Ended / archived Events may coexist as history (they are not "live"), so a
-- reused home room (e.g. bty-home) accumulates one live Event at a time plus its
-- past ended Events. This is exactly what makes the canonical live-event resolver
-- deterministic (index-guaranteed single row) and makes concurrent auto-ensure
-- calls race-safe (the loser hits a 23505 and re-reads the winner).
--
-- Additive + idempotent (safe to re-run; never regresses prior migrations).
-- Rollback: drop index if exists public.karaoke_events_one_live_per_room;
--
-- Pre-apply verification (2026-07-15, production ref zycwaqignioawtqynopj):
--   0 rooms currently have >1 live Event → no reconciliation needed.
create unique index if not exists karaoke_events_one_live_per_room
  on public.karaoke_events (room_id)
  where status in ('draft', 'active');
