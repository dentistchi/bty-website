-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- Foundry Shared Understanding Evidence V1 (Slice 3.1B-3G) — ADDITIVE ONLY.
-- ===========================================================================
-- Evidence ladder separation (do NOT conflate):
--   response_text                 -> PRIVATE Reflection (learner-owned, never Host-visible;
--                                    future user-scoped Center/Today private-context source).
--   shared_understanding_response -> SHARED evidence a learner was EXPLICITLY told is shared
--                                    with the training Host; Host may review it educationally.
--   (Field evidence = a separate future stage; NOT represented here.)
--
-- response_text is UNTOUCHED by this migration and stays private. No backfill, no retroactive
-- shared flag: existing rows get shared_understanding_response = NULL and host_review_status =
-- NULL (Amendment A/H — a legacy learner is NOT an "unreviewed" backlog).
--
-- Host review actor identity (MEASURED, not assumed — Amendment B): every Foundry Host
-- operation authorizes by foundry_events.owner_user_id, and that column FKs auth.users(id).
-- So the canonical Host review actor is auth.users.id (the event owner). host_reviewed_by
-- therefore FKs auth.users(id) (SET NULL on delete), with a durable host_reviewed_by_snapshot.
--
-- ROLLBACK:
--   drop function if exists public.bty_foundry_set_shared_review(uuid, uuid, uuid, text, text);
--   drop table if exists public.foundry_shared_review_audit;
--   alter table public.foundry_event_training_progress
--     drop column if exists shared_understanding_response,
--     drop column if exists shared_response_submitted_at,
--     drop column if exists host_review_status,
--     drop column if exists host_reviewed_at,
--     drop column if exists host_reviewed_by,
--     drop column if exists host_reviewed_by_snapshot,
--     drop column if exists host_review_note;
--   alter table public.foundry_event_training_content drop column if exists shared_question;
--   alter table public.foundry_event_document_content drop column if exists shared_question;
-- ===========================================================================

-- 1. Module-specific SHARED UNDERSTANDING QUESTION (nullable).
--    NULL  -> module has no shared question -> preserve existing completion behavior exactly.
--    set   -> completion requires a non-empty shared_understanding_response.
alter table public.foundry_event_training_content
  add column if not exists shared_question text;
alter table public.foundry_event_document_content
  add column if not exists shared_question text;

-- 2. SHARED RESPONSE + HOST EDUCATIONAL REVIEW on the canonical progress row (extend, not a
--    parallel table). response_text is deliberately left alone.
alter table public.foundry_event_training_progress
  add column if not exists shared_understanding_response text,
  add column if not exists shared_response_submitted_at timestamptz,
  add column if not exists host_review_status text,
  add column if not exists host_reviewed_at timestamptz,
  add column if not exists host_reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists host_reviewed_by_snapshot uuid,
  add column if not exists host_review_note text;

-- 3. Consistency constraints (Amendment C) — impossible states cannot exist.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'foundry_content_shared_q_len_check') then
    alter table public.foundry_event_training_content
      add constraint foundry_content_shared_q_len_check
      check (shared_question is null or char_length(btrim(shared_question)) between 1 and 300);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'foundry_doc_shared_q_len_check') then
    alter table public.foundry_event_document_content
      add constraint foundry_doc_shared_q_len_check
      check (shared_question is null or char_length(btrim(shared_question)) between 1 and 300);
  end if;

  -- shared response length
  if not exists (select 1 from pg_constraint where conname = 'foundry_progress_shared_resp_len_check') then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_shared_resp_len_check
      check (shared_understanding_response is null
             or char_length(btrim(shared_understanding_response)) between 1 and 1000);
  end if;

  -- response and submitted_at exist together (both null or both set)
  if not exists (select 1 from pg_constraint where conname = 'foundry_progress_shared_resp_submitted_check') then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_shared_resp_submitted_check
      check ((shared_understanding_response is null) = (shared_response_submitted_at is null));
  end if;

  -- review (any host_review_status) cannot exist without a shared response
  if not exists (select 1 from pg_constraint where conname = 'foundry_progress_review_needs_shared_check') then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_review_needs_shared_check
      check (host_review_status is null or shared_understanding_response is not null);
  end if;

  -- status domain + reviewed_at/by coupling:
  --   NULL                                  -> no shared response reviewed (legacy / not submitted)
  --   NOT_REVIEWED                          -> shared response present, no reviewer yet
  --   ALIGNED/PARTIALLY_CLEAR/FOLLOW_UP...  -> reviewed_at + durable reviewer snapshot present
  if not exists (select 1 from pg_constraint where conname = 'foundry_progress_review_status_shape_check') then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_review_status_shape_check
      check (
        host_review_status is null
        or (
          host_review_status = 'NOT_REVIEWED'
          and host_reviewed_at is null
          and host_reviewed_by is null
          and host_reviewed_by_snapshot is null
        )
        or (
          host_review_status in ('ALIGNED', 'PARTIALLY_CLEAR', 'FOLLOW_UP_NEEDED')
          and host_reviewed_at is not null
          and host_reviewed_by_snapshot is not null
        )
      );
  end if;

  -- optional note: only when a shared response exists; bounded length
  if not exists (select 1 from pg_constraint where conname = 'foundry_progress_review_note_check') then
    alter table public.foundry_event_training_progress
      add constraint foundry_progress_review_note_check
      check (
        host_review_note is null
        or (shared_understanding_response is not null
            and char_length(btrim(host_review_note)) between 1 and 500)
      );
  end if;
