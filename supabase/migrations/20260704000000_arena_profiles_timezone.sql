-- STEP 1C / D1 — Schema A: capture the user's IANA timezone for user-local day-boundary
-- (05:00 user-local) computation. See src/domain/daily/userDayKey.ts + src/lib/bty/daily/userDay.ts.
--
-- Nullable on purpose: NULL = UNRESOLVED (device tz not yet captured). Per the Commander-ratified
-- fallback (UTC-for-request + recapture), the app computes that request's key on UTC and does NOT
-- write 'UTC' here — it leaves this NULL and retries capture on later Today/Account entries.
-- Validity (a real IANA id) is enforced in the app (Intl), not a CHECK constraint, to stay
-- DST/registry-safe (the IANA database changes over time).
--
-- Idempotent. Rollback: ALTER TABLE public.arena_profiles DROP COLUMN IF EXISTS timezone;

ALTER TABLE public.arena_profiles
  ADD COLUMN IF NOT EXISTS timezone text;
