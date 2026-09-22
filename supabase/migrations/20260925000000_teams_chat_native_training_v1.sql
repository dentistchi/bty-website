-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Teams Chat-Native Text Training + Quiz — V1
--
-- PRODUCTION-EFFECTIVE: a single shared Supabase project backs all workers.
-- Idempotent + replay-safe. ADDITIVE ONLY: no table is dropped, no column is
-- removed or retyped, no existing row is rewritten, no existing grant or policy
-- is altered, and every new table is server-only (RLS on, zero policies, client
-- grants revoked).
--
-- WHY THIS EXISTS. Repeated real-iPhone evidence showed Teams iOS controls the
-- personal-tab HTTPS handoff and does not reliably preserve a training
-- destination. So the normal INTERNAL path stops depending on it: the BTY bot
-- delivers the training to the employee's own Teams chat, and the employee reads
-- the text and answers the quiz inside that conversation. The canonical Foundry /
-- Quiz backend is unchanged and is still the only place a score or a completion
-- is decided.
--
-- WHAT IS DELIBERATELY NOT HERE: no second quiz engine, no second scoring path,
-- no second completion record. `foundry_event_quiz_attempts` and the canonical
-- Foundry progress row remain the only durable result.
--
-- Rollback (reverse order; safe only while no row uses the new objects):
--   DROP INDEX IF EXISTS public.foundry_event_participants_microsoft_identity_uidx;
--   ALTER TABLE public.foundry_event_participants
--     DROP COLUMN IF EXISTS microsoft_aad_object_id,
--     DROP COLUMN IF EXISTS microsoft_tenant_id;
--   DROP TABLE IF EXISTS public.foundry_teams_training_sessions;
--   DROP TABLE IF EXISTS public.foundry_teams_training_deliveries;
--   DROP TABLE IF EXISTS public.bty_teams_tenant_routes;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. VERIFIED TENANT ROUTING.
--
--    A Bot Framework `serviceUrl` is per-tenant and is NEVER guessed: Microsoft
--    documents it as something the bot observes on an authenticated activity and
--    caches. This table is that cache, and its only writer is the invoke route,
--    AFTER `verifyBotFrameworkToken()` has succeeded and the existing strict
--    serviceUrl rules have accepted the value. No regional endpoint is hardcoded
--    anywhere in this migration or in the code that reads it.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_teams_tenant_routes (
  -- TEXT, matching every existing Microsoft-identity column in this schema
  -- (conversation refs, creation claims, directory authority, tracked announcements).
  -- Consistency beats a stricter type here: it keeps every join cast-free.
  tenant_id text primary key,
  service_url text not null,
  -- When the value was last seen on a VERIFIED activity, not when a row was written.
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bty_teams_tenant_routes_tenant_guid_check
    check (tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  constraint bty_teams_tenant_routes_service_url_https_check
    check (service_url ~ '^https://[a-z0-9.-]+(\.botframework\.com|\.trafficmanager\.net)(/.*)?$')
);

comment on table public.bty_teams_tenant_routes is
  'Teams Chat-Native Training V1. The Bot Framework serviceUrl observed for a tenant on a '
  'VERIFIED incoming activity. Written only after Bot Framework token verification; never '
  'guessed, never client-supplied, never a hardcoded regional endpoint.';

revoke all on public.bty_teams_tenant_routes from anon, authenticated, public;
alter table public.bty_teams_tenant_routes enable row level security;

-- ---------------------------------------------------------------------------
-- 2. TRAINING DELIVERY RECORD.
--
--    One row per (training, recipient). Its RANDOM id is the opaque identifier
--    carried inside Adaptive Card actions, which is why the card never has to
--    contain an event id, a user id, an email or an answer key.
--
--    `owner_user_id_snapshot` records who sent it at the time, like the Program
--    root's owner snapshot: authority is re-derived per request, and this is
--    history rather than a live permission.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_teams_training_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events (id) on delete cascade,
  owner_user_id_snapshot uuid not null references auth.users (id) on delete restrict,
  -- The VERIFIED Microsoft identity of the recipient. Never an email, never a UPN.
  -- TEXT to match every other Microsoft-identity column in this schema.
  tenant_id text not null,
  aad_object_id text not null,
  -- Presentation only. Never identity, never a lookup key.
  display_name_snapshot text,
  service_url text not null,
  conversation_id text not null,
  delivery_status text not null default 'PENDING',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foundry_teams_training_deliveries_recipient_unique
    unique (event_id, tenant_id, aad_object_id),
  constraint foundry_teams_training_deliveries_status_check
    check (delivery_status in ('PENDING', 'DELIVERED', 'UNDELIVERABLE')),
  -- A delivered row states WHEN; a row that is not delivered must not claim a time.
  constraint foundry_teams_training_deliveries_delivered_stamp_check
    check ((delivery_status = 'DELIVERED') = (delivered_at is not null)),
  constraint foundry_teams_training_deliveries_display_name_len_check
    check (display_name_snapshot is null or char_length(btrim(display_name_snapshot)) between 1 and 120),
  constraint foundry_teams_training_deliveries_identity_guid_check
    check (
      tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and aad_object_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
);

comment on table public.foundry_teams_training_deliveries is
  'Teams Chat-Native Training V1. One training delivered to one verified Microsoft identity. Its '
  'random id is the opaque handle inside Adaptive Card actions, so a card never carries an event '
  'id, a user id, an address or an answer key.';

create index if not exists foundry_teams_training_deliveries_event_idx
  on public.foundry_teams_training_deliveries (event_id);
create index if not exists foundry_teams_training_deliveries_recipient_idx
  on public.foundry_teams_training_deliveries (tenant_id, aad_object_id);

revoke all on public.foundry_teams_training_deliveries from anon, authenticated, public;
alter table public.foundry_teams_training_deliveries enable row level security;

-- ---------------------------------------------------------------------------
-- 3. TRANSIENT TEAMS WORKFLOW STATE.
--
--    Sequential Adaptive Cards need somewhere to remember which question the
--    learner is on. This is THAT, and nothing more: it is workflow state, not a
--    result. The canonical result stays `foundry_event_quiz_attempts` (immutable,
--    written once, on final submission) plus the canonical Foundry progress row.
--
--    `answers` holds ONLY the learner's own chosen choice ids. No correct answer
--    and no score is ever stored here, so this table cannot leak an answer key
--    even to a reader who has it.
-- ---------------------------------------------------------------------------
create table if not exists public.foundry_teams_training_sessions (
  delivery_id uuid primary key
    references public.foundry_teams_training_deliveries (id) on delete cascade,
  participant_id uuid not null,
  state text not null default 'READING',
  current_question_index integer not null default 0,
  answers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint foundry_teams_training_sessions_state_check
    check (state in ('READING', 'QUIZ', 'COMPLETED')),
  constraint foundry_teams_training_sessions_index_check
    check (current_question_index between 0 and 20),
  constraint foundry_teams_training_sessions_completed_stamp_check
    check ((state = 'COMPLETED') = (completed_at is not null))
);

comment on table public.foundry_teams_training_sessions is
  'Teams Chat-Native Training V1. TRANSIENT sequential-card workflow state. Holds only the '
  'learner''s own chosen choice ids — never a correct answer and never a score. The canonical '
  'result is foundry_event_quiz_attempts.';

revoke all on public.foundry_teams_training_sessions from anon, authenticated, public;
alter table public.foundry_teams_training_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- 4. MICROSOFT-BOUND PARTICIPANT IDENTITY (additive).
--
--    A Teams-chat learner is identified by the VERIFIED (tenant_id, aad_object_id)
--    of the activity, resolved server-side. These two nullable columns record it.
--
--    THE PARTIAL UNIQUE INDEX IS WHY THE PUBLIC WEB IS UNAFFECTED. It applies only
--    to rows that carry BOTH values — that is, only to Teams-owned participants.
--    Anonymous web participants keep NULLs, stay outside the index entirely, and
--    may still hold one participant per device exactly as before. Nothing about
--    `participant_session_token_hash` or `user_id` changes.
-- ---------------------------------------------------------------------------
alter table public.foundry_event_participants
  add column if not exists microsoft_tenant_id text,
  add column if not exists microsoft_aad_object_id text;

comment on column public.foundry_event_participants.microsoft_tenant_id is
  'Teams Chat-Native Training V1. Verified Entra tenant of a Teams-chat learner. Written by the '
  'server from a Bot-Framework-verified activity only; never from a payload. NULL for every web '
  'and anonymous participant.';
comment on column public.foundry_event_participants.microsoft_aad_object_id is
  'Teams Chat-Native Training V1. Verified Entra object id (oid) of a Teams-chat learner. With '
  'the tenant it is that learner''s identity; an email or UPN never is.';

create unique index if not exists foundry_event_participants_microsoft_identity_uidx
  on public.foundry_event_participants (event_id, microsoft_tenant_id, microsoft_aad_object_id)
  where microsoft_tenant_id is not null and microsoft_aad_object_id is not null;

-- ---------------------------------------------------------------------------
-- 5. SEED THE TENANT ROUTE FROM VERIFIED HISTORY — ONLY IF UNAMBIGUOUS.
--
--    The condition is re-proved HERE, in SQL, rather than trusted from an
--    out-of-band measurement: seed only when every non-null serviceUrl BTY has
--    ever observed belongs to exactly one tenant AND resolves to exactly one
--    value. If the evidence is ambiguous this inserts nothing and the table
--    simply waits for the next verified activity to populate it.
--
--    Sources are BTY's own records of ALREADY-VERIFIED Bot Framework traffic:
--    confirmed 1:1 conversation references and tracked announcement routing.
--    No regional endpoint is written by hand.
-- ---------------------------------------------------------------------------
insert into public.bty_teams_tenant_routes (tenant_id, service_url, observed_at, updated_at)
select v.tenant_id, v.service_url, now(), now()
from (
  select tenant_id, service_url
  from (
    select tenant_id, service_url from public.bty_teams_conversation_refs
     where tenant_id is not null and service_url is not null
    union all
    select tenant_id, service_url from public.bty_tracked_announcements
     where tenant_id is not null and service_url is not null
  ) s
  where tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  group by tenant_id, service_url
) v
where (
  select count(*) from (
    select distinct tenant_id, service_url
    from (
      select tenant_id, service_url from public.bty_teams_conversation_refs
       where tenant_id is not null and service_url is not null
      union all
      select tenant_id, service_url from public.bty_tracked_announcements
       where tenant_id is not null and service_url is not null
    ) s2
    where tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) pairs
) = 1
on conflict (tenant_id) do nothing;
