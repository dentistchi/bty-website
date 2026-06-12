-- T-6h Action Contract Reminder: idempotency stamp for the reminder cron.
-- One reminder per contract; cron claims a row by setting this non-null under a
-- `is null` guard before dispatching the notification (race-safe, at-most-once).
-- Live ALTER is run by Commander in Supabase SQL Editor; this file is repaired
-- to applied (no `supabase db push`).

alter table public.bty_action_contracts
  add column if not exists last_reminder_sent_at timestamptz null;

comment on column public.bty_action_contracts.last_reminder_sent_at is
  'Set by /api/cron/action-contract-reminder when the T-6h reminder was dispatched; null = not yet reminded. Idempotency guard.';
