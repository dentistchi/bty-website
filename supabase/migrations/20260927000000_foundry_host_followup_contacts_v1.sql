-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- =============================================================================
-- Host → Learner FOLLOW-UP CONTACT. V1
--
-- PRODUCTION-EFFECTIVE. Idempotent, replay-safe, ADDITIVE ONLY: one new
-- server-only table. No existing table, column, grant, policy or row is touched.
--
-- WHAT THIS RECORDS, AND NOTHING MORE. A Host looked at one learner's quiz
-- result and chose to start a conversation with them in Teams. That is the whole
-- fact: WHO reached out, to WHOM, about WHICH training, and WHEN.
--
-- WHAT IT CANNOT RECORD, BY SHAPE. There is no message column, no draft column,
-- no thread id and no body of any kind, so the conversation the two of them then
-- have cannot be stored here even by a later mistake. The chat happens directly
-- between two people in Teams; BTY opens the window and then is not a party to
-- it. A column that does not exist is a stronger guarantee than a rule about a
-- column that does.
--
-- WHY NOT foundry_participant_followups. That table is the LEARNER-OWNED 7/30-day
-- application obligation: its rows belong to the learner, its status machine is
-- PENDING -> RESPONDED, and its audit event types are CREATED / RESPONDED. A Host
-- deciding to send a chat message is a different act by a different person with no
-- obligation attached, and widening that table's domain to hold it would make
-- "a learner's follow-up" mean two unrelated things. It is left untouched.
--
-- IT GRANTS NOTHING. No authorization path reads this table. It decides nothing
-- about delivery, identity, scoring, completion or XP.
--
-- DURABILITY. event_id is ON DELETE SET NULL so deleting a training never erases
-- the record that a Host reached out; host_user_id and learner_user_id are plain
-- snapshots for the same reason.
--
-- Rollback:  DROP TABLE IF EXISTS public.foundry_host_followup_contacts;
-- =============================================================================

create table if not exists public.foundry_host_followup_contacts (
  id uuid primary key default gen_random_uuid(),

  -- The training the follow-up is about. SET NULL keeps the contact record honest
  -- if the training is later deleted.
  event_id uuid references public.foundry_events (id) on delete set null,

  -- WHO REACHED OUT. Server-derived from the Host's session, never client-supplied.
  host_user_id uuid not null,

  -- WHOM THEY REACHED. The participant row is the durable learner coordinate here;
  -- learner_user_id is present only when that participant is bound to a BTY account
  -- (a Teams learner who has never claimed is a real participant with no user id).
  participant_id uuid references public.foundry_event_participants (id) on delete set null,
  learner_user_id uuid,

  -- One kind of event today. Named and constrained so a second kind cannot be
  -- quietly folded in without saying so.
  event_type text not null default 'follow_up_initiated',

  created_at timestamptz not null default now(),

  constraint foundry_host_followup_event_type_check
    check (event_type in ('follow_up_initiated')),
  -- A contact with neither coordinate names nobody and is not worth keeping.
  constraint foundry_host_followup_target_present_check
    check (participant_id is not null or learner_user_id is not null)
);

comment on table public.foundry_host_followup_contacts is
  'A Host opened a direct Teams chat with a learner about a training quiz result. Records only who, whom, which training and when. Holds NO message, draft, thread id or conversation body of any kind, by design.';

-- The Host projection: this training's follow-ups, newest first.
create index if not exists foundry_host_followup_event_idx
  on public.foundry_host_followup_contacts (event_id, created_at desc);
-- "Have I already reached out to this person about this training?"
create index if not exists foundry_host_followup_participant_idx
  on public.foundry_host_followup_contacts (participant_id, created_at desc);

-- SERVER ONLY. RLS on with ZERO policies, so a client key can read nothing even
-- if a grant is ever restored by accident. service_role is named explicitly: the
-- Supabase default grants it ALL, so a revoke that omits it enforces nothing.
alter table public.foundry_host_followup_contacts enable row level security;
revoke all on table public.foundry_host_followup_contacts from public, anon, authenticated;
