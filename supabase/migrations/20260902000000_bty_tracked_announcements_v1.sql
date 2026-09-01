-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SLICE A1 — TRACKED ANNOUNCEMENT V1. ADDITIVE ONLY.
-- No existing table, column, constraint, function, grant or row is altered.
-- `bty_action_captures` is referenced as an FK TARGET and is NOT modified.
-- ===========================================================================
--
-- WHAT THIS IS. Teams already distributes information. This answers the one
-- question Teams does not: did the people the Host actually meant to reach
-- acknowledge it, have a question, or need help applying it.
--
-- WHAT IT IS NOT, AND WHAT ENFORCES THAT:
--   * NOT a read receipt. Nothing here records delivery, opening or viewing.
--     The only rows that exist are ones a person explicitly created by tapping
--     one of three choices.
--   * NOT training. No event, no progress, no completion, no follow-up, no
--     apply window, no Evidence Ladder rung. This migration references no
--     Foundry table.
--   * NOT a commitment. No deadline, no verification, no Action Contract. The
--     measured hazard is concrete: `fetchBlockingArenaContractForSession`
--     selects open contracts by `deadline_at > now()` with NO `action_type`
--     filter, so anything that became a contract would block Arena. Nothing
--     here can become one — there is no FK to `bty_action_contracts` and no
--     trigger in this file.
--   * NOT XP-bearing. No weight, no ledger, no activation type, no AIR.
--   * NOT a score. There is deliberately no computed column, no percentage and
--     no aggregate: the Host reads five separate counts, and the product refuses
--     to combine them.
--
-- THE AUDIENCE AUTHORITY IS MICROSOFT, NOT BTY. Recipients are frozen as
-- (tenant_id, aad_object_id) — the tuple `bty_resolve_user_from_microsoft_identity`
-- already speaks. BTY org membership is deliberately NOT the denominator: the
-- Host picked these people out of a real Teams conversation, and that selection
-- IS the audience. There is therefore no `organization_id` column here, for the
-- same reason `bty_action_captures` has none — nothing in this feature is scoped
-- by org, and a column nobody writes is a column somebody later misreads.
--
-- ★ WHY `user_id` IS NULLABLE, WHICH IS THE WHOLE POINT.
-- A Host may legitimately select a colleague who has never opened BTY. Requiring
-- a BTY user at Track time would silently shrink the audience to people who
-- already use the product — and every number computed from it would then be a
-- lie. So identity is frozen as Microsoft's, and `user_id` binds later, on that
-- person's first canonical BTY entry. Until it binds they are NOT YET ACTIVATED,
-- which is a different fact from NO RESPONSE and is never folded into it:
-- reporting platform onboarding as human silence is exactly the dishonesty this
-- column shape exists to prevent.
--
-- ROLLBACK:
--   drop function if exists public.bty_respond_to_announcement(uuid, uuid, text, text);
--   drop function if exists public.bty_bind_announcement_recipients(uuid, text, text);
--   drop function if exists public.bty_track_announcement(uuid, uuid, text, text, text, text[]);
--   drop table if exists public.bty_tracked_announcement_recipients;
--   drop table if exists public.bty_tracked_announcements;
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE TRACKED RUN. One Host, one source message, one frozen audience.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_tracked_announcements (
  id uuid primary key default gen_random_uuid(),

  -- The Host. Server-derived from a verified Teams identity, never from a body.
  owner_user_id uuid not null references auth.users (id) on delete cascade,

  -- The immutable Teams source evidence. Reused, never copied: the capture owns
  -- provenance (tenant/conversation/message, preview, permalink) and this row
  -- owns the tracking. ON DELETE CASCADE because a run whose source is gone has
  -- no subject.
  source_capture_id uuid not null
    references public.bty_action_captures (id) on delete cascade,

  -- WHAT THE HOST SAYS, IN THEIR OWN WORDS. This — not the captured message —
  -- is what recipients see. See the disclosure rule below.
  host_framing text not null,

  -- How the audience was chosen. One value in V1; a column rather than a
  -- constant so a later roster source is an INSERT-time fact, not a rewrite.
  audience_source text not null default 'teams_people_picker',

  -- Frozen at Track time and never recomputed. Teams membership is live
  -- reality; this run's denominator is what the Host chose at this instant, and
  -- a later joiner or leaver must not rewrite history.
  resolved_count integer not null,

  status text not null default 'active',

  -- The conversation this came from, frozen for provenance. NEVER projected to
  -- a recipient (see the privacy rule) — BTY audience membership does not prove
  -- Teams source access.
  tenant_id text not null,
  conversation_id text not null,

  created_at timestamptz not null default now(),
  closed_at timestamptz,

  constraint bty_tracked_ann_framing_len_check
    check (char_length(btrim(host_framing)) between 1 and 1000),
  constraint bty_tracked_ann_audience_source_check
    check (audience_source in ('teams_people_picker')),
  constraint bty_tracked_ann_status_check
    check (status in ('active', 'closed')),
  constraint bty_tracked_ann_count_check
    check (resolved_count >= 1),
  -- status = closed IF AND ONLY IF closed_at is set. Mirrors the promoted_at
  -- precedent in `bty_action_captures`: a state and the moment it was reached
  -- are one fact.
  constraint bty_tracked_ann_closed_pair_check
    check ((status = 'closed') = (closed_at is not null)),

  -- ONE ACTIVE RUN PER HOST PER SOURCE. Tracking the same message twice is
  -- almost always a double-tap or a re-opened dialog, and two runs would split
  -- one audience across two denominators that neither adds up nor reconciles.
  -- The Track path therefore RETURNS the existing run rather than creating a
  -- second one. (A deliberate re-track after closing is not supported in V1;
  -- it needs a product answer about what happens to the first run's responses,
  -- and inventing one here would be guessing.)
  constraint bty_tracked_ann_owner_source_unique unique (owner_user_id, source_capture_id)
);

