-- ===========================================================================
-- PER-PERSON TEAMS CONVERSATION CREATION LEASE — A0.2R2.
--
-- ORDERING: 20260910, after 20260909000000. Neither 20260908 nor 20260909 is
-- edited, renamed, replayed, or has its ledger entry touched. External apply
-- order is 20260909 then 20260910.
--
-- ---------------------------------------------------------------------------
-- THE MEASURED RACE THIS CLOSES.
--
-- The delivery lease added in 20260909 is held per RECIPIENT ROW. Two
-- announcements addressed to the SAME Microsoft person are two rows, claimable
-- at the same instant, and both read "no conversation yet":
--
--     A: begin(recipient_A) -> ok, conversation_id NULL
--     B: begin(recipient_B) -> ok, conversation_id NULL
--     A: createConversation      B: createConversation      <-- TWO threads
--
-- Measured, not assumed: two createConversation calls, one database row.
-- `unique (tenant_id, aad_object_id)` on the refs table prevented a duplicate
-- ROW; it could not un-create a conversation that already exists inside Teams.
-- A uniqueness constraint is not an idempotency boundary for an external side
-- effect. The lock has to be scoped to the thing being created -- the PERSON --
-- not to the recipient row that happened to ask for it.
--
-- ---------------------------------------------------------------------------
-- WHY A SEPARATE TABLE, AND NOT A NULLABLE conversation_id.
--
--   bty_teams_conversation_refs            CONFIRMED EXTERNAL REALITY.
--     A row means Teams told us this 1:1 conversation exists. Nothing else may
--     ever be written there. `conversation_id` stays NOT NULL, and there are no
--     placeholder rows -- the moment "we are trying" and "it exists" share a
--     table, every reader has to ask which kind of row it is holding, and one
--     of them will eventually forget.
--
--   bty_teams_conversation_creation_claims TEMPORARY COORDINATION.
--     A row means one attempt currently owns the right to create that
--     conversation. It is deleted on success and on any proven non-creation.
--
-- The claim carries no announcement_id and no user_id: the thing being
-- serialized is one PERSON'S Teams thread, which belongs to neither.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. THE LEASE LENGTH.
--
-- Delegates to the notification lease rather than restating 120. The figure
-- exists in ONE place in this schema (20260909), and a second literal here is
-- how two leases silently drift apart. The wrapper exists so this concern has
-- its own name, and so its length can later change without touching the other.
-- ---------------------------------------------------------------------------

create or replace function public.bty_conversation_creation_claim_ttl()
returns interval
language sql
stable
set search_path = pg_catalog, public
as $$ select public.bty_notification_claim_ttl() $$;

comment on function public.bty_conversation_creation_claim_ttl() is
  'Lease length for creating one person''s Teams conversation. Delegates to bty_notification_claim_ttl() so the 120-second figure has exactly one definition in this schema.';


-- ---------------------------------------------------------------------------
-- 2. THE COORDINATION TABLE.
--
-- One row per Microsoft person, and only while a creation is being attempted.
-- ---------------------------------------------------------------------------

create table if not exists public.bty_teams_conversation_creation_claims (
  tenant_id text not null,
  aad_object_id text not null,
  claim_token uuid not null,
  claim_expires_at timestamptz not null,
  -- NULL until the outbound POST is about to happen. Non-NULL on an expired
  -- claim is the state that must never be reclaimed: a thread may exist that
  -- nobody can name.
  create_started_at timestamptz,
  -- The routing base this attempt is creating against, so a confirmation cannot
  -- pair a conversation id with a base URL it was not created on.
  service_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, aad_object_id)
);

comment on table public.bty_teams_conversation_creation_claims is
  'TEMPORARY coordination around creating one person''s 1:1 Teams conversation -- never a record that one exists. Keyed by (tenant_id, aad_object_id) because the external side effect being serialized belongs to the PERSON, not to a recipient row or an announcement. Deleted on confirmed creation and on any proven non-creation. Confirmed reality lives only in bty_teams_conversation_refs.';

alter table public.bty_teams_conversation_creation_claims enable row level security;
-- No policy, by intent: server-only, reachable through the SECURITY DEFINER
-- functions below and nowhere else. RLS with no policy is deny-all.
revoke all on table public.bty_teams_conversation_creation_claims from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. BEGIN — confirmed reality first, then coordination.
-- ---------------------------------------------------------------------------