end
$$;

-- 4. Append-only Host-review AUDIT (Amendment D) — mirrors the canonical
--    foundry_event_assignment_audit mechanism (service-role only, RLS, durable snapshots).
--    Every review change preserves actor + prev/new status + timestamp + optional note.
create table if not exists public.foundry_shared_review_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  participant_id uuid not null,
  prev_status text,
  new_status text not null,
  reviewed_by uuid null references auth.users (id) on delete set null,
  reviewed_by_snapshot uuid not null,
  note text,
  changed_at timestamptz not null default now(),
  constraint foundry_shared_review_audit_new_status_check
    check (new_status in ('ALIGNED', 'PARTIALLY_CLEAR', 'FOLLOW_UP_NEEDED'))
);

create index if not exists foundry_shared_review_audit_participant_idx
  on public.foundry_shared_review_audit (event_id, participant_id, changed_at desc);

revoke all on public.foundry_shared_review_audit from anon, public, authenticated;
alter table public.foundry_shared_review_audit enable row level security;

-- 5. Host review WRITE — atomic authz + update + audit, mirroring bty_foundry_claim_assignment.
--    Owner-scoped (only the event owner may review); requires a submitted shared response;
--    NEVER reads or exposes response_text; NEVER touches completion/XP; idempotent on an
--    unchanged (status, note) pair (no duplicate audit row).
create or replace function public.bty_foundry_set_shared_review(
  p_event_id uuid,
  p_participant_id uuid,
  p_owner_user_id uuid,
  p_status text,
  p_note text
)
returns table (result text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid;
  v_prog record;
  v_note text;
begin
  if p_status not in ('ALIGNED', 'PARTIALLY_CLEAR', 'FOLLOW_UP_NEEDED') then
    return query select 'invalid_status'::text;
    return;
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  select owner_user_id into v_owner from public.foundry_events where id = p_event_id;
  if v_owner is null or v_owner <> p_owner_user_id then
    return query select 'not_owner'::text;
    return;
  end if;

  select id, shared_understanding_response, host_review_status, host_review_note
    into v_prog
    from public.foundry_event_training_progress
   where event_id = p_event_id and participant_id = p_participant_id
   for update;

  if v_prog.id is null then
    return query select 'no_progress'::text;
    return;
  end if;
  if v_prog.shared_understanding_response is null then
    return query select 'no_shared_response'::text;
    return;
  end if;

  -- Idempotent: an identical (status, note) resubmission writes nothing new.
  if v_prog.host_review_status = p_status
     and coalesce(v_prog.host_review_note, '') = coalesce(v_note, '') then
    return query select 'unchanged'::text;
    return;
  end if;

  update public.foundry_event_training_progress
     set host_review_status = p_status,
         host_reviewed_at = now(),
         host_reviewed_by = p_owner_user_id,
         host_reviewed_by_snapshot = p_owner_user_id,
         host_review_note = v_note,
         updated_at = now()
   where id = v_prog.id;

  insert into public.foundry_shared_review_audit
    (event_id, participant_id, prev_status, new_status, reviewed_by, reviewed_by_snapshot, note)
  values
    (p_event_id, p_participant_id, v_prog.host_review_status, p_status, p_owner_user_id, p_owner_user_id, v_note);

  return query select 'reviewed'::text;
end
$$;

revoke all on function public.bty_foundry_set_shared_review(uuid, uuid, uuid, text, text)
  from anon, public, authenticated;
grant execute on function public.bty_foundry_set_shared_review(uuid, uuid, uuid, text, text)
  to service_role;
