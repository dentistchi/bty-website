-- DEBT-1 reproducibility alignment: track `validation_approved_at`.
-- This column exists in the live schema (added out-of-band) but was absent from
-- tracked migrations, so a fresh/reset environment built only from migrations would
-- lack it and silently break pending->awaiting-QR + action-lifecycle dedupe.
-- Exact live type re-measured this run via PostgREST OpenAPI catalog introspection:
--   timestamp with time zone (timestamptz), nullable, no default.
-- Live already has the column, so applying this is a no-op; the live ALTER / apply is
-- a separate Commander-approved step (no `supabase db push` in this dispatch).

alter table public.bty_action_contracts
  add column if not exists validation_approved_at timestamptz null;
