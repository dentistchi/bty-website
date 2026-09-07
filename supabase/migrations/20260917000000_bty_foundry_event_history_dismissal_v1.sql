-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- FOUNDRY TRAINING HISTORY -- PERSONAL CLEANUP OVER A SHARED OBJECT.
-- ADDITIVE ONLY. One new table. No existing table, column, constraint, grant,
-- policy, function or ROW is altered or deleted anywhere in this file.
-- ===========================================================================
--
-- ★ REMOVE MEANS "HIDE THIS FROM MY OWN HISTORY", AND THE SCHEMA IS THE PROOF.
--
-- A closed training session is SHARED: it has participants, progress and
-- completion records that belong to other people. So personal cleanup cannot
-- be a column on `foundry_events` -- one person tidying their list would
-- decide what everybody else sees. It is a row about a PERSON'S VIEW, and it
-- lives in its own table with no way to reach the thing it hides: this file
-- names `foundry_events` only as a foreign key target, and touches no
-- participant, progress, completion or content table at all.
--
-- ★ WHY NOT `bty_today_dismissals`, WHICH ALREADY DOES SOMETHING LIKE THIS.
--
-- Because it does something SPECIFIC, not something general. Its whole design
-- is a MONOTONIC ACTIVITY VERSION: a dismissal records the count of
-- attention-worthy activity it could see, and the card RETURNS the moment that
-- count rises. A closed training session has no such counter -- it is closed,
-- and nothing further is going to happen on it. Reusing that table would mean
-- inventing a constant version to satisfy a column whose entire purpose is to
-- change, which is bending a contract rather than sharing one.
--
-- Two tables that each say one true thing beat one table that needs a footnote.
--
-- ★ AND NO RESURFACE, DELIBERATELY. Track cards come back because somebody
-- wrote to you. Nobody is going to write to a closed session, so a hide that
-- expires would be a hide that never expires -- machinery with no case. When a
-- person removes a finished training from their history, it stays removed.
-- There is no Restore in V1; if the product ever wants one, it is a deliberate
-- slice with its own review, not a DELETE grant left lying here for it.
--
-- ROLLBACK:
--   drop table if exists public.bty_foundry_event_history_dismissals;
-- ===========================================================================

create table if not exists public.bty_foundry_event_history_dismissals (
  -- WHOSE HISTORY. Always the caller's own canonical id, supplied by the
  -- server from the authenticated session and never by a request body.
  -- Cascades: a dismissal is a preference, and one belonging to a deleted
  -- account answers nothing.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- WHICH SESSION. A real foreign key here, unlike the Today dismissal's
  -- deliberately unreferenced `item_id` -- that table spans several kinds of
  -- card and cannot name one target, while this one is about exactly one
  -- thing. `on delete cascade` because a dismissal of a session that no longer
  -- exists hides nothing and is simply noise.
  event_id uuid not null references public.foundry_events (id) on delete cascade,

  dismissed_at timestamptz not null default now(),

  -- ONE dismissal per person per session. Re-removing something already gone
  -- from your history is not a second decision, and the key is what makes the
  -- write idempotent rather than a service-layer convention.
  --
  -- ★ IT IS ALSO THE ONLY INDEX THIS TABLE NEEDS. The single read shape is
  -- "what has THIS person hidden", a leading-column prefix of this key.
  constraint bty_foundry_event_history_dismissals_pk primary key (user_id, event_id)
);

comment on table public.bty_foundry_event_history_dismissals is
  'Per-user "remove this finished training from my history". Hides a CLOSED foundry_events row from ONE person''s own history projection and nothing else: it changes no session, no status, no participant, no progress and no completion record, and it cannot affect what anybody else sees. Personal projection state over a shared object.';
comment on column public.bty_foundry_event_history_dismissals.event_id is
  'The closed session hidden from this person''s history. A foreign key, unlike bty_today_dismissals.item_id, because this table is about exactly one kind of object and can name it.';
comment on column public.bty_foundry_event_history_dismissals.dismissed_at is
  'When they tidied it away. Audit and ordering only -- nothing reads it to decide visibility, because there is no resurface rule: a closed session receives no further activity, so a hide that expired would never expire.';

-- ---------------------------------------------------------------------------
-- ACL.
--
-- ★ service_role IS NAMED IN THE REVOKE. Supabase's default privileges grant it
-- ALL the instant a table is created, so a revoke listing only
-- anon/public/authenticated would leave UPDATE, DELETE, TRUNCATE, REFERENCES
-- and TRIGGER standing, and any later grant would be additive on top of ALL.
-- Measured on this project's production database on 2026-09-06.
--
-- ★ SELECT AND INSERT ONLY. There is nothing to UPDATE -- the row IS the fact,
-- and it has no mutable field. There is nothing to DELETE either, because V1
-- has no Restore; granting one "just in case" is exactly the ambient authority
-- 20260914 and 20260916 removed from neighbouring tables.
-- ---------------------------------------------------------------------------
revoke all on public.bty_foundry_event_history_dismissals from anon, public, authenticated, service_role;
alter table public.bty_foundry_event_history_dismissals enable row level security;
grant select, insert on public.bty_foundry_event_history_dismissals to service_role;

-- ---------------------------------------------------------------------------
-- ★ WHERE CROSS-USER SAFETY ACTUALLY COMES FROM -- stated accurately.
--
--   ENFORCED BY THE SERVER   the route derives the canonical user from the
--                            authenticated session; the request body carries an
--                            event id and nothing else, so there is no user id
--                            to supply.
--   ENFORCED BY THE SERVER   before writing, it verifies the session user OWNS
--                            that session (`foundry_events.owner_user_id`) and
--                            that it is CLOSED. Measured: both the Past
--                            training section and the history archive are
--                            owner-scoped Host surfaces behind `requireManager`,
--                            so a participant has no history here to tidy.
--   ENFORCED BY THE SCHEMA   the primary key gives each person their own row,
--                            and there is no UPDATE grant, so an existing row
--                            can never be re-pointed at somebody else.
--   NOT CLAIMED              the schema alone authorizes nothing. `service_role`
--                            could insert any user_id, which is precisely why
--                            the route is the boundary and is tested as one.
-- ---------------------------------------------------------------------------
