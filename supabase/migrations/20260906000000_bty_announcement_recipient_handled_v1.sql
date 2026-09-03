-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- PER-RECIPIENT FOLLOW-UP CLOSURE.
-- ADDITIVE ONLY. Two nullable columns and one function. No existing column,
-- constraint, grant, policy or row is altered or deleted.
--
-- ORDERING: 20260906, after 20260903 / 20260904 / 20260905 -- all three applied
-- to this schema BY HAND and none recorded in the migration ledger. This file
-- must sort after them so a later `migration repair` replays the true sequence.
-- ===========================================================================
--
-- WHY ANNOUNCEMENT-LEVEL `closed_at` IS NOT ENOUGH, MEASURED (2026-09-03).
-- Production holds three announcements, and their recipients are in three
-- different states at once:
--
--   ann 6cfccb92  "Pay"     one recipient, never opened BTY   -> nothing to do
--   ann 54bbb77a  ...       HELP_NEEDED                       -> Host must act
--   ann 0e11d0bf  ...       QUESTION, with a real question    -> Host must answer
--
-- A Host who answers one person's question has not closed the announcement, and
-- `bty_tracked_announcements.closed_at` cannot say "this person is settled and
-- that one is still waiting". Closure is a property of the PERSON'S request, so
-- it belongs on the recipient row.
--
-- ACKNOWLEDGED NEEDS NO COLUMN. "Got it" is already the end of that exchange:
-- `response = 'ACKNOWLEDGED'` IS the settled state, and adding a second flag a
-- Host must also press would invent work the product does not have. Only
-- QUESTION and HELP_NEEDED can be handled, and the CHECK below makes that a
-- database rule rather than a convention the UI is trusted to remember.
--
-- THE AUDIT SURVIVES CLOSURE. `response`, `responded_at` and `question_text`
-- are never cleared by handling. What a person said, and when, is not the
-- Host's to erase by acting on it.
--
-- ROLLBACK:
--   drop function if exists public.bty_handle_announcement_recipient(uuid, uuid, boolean);
--   alter table public.bty_tracked_announcement_recipients
--     drop constraint if exists bty_tracked_recip_handled_pair_check,
--     drop constraint if exists bty_tracked_recip_handled_response_check,
--     drop column if exists handled_by_user_id,
--     drop column if exists handled_at;
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE TWO COLUMNS
-- ---------------------------------------------------------------------------

alter table public.bty_tracked_announcement_recipients
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by_user_id uuid references auth.users (id) on delete set null;

comment on column public.bty_tracked_announcement_recipients.handled_at is
  'When the OWNING Host marked this person''s follow-up settled. NULL means still open. Only meaningful for QUESTION and HELP_NEEDED: ACKNOWLEDGED is already an ending.';
comment on column public.bty_tracked_announcement_recipients.handled_by_user_id is
  'The canonical user who marked it handled -- always the announcement owner, enforced inside bty_handle_announcement_recipient. Never an email.';

-- Both together or neither: a handled row must say who, and a row with a
-- handler must say when.
alter table public.bty_tracked_announcement_recipients
  drop constraint if exists bty_tracked_recip_handled_pair_check;
alter table public.bty_tracked_announcement_recipients
  add constraint bty_tracked_recip_handled_pair_check
  check ((handled_at is null) = (handled_by_user_id is null));

-- Only a request that CAN be handled may be. Nothing to handle on a person who
-- has not answered, and "Got it" is already settled.
alter table public.bty_tracked_announcement_recipients
  drop constraint if exists bty_tracked_recip_handled_response_check;
alter table public.bty_tracked_announcement_recipients
  add constraint bty_tracked_recip_handled_response_check
  check (handled_at is null or response in ('QUESTION', 'HELP_NEEDED'));

-- ---------------------------------------------------------------------------
-- 2. THE ONLY WAY TO WRITE IT
--
-- OWNERSHIP IS VERIFIED IN THE DATABASE, NOT BY THE CALLER. The function joins
-- the recipient to its announcement and requires `owner_user_id = p_actor_user_id`.
-- A different Host, the recipient themselves, and any client calling directly
-- all fail the same way -- and `not_owner` is deliberately indistinguishable
-- from `not_found`, so nobody can probe for the existence of a run they do not
-- own.
--
-- `p_handled` carries both directions. Re-opening is the same authority as
-- closing: a Host who marked the wrong person handled must be able to undo it,
-- and giving that a separate function would double the surface for one bit.
--
-- SECURITY DEFINER because the recipients table is client-deny; EXECUTE is
-- granted to service_role only, so this is reachable from the server path and
-- nowhere else.
-- ---------------------------------------------------------------------------

create or replace function public.bty_handle_announcement_recipient(
  p_recipient_id uuid,
  p_actor_user_id uuid,
  p_handled boolean
)
returns table (result text, handled_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_owner uuid;
  v_response text;
  v_now timestamptz := now();
begin
  -- Lock the row before deciding, so two taps cannot both pass the checks.
  select a.owner_user_id, r.response
    into v_owner, v_response
    from public.bty_tracked_announcement_recipients r
    join public.bty_tracked_announcements a on a.id = r.announcement_id
   where r.id = p_recipient_id
     for update of r;

  if not found then
    return query select 'not_found'::text, null::timestamptz; return;
  end if;

  -- Same shape as "not found": ownership of someone else's run is not probeable.
  if v_owner is distinct from p_actor_user_id then
    return query select 'not_found'::text, null::timestamptz; return;
  end if;

  if p_handled then
    if v_response is null or v_response not in ('QUESTION', 'HELP_NEEDED') then
      -- Nothing to settle: unanswered, or already ended by "Got it".
      return query select 'not_handleable'::text, null::timestamptz; return;
    end if;
    update public.bty_tracked_announcement_recipients
       set handled_at = v_now, handled_by_user_id = p_actor_user_id
     where id = p_recipient_id;
    return query select 'handled'::text, v_now;
  else
    update public.bty_tracked_announcement_recipients
       set handled_at = null, handled_by_user_id = null
     where id = p_recipient_id;
    return query select 'reopened'::text, null::timestamptz;
  end if;
end;
$$;

revoke all on function public.bty_handle_announcement_recipient(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.bty_handle_announcement_recipient(uuid, uuid, boolean) to service_role;

comment on function public.bty_handle_announcement_recipient(uuid, uuid, boolean) is
  'Mark one recipient follow-up handled, or re-open it. Ownership is verified here by joining to the announcement owner; a non-owner receives the same not_found as a missing row. Never clears response, responded_at or question_text.';