-- The Host's own list, newest first.
create index if not exists bty_tracked_ann_owner_created_idx
  on public.bty_tracked_announcements (owner_user_id, created_at desc);

comment on table public.bty_tracked_announcements is
  'Slice A1 — a Host tracking whether the people they chose acknowledged a Teams message, have a question, or need help applying it. NOT a read receipt, NOT training, NOT an Action Contract, NOT XP-bearing, NOT a score. The audience is the Host''s explicit selection from a real Teams conversation, frozen at Track time.';
comment on column public.bty_tracked_announcements.host_framing is
  'What the Host says in their own words. This is what recipients see — the captured Teams message body is NEVER projected to them, because BTY audience membership does not prove Teams source access.';
comment on column public.bty_tracked_announcements.resolved_count is
  'The denominator, frozen at Track time. Never recomputed from live Teams membership: a later joiner or leaver must not rewrite what this announcement was sent to.';

-- ---------------------------------------------------------------------------
-- 2. THE FROZEN RECIPIENT SET. Microsoft identity first; BTY identity later.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_tracked_announcement_recipients (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null
    references public.bty_tracked_announcements (id) on delete cascade,

  -- THE IDENTITY THAT IS ALWAYS AVAILABLE. Frozen from the People Picker's
  -- submitted Entra object ids plus the invoke's tenant. Lowercased by the
  -- writer so the unique key cannot be defeated by casing.
  tenant_id text not null,
  aad_object_id text not null,

  -- THE IDENTITY THAT MAY NOT EXIST YET. Bound on that person's first canonical
  -- BTY entry, never at Track time, and never created here — a recipient row is
  -- not permission to make an account.
  user_id uuid references auth.users (id) on delete set null,
  bound_at timestamptz,

  -- The whole response vocabulary. Three explicit choices, and nothing implicit.
  response text,
  responded_at timestamptz,
  -- Only meaningful for QUESTION. Bounded, and never AI-processed.
  question_text text,

  created_at timestamptz not null default now(),

  constraint bty_tracked_recip_response_check
    check (response is null or response in ('ACKNOWLEDGED', 'QUESTION', 'HELP_NEEDED')),
  -- A response and the moment it was given are ONE fact.
  constraint bty_tracked_recip_response_pair_check
    check ((response is null) = (responded_at is null)),
  -- Binding and the moment of binding are ONE fact.
  constraint bty_tracked_recip_bound_pair_check
    check ((user_id is null) = (bound_at is null)),
  -- Question text belongs to QUESTION alone. A stray sentence on an
  -- acknowledgement would be text nobody agreed to store.
  constraint bty_tracked_recip_question_text_check
    check (
      question_text is null
      or (response = 'QUESTION' and char_length(btrim(question_text)) between 1 and 1000)
    ),
  -- The audience is a SET. One person cannot be selected twice into one run.
  constraint bty_tracked_recip_unique
    unique (announcement_id, tenant_id, aad_object_id)
);

