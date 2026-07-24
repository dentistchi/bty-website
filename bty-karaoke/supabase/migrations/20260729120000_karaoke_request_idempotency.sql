-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — GUEST QUEUE REQUEST IDEMPOTENCY V1 (BUILD 18B). Makes a guest song
-- request replay-safe: a retried submission of the SAME logical request (after a lost or
-- timed-out response) can never create a duplicate queue row. Isolated bty-karaoke
-- Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent; never rewrites,
-- backfills, deduplicates, or regresses any existing karaoke_requests row.
--
-- Product decisions encoded here:
--   * idempotency_key is NULLABLE. Every legacy/no-key row stays valid and is NEVER
--     deduplicated — the partial index constrains ONLY rows that carry a key.
--   * Uniqueness is scoped to the LOGICAL REQUEST CONTEXT (room + event + key). event_id
--     is nullable (legacy eventless rooms), so the index keys on
--     coalesce(event_id, all-zero uuid): two null-event rows with the same (room, key)
--     still collide correctly, and this works on EVERY Postgres version (no reliance on
--     NULLS NOT DISTINCT). Client keys are per-logical-request UUIDs; there is no global
--     unique-key convention for guest requests, so the room+event context is the safe
--     dedup boundary.
--   * The server INSERTs normally; a unique violation (23505) is caught and the existing
--     row is returned as a successful REPLAY when the payload matches, or a stable
--     idempotency_conflict when the same key was reused for a different song/guest.
--   * No RPC, no trigger, no data mutation. Rooms / Events / Queue / current-song /
--     playback / metering / Timed Pass are untouched. No existing row is backfilled or
--     deduplicated.
--
-- Rollback:
--   drop index if exists public.karaoke_requests_idem_unique_idx;
--   alter table public.karaoke_requests drop column if exists idempotency_key;

-- 1. NULLABLE KEY COLUMN (legacy rows stay valid) ----------------------------
alter table public.karaoke_requests
  add column if not exists idempotency_key text;

-- 2. PARTIAL UNIQUE INDEX (only when a key is present) ------------------------
-- At most one row per (room, event-context, idempotency_key) WHEN a key is present.
-- Partial: legacy NULL-key rows are unconstrained (any number allowed), so existing data
-- and every no-key insert are completely unaffected. The coalesce sentinel makes a null
-- event a single bucket per room (gen_random_uuid never yields the all-zero uuid).
create unique index if not exists karaoke_requests_idem_unique_idx
  on public.karaoke_requests
     (room_id, coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid), idempotency_key)
  where idempotency_key is not null;
