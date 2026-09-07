-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- HOST TRACK HISTORY RETENTION V1.
--
-- ★ DELETING AN ACCOUNT MUST NOT DELETE OTHER PEOPLE'S HISTORY.
--
-- Today, deleting a Host erases the announcement, every recipient, every
-- response, every question and every conversation -- for everybody. Deleting a
-- RECIPIENT does the opposite: 20260914 made that preserve all of it. The
-- asymmetry was never a decision; it was the default behaviour of an FK clause.
--
-- ★ AND THE OBVIOUS FIX DOES NOTHING. MEASURED, on PostgreSQL 17.10, with
-- `owner_user_id` made nullable + ON DELETE SET NULL and nothing else:
--
--     BEFORE  announcements=1 recipients=1 messages=1
--     DELETE 1
--     AFTER   announcements=0 recipients=0 messages=0
--
-- Because there are TWO paths from the Host'''s account to the same rows:
--
--   1  announcements.owner_user_id      -> auth.users            CASCADE
--   2  bty_action_captures.user_id      -> auth.users            CASCADE
--        -> announcements.source_capture_id -> captures          CASCADE
--
-- Repairing only the first would have shipped looking correct. Both are
-- repaired here.
--
-- ★ WHAT SURVIVES AND WHAT DOES NOT.
--
--   SURVIVES   the announcement and the Host'''s own framing text, every
--              recipient row, every response and question, every thread
--              message and its author_role, every dismissal row.
--   GOES       the Host'''s authority (owner_user_id becomes NULL, and every
--              existing gate already refuses a NULL owner), the Host'''s private
--              capture (their saved Teams material is theirs), and the Host'''s
--              own read receipts (also theirs).
--
-- The Track becomes HISTORICAL: readable, and closed to new writing.
--
-- ★ NO NEW STATUS COLUMN. `status` already exists and means "the Host
-- deliberately closed this run". `owner_user_id IS NULL` will mean "there is no
-- Host". Two different facts; neither is overloaded, and no trigger is needed to
-- keep them in step. An FK cascade cannot write `status` anyway.
--
-- ROLLBACK (reverse order; the data changes are not reversible by DDL alone):
--   drop trigger if exists bty_tracked_ann_snapshot_immutable_trg
--     on public.bty_tracked_announcements;
--   drop function if exists public.bty_tracked_ann_snapshot_immutable();
--   alter table public.bty_tracked_announcements drop column if exists owner_user_id_snapshot;
--   -- and re-declare both FKs as ON DELETE CASCADE with NOT NULL columns.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. THE TWO FOREIGN KEYS.
--
-- Dropped by their MEASURED name rather than an assumed one. 20260902 declared
-- both inline, so PostgreSQL generated the names -- and a migration that
-- hardcodes a generated name is a migration that fails on a database where
-- somebody once renamed something. This looks the name up from pg_constraint
-- and fails closed if the column does not have exactly one foreign key.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_name text;
  v_n integer;
begin
  for r in
    select * from (values
      ('owner_user_id',     'auth.users',                    'id'),
      ('source_capture_id', 'public.bty_action_captures',    'id')
    ) as t(col, target, target_col)
  loop
    select count(*), min(c.conname) into v_n, v_name
      from pg_catalog.pg_constraint c
     where c.conrelid = 'public.bty_tracked_announcements'::regclass
       and c.contype = 'f'
       and c.conkey = array[(select a.attnum from pg_catalog.pg_attribute a
                              where a.attrelid = c.conrelid and a.attname = r.col)];

    if v_n = 0 then
      -- Already re-declared by a previous run of this file: re-entrant, not an error.
      continue;
    elsif v_n > 1 then
      raise exception using errcode = 'P0001',
        message = format('bty_tracked_announcements.%s has %s foreign keys -- refusing to guess', r.col, v_n);
    end if;

    execute format('alter table public.bty_tracked_announcements drop constraint %I', v_name);
    execute format('alter table public.bty_tracked_announcements alter column %I drop not null', r.col);
    execute format('alter table public.bty_tracked_announcements add constraint %I foreign key (%I) references %s (%I) on delete set null',
                   v_name, r.col, r.target, r.target_col);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 2. HISTORICAL ATTRIBUTION, SEPARATED FROM AUTHORITY.
--
-- `owner_user_id` was doing two jobs at once -- who may act, and who created
-- this -- which is exactly why deleting an account was unsafe. They are split
-- here, following the precedent this schema already set in `foundry_programs`:
-- a live convenience FK that may go NULL, beside an immutable value snapshot.
--
-- ★ NO FOREIGN KEY, DELIBERATELY. An FK would take the value with the account
-- and defeat the entire purpose. It is a value, not a reference.
--
-- ★ AND IT GRANTS NOTHING. Nothing in this system reads it to decide anything.
-- It exists so that "who tracked this" survives, not so that anybody can still
-- act as them. Authority is `owner_user_id`, and only `owner_user_id`.
--
-- ★ NO EMAIL, NO UPN, NO DISPLAY NAME. A human-readable label would be a second
-- identity store that ages badly and leaks. Display resolves through
-- auth.identities at read time and simply falls back to "Host" when the account
-- is gone.
--
-- Backfilled from the live owner, then made NOT NULL. Every announcement in
-- production has a non-null owner today (measured 2026-09-06: 10 of 10), so the
-- backfill cannot leave a row behind; if one somehow did, SET NOT NULL fails
-- loudly rather than inventing a creator.
-- ---------------------------------------------------------------------------
alter table public.bty_tracked_announcements
  add column if not exists owner_user_id_snapshot uuid;

update public.bty_tracked_announcements
   set owner_user_id_snapshot = owner_user_id
 where owner_user_id_snapshot is null
   and owner_user_id is not null;

alter table public.bty_tracked_announcements
  alter column owner_user_id_snapshot set not null;

create index if not exists bty_tracked_ann_owner_snapshot_idx
  on public.bty_tracked_announcements (owner_user_id_snapshot);

comment on column public.bty_tracked_announcements.owner_user_id is
  'The CURRENT Host, and the ONLY authority. NULL means the account was deleted and nobody is Host: every gate compares against this and a NULL matches no one. It is not a record of who created the run -- that is owner_user_id_snapshot.';
comment on column public.bty_tracked_announcements.owner_user_id_snapshot is
  'WHO CREATED THIS RUN. An immutable value copy, written once at creation and enforced by a trigger. No foreign key, deliberately -- it must outlive the account. It grants NOTHING: it is never consulted for Host role, thread role, handling, notification, Today ownership, dismissal ownership or reassignment.';


-- ---------------------------------------------------------------------------
-- 3. THE SNAPSHOT IS IMMUTABLE, AND THE DATABASE IS WHAT SAYS SO.
--
-- A comment is not a mechanism. A column-scoped UPDATE grant would also not be
-- enough here: SECURITY DEFINER functions run as their owner and are not bound
-- by role grants, and every write to this table goes through one. A trigger
-- catches every writer there is.
--
-- It compares rather than blanket-refusing, so an UPDATE that merely carries
-- the column along unchanged -- which is what an ORM or a full-row update does
-- -- still works. Only an actual CHANGE is refused.
-- ---------------------------------------------------------------------------
create or replace function public.bty_tracked_ann_snapshot_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.owner_user_id_snapshot is distinct from old.owner_user_id_snapshot then
    raise exception
      using errcode = 'P0001',
            message = 'bty_tracked_announcements.owner_user_id_snapshot is immutable',
            detail  = format('attempted to change %s to %s',
                             coalesce(old.owner_user_id_snapshot::text, 'NULL'),
                             coalesce(new.owner_user_id_snapshot::text, 'NULL')),
            hint    = 'Historical attribution is written once at creation. Current authority is owner_user_id.';
  end if;
  return new;
end;
$$;

drop trigger if exists bty_tracked_ann_snapshot_immutable_trg on public.bty_tracked_announcements;
create trigger bty_tracked_ann_snapshot_immutable_trg
  before update on public.bty_tracked_announcements
  for each row
  execute function public.bty_tracked_ann_snapshot_immutable();


-- ---------------------------------------------------------------------------
-- 4. THE CAPTURE MAY DIE; THE TRACK MAY NOT.
--
-- MEASURED on production 2026-09-06: `service_role` still holds DELETE on
-- `bty_action_captures` -- the same ambient authority 20260914 removed from the
-- Track tables, left behind because that file scoped itself to Track. And the
-- whole repository contains no DELETE against captures: the service layer uses
-- only select, insert, update and rpc.
--
-- With section 1 in place, deleting a capture no longer destroys a Track -- it
-- only detaches the source link. That is a much smaller blast radius than
-- before, and precisely why the ambient capability should go now rather than
-- being left as the one remaining way to quietly damage Track evidence.
--
-- ★ NOT SEALED. FK cascades still run (referential-integrity actions are
-- performed on behalf of the constraint, not the calling role), so a deleted
-- Host'''s private capture still disappears with their account -- which is the
-- product contract. SECURITY DEFINER functions still work; they run as owner.
--
-- ★ service_role IS NAMED IN THE REVOKE. Supabase'''s default privileges granted
-- it ALL at CREATE time, so a revoke that omits it enforces nothing.
-- ---------------------------------------------------------------------------
revoke all on public.bty_action_captures from anon, public, authenticated, service_role;
grant select, insert, update on public.bty_action_captures to service_role;


-- ---------------------------------------------------------------------------
-- 5. TRACK CREATION WRITES THE SNAPSHOT.
--
-- The canonical 7-argument function, replaced body-and-all from the version
-- 20260912 installed, with ONE splice: the INSERT now also writes
-- `owner_user_id_snapshot`. Signature, return shape, SECURITY DEFINER,
-- search_path, the argument ORDER (p_service_url sixth), the identity gate, the
-- self-recipient exclusion and the idempotency behaviour are byte-identical to
-- what is live.
-- ---------------------------------------------------------------------------
create or replace function public.bty_track_announcement(
  p_owner_user_id uuid,
  p_source_capture_id uuid,
  p_host_framing text,
  p_tenant_id text,
  p_conversation_id text,
  p_service_url text,
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
  v_owner_oids text[];
  -- SEPARATE variables for the existing-run probe, deliberately.
  -- `SELECT ... INTO` assigns NULL to its targets when NO row matches, so reusing
  -- `v_count` there clobbered the audience size to NULL on the ordinary
  -- create path and the INSERT then failed its NOT NULL. Caught on a disposable
  -- PostgreSQL 17 stack before this file was ever applied anywhere real.
  v_existing_id uuid;
  v_existing_count integer;
  -- Empty string is not a routing URL. Normalising it to NULL here means the
  -- column has ONE spelling for "not observed" and a later "is not null" test
  -- cannot be fooled by ''.
  v_service_url text := nullif(btrim(coalesce(p_service_url, '')), '');
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

  -- A stored routing URL must be an absolute https origin. The caller already
  -- validates this; the rule is repeated here because this function is the
  -- only writer, and a guard that lives only in the caller is a guard that a
  -- second caller will not have. NOT a hard refusal: routing metadata must
  -- never be able to stop a Host from tracking. Unusable input becomes NULL.
  if v_service_url is not null and v_service_url !~* '^https://[a-z0-9.-]+(:[0-9]+)?(/|$)' then
    v_service_url := null;
  end if;

  -- ★ THE HOST'S OWN ENTRA OBJECT IDS, read the way this schema already reads
  -- them: `identity_data->'custom_claims'->>'oid'` on an `azure` identity. The
  -- oid is NOT at the top level and `provider_id` is the `sub`, never the oid --
  -- a wrong path matches nothing, which here would mean silently NOT excluding
  -- the Host.
  --
  -- EVERY identity, not one. `bty_bind_announcement_recipients_for_user` fails
  -- closed on two Microsoft identities because it must CHOOSE which to bind.
  -- Exclusion has no such problem -- it removes the union -- so a Host with two
  -- identities is fully protected and is never refused a legitimate Track.
  select coalesce(
           array_agg(lower(btrim(i.identity_data->'custom_claims'->>'oid'))),
           array[]::text[]
         )
    into v_owner_oids
    from auth.identities i
   where i.user_id = p_owner_user_id
     and i.provider = 'azure'
     and i.identity_data->'custom_claims'->>'oid' is not null;

  -- Canonicalize and DEDUPE the selection. The picker can return the same person
  -- twice (a preselected value re-picked), and a duplicate would inflate the
  -- denominator against a set that cannot contain them twice.
  select array_agg(distinct lower(btrim(o)))
    into v_oids
    from unnest(coalesce(p_recipient_oids, array[]::text[])) as o
   where btrim(coalesce(o, '')) <> ''
     and lower(btrim(o)) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     -- ★ THE HOST IS NOT IN THEIR OWN AUDIENCE. A person cannot be both parties
     -- to a private two-party conversation: the resolver would call them HOST
     -- while the first-response bridge writes their own first message as
     -- RECIPIENT, so their own question would render as somebody else's and
     -- count as unread against themselves.
     and not (lower(btrim(o)) = any (v_owner_oids));

  v_count := coalesce(array_length(v_oids, 1), 0);
  if v_count < 1 then
    -- An announcement with no audience has no question to answer. A Host who
    -- selected only themselves lands here, which is the intended refusal.
    raise exception 'zero_recipients' using errcode = 'P0001';
  end if;

  -- Already tracked by this Host for this source → return it, create nothing.
  --
  -- ★ AND DO NOT REWRITE ITS service_url. A retry, a double tap and a slow
  -- client all arrive here, and none of them is evidence that the routing
  -- coordinate CHANGED -- only that the same Track happened again. Overwriting
  -- would let the newest request silently re-point an announcement that may
  -- already have been notified against the old coordinate. An existing run is
  -- returned exactly as it stands; a historical NULL therefore stays NULL, and
  -- moving one is a deliberate future decision with its own evidence, not a
  -- side effect of pressing Track twice.
  select a.id, a.resolved_count into v_existing_id, v_existing_count
    from public.bty_tracked_announcements a
   where a.owner_user_id = p_owner_user_id
     and a.source_capture_id = p_source_capture_id;
  if v_existing_id is not null then
    return query select v_existing_id, v_existing_count, true;
    return;
  end if;

  /*
    ★ THE SNAPSHOT IS WRITTEN HERE, EXPLICITLY, AT CREATION.

    Not a column DEFAULT: a default derived from `owner_user_id` would be a
    second place that decides who created a run, and the two would eventually
    disagree. This is the only writer, it copies the argument this function was
    already given, and a trigger makes the value immutable from then on.
  */
  insert into public.bty_tracked_announcements
    (owner_user_id, owner_user_id_snapshot, source_capture_id, host_framing, audience_source,
     resolved_count, status, tenant_id, conversation_id, service_url)
  values
    (p_owner_user_id, p_owner_user_id, p_source_capture_id, btrim(p_host_framing), 'teams_people_picker',
     v_count, 'active', v_tenant, btrim(p_conversation_id), v_service_url)
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

revoke all on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) to service_role;


-- ---------------------------------------------------------------------------
-- 6. NO HOST, NO NEW WORDS.
--
-- Both recipient write paths are replaced with ONE splice each: a refusal when
-- the announcement has no owner, expressed as the same domain fact --
-- `host_unavailable` -- rather than a database error the UI would have to guess
-- at.
--
-- ★ THE REFUSAL SITS AFTER THE MEMBERSHIP GATE IN BOTH. `not_found` /
-- `not_a_recipient` still answer first, so a stranger cannot learn whether an
-- announcement exists, let alone whether its Host still has an account.
--
-- ★ READING IS UNAFFECTED. `bty_resolve_announcement_thread_role` and
-- `bty_mark_announcement_thread_read` are untouched: a recipient can still open
-- and read the conversation, including a reply the Host wrote before the account
-- was deleted. Those words were really sent to that person.
-- ---------------------------------------------------------------------------
create or replace function public.bty_post_announcement_thread_message(
  p_recipient_id uuid,
  p_actor_user_id uuid,
  p_body text,
  p_client_message_id text
)
returns table (result text, message_id uuid, author_role text, created_at timestamptz, reopened boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_role text;
  v_body text := btrim(coalesce(p_body, ''));
  v_key text := nullif(btrim(coalesce(p_client_message_id, '')), '');
  v_existing record;
  v_id uuid;
  v_now timestamptz;
  v_reopened boolean := false;
begin
  select r.role into v_role
    from public.bty_resolve_announcement_thread_role(p_recipient_id, p_actor_user_id) as r;

  if v_role is null or v_role = 'none' then
    return query select 'not_found'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;

  /*
    ★ NO HOST, NO NEW WORDS -- and this is checked AFTER the role gate so it can
    only ever be reached by someone who is genuinely part of this thread.
    Membership of somebody else's conversation is still not probeable.

    A message written into a Track whose Host account is gone would be a person
    talking to nobody, with every appearance of having been delivered. Reading
    what was already said stays allowed: those words were really sent.
  */
  if exists (
    select 1
      from public.bty_tracked_announcement_recipients r
      join public.bty_tracked_announcements a on a.id = r.announcement_id
     where r.id = p_recipient_id
       and a.owner_user_id is null
  ) then
    return query select 'host_unavailable'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;

  -- Nothing to say is not a message. Checked before the length bound so an
  -- all-whitespace body is 'empty_message' rather than a confusing size error.
  if char_length(v_body) < 1 then
    return query select 'empty_message'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;
  if char_length(v_body) > 1000 then
    return query select 'message_too_long'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;
  if v_key is not null and char_length(v_key) > 100 then
    return query select 'invalid_client_key'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;

  if v_key is not null then
    select m.id, m.author_role, m.created_at
      into v_existing
      from public.bty_announcement_thread_messages m
     where m.recipient_id = p_recipient_id
       and m.author_user_id = p_actor_user_id
       and m.client_message_id = v_key;
    if found then
      -- The same act, seen twice. The first message stands, untouched, and
      -- nothing is reopened: no NEW thing was said.
      return query select 'duplicate'::text, v_existing.id, v_existing.author_role, v_existing.created_at, false;
      return;
    end if;
  end if;

  insert into public.bty_announcement_thread_messages
    (recipient_id, author_user_id, author_role, body, client_message_id)
  values
    (p_recipient_id, p_actor_user_id, v_role, v_body, v_key)
  returning id, created_at into v_id, v_now;

  -- ★ THE REOPEN. Same transaction as the message it is caused by, so an item
  -- can never be settled while an unanswered message from that person exists.
  -- Guarded, so the ordinary case writes nothing at all.
  if v_role = 'RECIPIENT' then
    update public.bty_tracked_announcement_recipients
       set handled_at = null, handled_by_user_id = null
     where id = p_recipient_id
       and handled_at is not null;
    if found then
      v_reopened := true;
    end if;
  end if;

  return query select 'posted'::text, v_id, v_role, v_now, v_reopened;
exception
  when unique_violation then
    -- Two requests carrying the same nonce raced past the lookup. Exactly one
    -- row exists; return it, so the loser sees the same answer as the winner.
    select m.id, m.author_role, m.created_at
      into v_existing
      from public.bty_announcement_thread_messages m
     where m.recipient_id = p_recipient_id
       and m.author_user_id = p_actor_user_id
       and m.client_message_id = v_key;
    if found then
      return query select 'duplicate'::text, v_existing.id, v_existing.author_role, v_existing.created_at, false;
      return;
    end if;
    return query select 'failed'::text, null::uuid, null::text, null::timestamptz, false;
end;
$$;

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
  v_now timestamptz;
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

  /*
    ★ SAME DOMAIN FACT AS THE THREAD PATH: there is no Host to answer.
    Deliberately after `not_a_recipient`, so this can only be reached by someone
    who really is in this audience.
  */
  if exists (
    select 1 from public.bty_tracked_announcements a
     where a.id = p_announcement_id and a.owner_user_id is null
  ) then
    return query select 'host_unavailable'::text, null::text, null::timestamptz; return;
  end if;

  if v_row.response is not null then
    return query select 'already_responded'::text, v_row.response, v_row.responded_at; return;
  end if;

  v_now := now();

  update public.bty_tracked_announcement_recipients
     set response = p_response, responded_at = v_now, question_text = v_q
   where id = v_row.id;

  -- ★ THE BRIDGE. The question a person just typed IS the first thing said in
  -- their conversation, and it becomes that in the same transaction as the
  -- disposition it belongs to. `author_role` is RECIPIENT because this function
  -- located the row BY the caller's own user id -- the same proof the update
  -- above rests on, not a second assumption.
  if p_response = 'QUESTION' and v_q is not null then
    insert into public.bty_announcement_thread_messages
      (recipient_id, author_user_id, author_role, body, created_at)
    values
      (v_row.id, p_user_id, 'RECIPIENT', v_q, v_now);
  end if;

  return query select 'responded'::text, p_response, v_now;
end;
$$;