-- The participant's own lane: what still needs their response.
create index if not exists bty_tracked_recip_user_response_idx
  on public.bty_tracked_announcement_recipients (user_id, response);
-- The Host's outcome read.
create index if not exists bty_tracked_recip_announcement_idx
  on public.bty_tracked_announcement_recipients (announcement_id);
-- The binding lookup on first canonical entry.
create index if not exists bty_tracked_recip_identity_idx
  on public.bty_tracked_announcement_recipients (tenant_id, aad_object_id)
  where user_id is null;

comment on table public.bty_tracked_announcement_recipients is
  'Slice A1 — one selected person per row, frozen by Microsoft identity (tenant + Entra oid) because a Host may legitimately choose someone who has never opened BTY. user_id binds later. An unbound recipient is NOT YET ACTIVATED, which is a different fact from NO RESPONSE and must never be folded into it.';
comment on column public.bty_tracked_announcement_recipients.user_id is
  'Bound on first canonical BTY entry, never at Track time. A recipient row is NEVER permission to create an account — first-time users go through the existing Microsoft-first OAuth path.';
comment on column public.bty_tracked_announcement_recipients.response is
  'ACKNOWLEDGED | QUESTION | HELP_NEEDED, or NULL. Write-once. Proves an explicit tap at a timestamp and NOTHING else — not read, not understanding, not agreement, not compliance, not applied behaviour.';

-- Client-deny; every write goes through the SECURITY DEFINER functions below.
revoke all on public.bty_tracked_announcements from anon, public, authenticated;
revoke all on public.bty_tracked_announcement_recipients from anon, public, authenticated;
alter table public.bty_tracked_announcements enable row level security;
alter table public.bty_tracked_announcement_recipients enable row level security;
grant select, insert, update, delete on public.bty_tracked_announcements to service_role;
grant select, insert, update, delete on public.bty_tracked_announcement_recipients to service_role;

-- ---------------------------------------------------------------------------
-- 3. TRACK — the atomic write. Announcement + every recipient, or nothing.
--
-- One function transaction. If any recipient fails, the announcement does not
-- exist either: a run with a partial audience would report a denominator that
-- was never true.
--
-- IDEMPOTENT by (owner, source): a double-tapped dialog returns the existing
-- run untouched rather than splitting one audience across two denominators.
-- ---------------------------------------------------------------------------
create or replace function public.bty_track_announcement(
  p_owner_user_id uuid,
  p_source_capture_id uuid,
  p_host_framing text,
  p_tenant_id text,
  p_conversation_id text,
  p_recipient_oids text[]
)
returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_tenant text := lower(btrim(coalesce(p_tenant_id, '')));
  v_oids text[];
  v_count integer;
  -- SEPARATE variables for the existing-run probe, deliberately.
  -- `SELECT ... INTO` assigns NULL to its targets when NO row matches, so reusing
  -- `v_count` there clobbered the audience size to NULL on the ordinary
  -- create path and the INSERT then failed its NOT NULL. Caught on a disposable
  -- PostgreSQL 17 stack before this file was ever applied anywhere real.
  v_existing_id uuid;
  v_existing_count integer;
begin
  if p_owner_user_id is null or p_source_capture_id is null then
    raise exception 'missing_identity' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_host_framing, ''))) not between 1 and 1000 then
    raise exception 'invalid_framing' using errcode = 'P0001';
  end if;
  if v_tenant = '' or btrim(coalesce(p_conversation_id, '')) = '' then
    raise exception 'missing_source_context' using errcode = 'P0001';
  end if;

  -- Canonicalize and DEDUPE the selection. The picker can return the same person
  -- twice (a preselected value re-picked), and a duplicate would inflate the
  -- denominator against a set that cannot contain them twice.
  select array_agg(distinct lower(btrim(o)))
    into v_oids
    from unnest(coalesce(p_recipient_oids, array[]::text[])) as o
   where btrim(coalesce(o, '')) <> ''
     and lower(btrim(o)) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  v_count := coalesce(array_length(v_oids, 1), 0);
  if v_count < 1 then
    -- An announcement with no audience has no question to answer.
    raise exception 'zero_recipients' using errcode = 'P0001';
  end if;

  -- Already tracked by this Host for this source → return it, create nothing.
  select a.id, a.resolved_count into v_existing_id, v_existing_count
    from public.bty_tracked_announcements a
   where a.owner_user_id = p_owner_user_id
     and a.source_capture_id = p_source_capture_id;
  if v_existing_id is not null then
    return query select v_existing_id, v_existing_count, true;
    return;
  end if;

  insert into public.bty_tracked_announcements
    (owner_user_id, source_capture_id, host_framing, audience_source,
     resolved_count, status, tenant_id, conversation_id)
  values
    (p_owner_user_id, p_source_capture_id, btrim(p_host_framing), 'teams_people_picker',
     v_count, 'active', v_tenant, btrim(p_conversation_id))
  returning id into v_id;

  insert into public.bty_tracked_announcement_recipients
    (announcement_id, tenant_id, aad_object_id)
  select v_id, v_tenant, o from unnest(v_oids) as o;

  -- The denominator is the row count that actually committed, never the input
  -- length. They agree here; asserting it means they cannot silently diverge.
  select count(*) into v_count
    from public.bty_tracked_announcement_recipients r
   where r.announcement_id = v_id;
  update public.bty_tracked_announcements set resolved_count = v_count where id = v_id;

  return query select v_id, v_count, false;