/*
  May this attempt create the conversation for one person?

  The confirmed ref is checked FIRST and inside the database, because by the
  time a caller has decided to create, the answer may already have changed.

  ★ WHEN A REF EXISTS, BOTH HALVES COME FROM IT. A conversation id is only
  meaningful against the base URL it was created on, so the pair is returned
  together and never assembled from two sources.
*/
create or replace function public.bty_begin_teams_conversation_creation(
  p_tenant_id text,
  p_aad_object_id text,
  p_service_url text
)
returns table (result text, claim_token uuid, service_url text, conversation_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_tenant text := lower(btrim(coalesce(p_tenant_id, '')));
  v_aad text := lower(btrim(coalesce(p_aad_object_id, '')));
  v_url text := btrim(coalesce(p_service_url, ''));
  v_ref_url text;
  v_ref_conv text;
  v_token uuid;
  v_expires timestamptz;
  v_started timestamptz;
  v_new uuid;
  v_now timestamptz := now();
begin
  if v_tenant = '' or v_aad = '' or v_url = '' then
    return query select 'invalid_identity'::text, null::uuid, null::text, null::text; return;
  end if;

  select c.service_url, c.conversation_id into v_ref_url, v_ref_conv
    from public.bty_teams_conversation_refs c
   where c.tenant_id = v_tenant and c.aad_object_id = v_aad;
  if found then
    -- Nothing to create. The canonical pair, from the one row that owns it.
    return query select 'already_exists'::text, null::uuid, v_ref_url, v_ref_conv; return;
  end if;

  -- Serialize on the person. `for update` here is what makes the read and the
  -- claim write atomic against the other announcement's attempt.
  select k.claim_token, k.claim_expires_at, k.create_started_at
    into v_token, v_expires, v_started
    from public.bty_teams_conversation_creation_claims k
   where k.tenant_id = v_tenant and k.aad_object_id = v_aad
     for update;

  if found then
    if v_expires > v_now then
      -- Another announcement's attempt owns this person's thread right now.
      return query select 'in_progress'::text, null::uuid, null::text, null::text; return;
    end if;
    if v_started is not null then
      -- The lease died after the POST began. A Teams thread may exist whose id
      -- was never learned. Creating another is exactly the duplicate this
      -- table exists to prevent.
      return query select 'conversation_creation_unknown'::text, null::uuid, null::text, null::text; return;
    end if;
    v_new := gen_random_uuid();
    update public.bty_teams_conversation_creation_claims
       set claim_token = v_new,
           claim_expires_at = v_now + public.bty_conversation_creation_claim_ttl(),
           create_started_at = null,
           service_url = v_url,
           updated_at = v_now
     where tenant_id = v_tenant and aad_object_id = v_aad;
    return query select 'ok'::text, v_new, v_url, null::text; return;
  end if;

  v_new := gen_random_uuid();
  insert into public.bty_teams_conversation_creation_claims
    (tenant_id, aad_object_id, claim_token, claim_expires_at, create_started_at, service_url)
  values
    (v_tenant, v_aad, v_new, v_now + public.bty_conversation_creation_claim_ttl(), null, v_url);
  return query select 'ok'::text, v_new, v_url, null::text;
end;
$$;

/*
  4. THE CREATE BOUNDARY. Called immediately before the createConversation POST.

  A confirmed ref appearing in the meantime wins: another legitimate owner
  finished first, and creating now would make a second thread on purpose.
*/
create or replace function public.bty_mark_teams_conversation_creating(
  p_tenant_id text,
  p_aad_object_id text,
  p_claim_token uuid
)
returns table (result text, service_url text, conversation_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_tenant text := lower(btrim(coalesce(p_tenant_id, '')));
  v_aad text := lower(btrim(coalesce(p_aad_object_id, '')));
  v_ref_url text;
  v_ref_conv text;
  v_token uuid;
  v_expires timestamptz;
  v_started timestamptz;
  v_now timestamptz := now();
begin
  select k.claim_token, k.claim_expires_at, k.create_started_at
    into v_token, v_expires, v_started
    from public.bty_teams_conversation_creation_claims k
   where k.tenant_id = v_tenant and k.aad_object_id = v_aad
     for update;
  if not found then return query select 'claim_mismatch'::text, null::text, null::text; return; end if;

  select c.service_url, c.conversation_id into v_ref_url, v_ref_conv
    from public.bty_teams_conversation_refs c
   where c.tenant_id = v_tenant and c.aad_object_id = v_aad;
  if found then
    return query select 'already_exists'::text, v_ref_url, v_ref_conv; return;
  end if;

  if v_token is distinct from p_claim_token then
    return query select 'claim_mismatch'::text, null::text, null::text; return;
  end if;
  if v_expires <= v_now then return query select 'claim_expired'::text, null::text, null::text; return; end if;
  if v_started is not null then return query select 'already_creating'::text, null::text, null::text; return; end if;

  update public.bty_teams_conversation_creation_claims
     set create_started_at = v_now, updated_at = v_now
   where tenant_id = v_tenant and aad_object_id = v_aad;
  return query select 'creating'::text, null::text, null::text;
end;
$$;

/*
  5. CONFIRM. Teams created it. Record reality and drop the coordination, in ONE
     transaction, so no window exists where a thread is real and unrecorded.

  A stale token can never replace a confirmed reference: an existing ref short
  circuits before any write, and the canonical pair is returned instead.
*/
create or replace function public.bty_confirm_teams_conversation_created(
  p_tenant_id text,
  p_aad_object_id text,
  p_claim_token uuid,
  p_service_url text,
  p_conversation_id text
)
returns table (result text, service_url text, conversation_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_tenant text := lower(btrim(coalesce(p_tenant_id, '')));
  v_aad text := lower(btrim(coalesce(p_aad_object_id, '')));
  v_url text := btrim(coalesce(p_service_url, ''));
  v_conv text := btrim(coalesce(p_conversation_id, ''));
  v_ref_url text;
  v_ref_conv text;
  v_token uuid;
  v_started timestamptz;
begin
  if v_url = '' or v_conv = '' then
    return query select 'invalid_conversation'::text, null::text, null::text; return;
  end if;

  select k.claim_token, k.create_started_at into v_token, v_started
    from public.bty_teams_conversation_creation_claims k
   where k.tenant_id = v_tenant and k.aad_object_id = v_aad
     for update;

  select c.service_url, c.conversation_id into v_ref_url, v_ref_conv
    from public.bty_teams_conversation_refs c
   where c.tenant_id = v_tenant and c.aad_object_id = v_aad;
  if found then
    -- Someone legitimate finished first. The canonical pair stands; this
    -- attempt's id is discarded rather than overwriting a confirmed reality.
    return query select 'already_exists'::text, v_ref_url, v_ref_conv; return;
  end if;

  if v_token is null or v_token is distinct from p_claim_token then
    return query select 'claim_mismatch'::text, null::text, null::text; return;
  end if;
  if v_started is null then
    -- A confirmation for a creation that never began did not come from a real
    -- createConversation, and must not be able to write a reference.
    return query select 'create_not_started'::text, null::text, null::text; return;
  end if;

  insert into public.bty_teams_conversation_refs
    (tenant_id, aad_object_id, service_url, conversation_id)
  values (v_tenant, v_aad, v_url, v_conv)
  on conflict (tenant_id, aad_object_id) do update
    set service_url = excluded.service_url,
        conversation_id = excluded.conversation_id,
        updated_at = now();

  delete from public.bty_teams_conversation_creation_claims
   where tenant_id = v_tenant and aad_object_id = v_aad;

  return query select 'created'::text, v_url, v_conv;
end;
$$;

/*
  6. RELEASE. ONLY for outcomes that prove no conversation was created.

  The caller decides which those are -- it is the only party that saw the HTTP
  result -- but a token that no longer owns the row is refused, so a zombie
  cannot free a newer owner's lease.
*/
create or replace function public.bty_release_teams_conversation_creation_claim(
  p_tenant_id text,
  p_aad_object_id text,
  p_claim_token uuid
)
returns table (result text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_tenant text := lower(btrim(coalesce(p_tenant_id, '')));
  v_aad text := lower(btrim(coalesce(p_aad_object_id, '')));
  v_token uuid;
begin
  select k.claim_token into v_token
    from public.bty_teams_conversation_creation_claims k
   where k.tenant_id = v_tenant and k.aad_object_id = v_aad
     for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_token is distinct from p_claim_token then
    return query select 'claim_mismatch'::text; return;
  end if;
  delete from public.bty_teams_conversation_creation_claims
   where tenant_id = v_tenant and aad_object_id = v_aad;
  return query select 'released'::text;
end;
$$;


-- ---------------------------------------------------------------------------
-- 7. THE ROUTING PAIR REPAIR.
--
-- 20260908 returned `announcement.service_url` alongside
-- `conversation_refs.conversation_id`, which contradicts that same migration's
-- own invariant: "a conversation id is only meaningful against the base URL it
-- was created on". If an announcement were ever tracked from a different
-- regional base than the one a person's thread was created on, the send would
-- be posted to a conversation that does not exist there.
--
-- Now: a confirmed ref supplies BOTH halves; with no ref, the announcement's
-- observed coordinate is returned and the conversation is NULL.
--
-- ★ `no_service_url` STILL TESTS THE ANNOUNCEMENT, deliberately. A historical
-- announcement has no observed coordinate and must stay unroutable even if a
-- confirmed conversation with that person later exists -- otherwise applying
-- this migration would quietly make rows like 6cfccb92 notifiable, which is a
-- product decision and not a repair.
-- ---------------------------------------------------------------------------

create or replace function public.bty_begin_recipient_notification(
  p_recipient_id uuid,
  p_owner_user_id uuid
)
returns table (
  result text,
  claim_token uuid,
  tenant_id text,
  aad_object_id text,
  service_url text,
  host_framing text,
  conversation_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_owner uuid;
  v_notified timestamptz;
  v_tenant text;
  v_aad text;
  v_ann_url text;
  v_framing text;
  v_ref_url text;
  v_ref_conv text;
  v_claim uuid;
  v_expires timestamptz;
  v_started timestamptz;
  v_new uuid;
  v_now timestamptz := now();
begin
  select a.owner_user_id, r.notified_at, r.tenant_id, r.aad_object_id,
         a.service_url, a.host_framing,
         r.notification_claim_token, r.notification_claim_expires_at, r.notification_send_started_at
    into v_owner, v_notified, v_tenant, v_aad, v_ann_url, v_framing, v_claim, v_expires, v_started
    from public.bty_tracked_announcement_recipients r
    join public.bty_tracked_announcements a on a.id = r.announcement_id
   where r.id = p_recipient_id
     for update of r;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if v_owner is distinct from p_owner_user_id then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if v_notified is not null then
    return query select 'already_notified'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if coalesce(btrim(v_ann_url), '') = '' then
    return query select 'no_service_url'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if v_claim is not null and v_expires > v_now then
    return query select 'in_progress'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;
  if v_claim is not null and v_started is not null then
    return query select 'delivery_unknown'::text, null::uuid, null::text, null::text, null::text, null::text, null::text; return;
  end if;

  v_new := gen_random_uuid();
  update public.bty_tracked_announcement_recipients
     set notification_claim_token = v_new,
         notification_claim_expires_at = v_now + public.bty_notification_claim_ttl(),
         notification_send_started_at = null
   where id = p_recipient_id;

  -- THE PAIR. Both halves from the confirmed reference, or neither.
  select c.service_url, c.conversation_id into v_ref_url, v_ref_conv
    from public.bty_teams_conversation_refs c
   where c.tenant_id = v_tenant and c.aad_object_id = v_aad;

  if v_ref_conv is not null then
    return query select 'ok'::text, v_new, v_tenant, v_aad, v_ref_url, v_framing, v_ref_conv; return;
  end if;
  return query select 'ok'::text, v_new, v_tenant, v_aad, v_ann_url, v_framing, null::text;
end;
$$;


revoke all on function public.bty_conversation_creation_claim_ttl() from public, anon, authenticated;
grant execute on function public.bty_conversation_creation_claim_ttl() to service_role;
revoke all on function public.bty_begin_teams_conversation_creation(text, text, text) from public, anon, authenticated;
grant execute on function public.bty_begin_teams_conversation_creation(text, text, text) to service_role;
revoke all on function public.bty_mark_teams_conversation_creating(text, text, uuid) from public, anon, authenticated;
grant execute on function public.bty_mark_teams_conversation_creating(text, text, uuid) to service_role;
revoke all on function public.bty_confirm_teams_conversation_created(text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bty_confirm_teams_conversation_created(text, text, uuid, text, text) to service_role;
revoke all on function public.bty_release_teams_conversation_creation_claim(text, text, uuid) from public, anon, authenticated;
grant execute on function public.bty_release_teams_conversation_creation_claim(text, text, uuid) to service_role;
revoke all on function public.bty_begin_recipient_notification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_begin_recipient_notification(uuid, uuid) to service_role;

-- The blind upsert from 20260908 could write a reference with no claim behind
-- it, which is exactly how a confirmed reality gets overwritten by a zombie.
-- Confirmation now goes through bty_confirm_teams_conversation_created.
drop function if exists public.bty_upsert_teams_conversation_ref(text, text, text, text);
