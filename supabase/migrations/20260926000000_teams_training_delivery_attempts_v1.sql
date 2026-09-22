-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Teams Training Delivery — ATTEMPT EVIDENCE. V1
--
-- PRODUCTION-EFFECTIVE. Idempotent, replay-safe, ADDITIVE ONLY: one new
-- server-only table. No existing table, column, grant, policy or row is touched.
--
-- WHY THIS EXISTS, MEASURED.
--
--   foundry_teams_training_deliveries        0
--   foundry_teams_training_sessions          0
--   bty_teams_conversation_creation_claims   0
--   bty_teams_conversation_refs              2  (untouched in the last 6 hours)
--
-- A training that was never delivered and a training whose delivery FAILED look
-- exactly the same from those numbers, because the send pipeline writes its
-- delivery row only AFTER Graph validation and conversation resolution have both
-- succeeded. Every refusal before that point — an ineligible recipient, a tenant
-- with no verified route, an app that is not installed for the person — left no
-- durable trace at all. The Host saw a sentence and the database learned nothing.
--
-- So this records ONE ROW PER (recipient, stage) OUTCOME, whether it succeeded or
-- not. It is diagnostic evidence, and that is the whole of its job:
--
--   * it grants no authority and is read by no authorization path;
--   * it decides nothing about delivery, identity, scoring or completion;
--   * it is append-only in practice — nothing updates a recorded attempt.
--
-- WHAT IT DELIBERATELY DOES NOT HOLD. No token, no email, no UPN, no serviceUrl,
-- no conversation id, no request or response body. `microsoft_failure_code` is
-- the short symbolic code Microsoft returns (e.g. `BotNotInConversationRoster`),
-- already sanitised by the existing Connector classifier — never a message, never
-- a challenge header, never a payload.
--
-- Rollback:  DROP TABLE IF EXISTS public.foundry_teams_training_delivery_attempts;
-- =============================================================================

create table if not exists public.foundry_teams_training_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events (id) on delete cascade,
  owner_user_id_snapshot uuid not null references auth.users (id) on delete restrict,
  -- The VERIFIED Microsoft identity the attempt was aimed at. Text, matching every
  -- other Microsoft-identity column in this schema.
  tenant_id text not null,
  aad_object_id text not null,
  -- Presentation only, so an operator reading this can tell who it was about.
  display_name_snapshot text,
  -- WHICH BOUNDARY this row is about.
  stage text not null,
  -- WHAT HAPPENED there, in product terms.
  result text not null,
  -- Microsoft's own short code, when the Connector classifier extracted one.
  microsoft_failure_code text,
  created_at timestamptz not null default now(),
  constraint foundry_teams_delivery_attempts_stage_check
    check (stage in ('graph_validation', 'conversation_resolution', 'card_send')),
  constraint foundry_teams_delivery_attempts_result_check
    check (result in (
      'eligible', 'not_eligible', 'not_installed',
      'conversation_failed', 'send_failed', 'delivery_unknown', 'delivered'
    )),
  constraint foundry_teams_delivery_attempts_identity_guid_check
    check (
      tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and aad_object_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  constraint foundry_teams_delivery_attempts_display_name_len_check
    check (display_name_snapshot is null or char_length(btrim(display_name_snapshot)) between 1 and 120),
  -- Defence in depth: a symbolic code is short. Anything longer is a payload leaking in.
  constraint foundry_teams_delivery_attempts_failure_code_len_check
    check (microsoft_failure_code is null or char_length(btrim(microsoft_failure_code)) between 1 and 80)
);

comment on table public.foundry_teams_training_delivery_attempts is
  'Teams Training Delivery V1 — DIAGNOSTIC evidence only. One row per (recipient, stage) outcome, '
  'recorded whether it succeeded or failed, so "never attempted" and "attempted and failed" stop '
  'looking identical. Grants no authority; read by no authorization path. Holds no token, email, '
  'UPN, serviceUrl, conversation id or response body.';

comment on column public.foundry_teams_training_delivery_attempts.microsoft_failure_code is
  'Short symbolic code from the existing sanitised Connector classifier (e.g. BotNotInConversationRoster). '
  'Never a message, never an auth challenge, never a payload.';

-- The two questions an operator actually asks: "what happened for this training?"
-- and "what happens whenever we try this person?".
create index if not exists foundry_teams_delivery_attempts_event_idx
  on public.foundry_teams_training_delivery_attempts (event_id, created_at desc);
create index if not exists foundry_teams_delivery_attempts_recipient_idx
  on public.foundry_teams_training_delivery_attempts (tenant_id, aad_object_id, created_at desc);

revoke all on public.foundry_teams_training_delivery_attempts from anon, authenticated, public;
alter table public.foundry_teams_training_delivery_attempts enable row level security;