end;
$$;

revoke all on function public.bty_track_announcement(uuid, uuid, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(uuid, uuid, text, text, text, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- 4. BIND — attach a canonical BTY user to the rows frozen for their Microsoft
--    identity. Idempotent, and it NEVER creates anything.
--
-- Called on canonical entry. Matching is on BOTH halves: a right oid under the
-- wrong tenant, or the reverse, binds nothing.
-- ---------------------------------------------------------------------------
create or replace function public.bty_bind_announcement_recipients(
  p_user_id uuid,
  p_tenant_id text,
  p_aad_object_id text
)
returns table (bound integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_tenant text := lower(btrim(coalesce(p_tenant_id, '')));
  v_oid text := lower(btrim(coalesce(p_aad_object_id, '')));
  v_guid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_n integer;
begin
  if p_user_id is null or v_tenant !~ v_guid or v_oid !~ v_guid then
    return query select 0; return;
  end if;

  update public.bty_tracked_announcement_recipients r
     set user_id = p_user_id, bound_at = now()
   where r.tenant_id = v_tenant
     and r.aad_object_id = v_oid
     -- Only rows not yet bound. An already-bound row is never re-pointed: the
     -- binding is historical truth, and rewriting it would move somebody's
     -- response to a different person.
     and r.user_id is null;

  get diagnostics v_n = row_count;
  return query select v_n;
end;
$$;

revoke all on function public.bty_bind_announcement_recipients(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bty_bind_announcement_recipients(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. RESPOND — write-once, owner-verified.
--
-- The caller supplies an announcement and their own authenticated id; the row
-- is found BY that pairing, so a user can only ever answer for themselves. A
-- second submission returns the settled answer and never overwrites it.
-- ---------------------------------------------------------------------------
create or replace function public.bty_respond_to_announcement(
  p_announcement_id uuid,
  p_user_id uuid,
  p_response text,
  p_question_text text
)
returns table (result text, response text, responded_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_row record;
  v_q text := nullif(btrim(coalesce(p_question_text, '')), '');
begin
  if p_response not in ('ACKNOWLEDGED', 'QUESTION', 'HELP_NEEDED') then
    return query select 'invalid_response'::text, null::text, null::timestamptz; return;
  end if;
  -- Text is only ever kept for the choice it belongs to.
  if p_response <> 'QUESTION' then
    v_q := null;
  elsif v_q is not null and char_length(v_q) > 1000 then
    return query select 'question_too_long'::text, null::text, null::timestamptz; return;
  end if;

  select r.id, r.response, r.responded_at
    into v_row
    from public.bty_tracked_announcement_recipients r
   where r.announcement_id = p_announcement_id
     and r.user_id = p_user_id
   for update;

  if not found then
    -- Not a recipient, or not bound yet. Deliberately indistinguishable from
    -- "no such announcement", so membership of someone else's audience cannot
    -- be probed.
    return query select 'not_a_recipient'::text, null::text, null::timestamptz; return;
  end if;

  if v_row.response is not null then
    return query select 'already_responded'::text, v_row.response, v_row.responded_at; return;
  end if;

  update public.bty_tracked_announcement_recipients
     set response = p_response, responded_at = now(), question_text = v_q
   where id = v_row.id;

  return query select 'responded'::text, p_response, now();
end;
$$;

revoke all on function public.bty_respond_to_announcement(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bty_respond_to_announcement(uuid, uuid, text, text) to service_role;
