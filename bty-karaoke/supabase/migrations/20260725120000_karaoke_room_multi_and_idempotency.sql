-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — ROOM-LIMIT POLICY CORRECTION + CREATION IDEMPOTENCY (Part A).
-- Room count is NOT a billing boundary: FREE and PRO Hosts may own multiple Rooms.
-- This migration (a) removes the FREE=1/PRO=3 cap, (b) adds request-level idempotency
-- to BOTH first-Room and additional-Room creation, keyed on (account_id,
-- idempotency_key) with a server-computed request fingerprint, and (c) counts owned
-- Rooms by the canonical active-membership → ownership path. Isolated bty-karaoke
-- Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent; never rewrites or
-- destroys any prior migration or any existing Room.
--
-- Rollout compatibility (rule 11): the CURRENT 4-arg create_additional_karaoke_room and
-- 5-arg create_karaoke_room are preserved (the 4-arg is replaced in place to drop the
-- cap; the 5-arg is untouched) so already-deployed code keeps working. NEW keyed
-- overloads (6-arg additional, 7-arg first) add the idempotency contract for new code.
-- The old signatures are retired in a later cleanup migration once new code is fully live.
--
-- Idempotency contract (both keyed overloads):
--   * key and fingerprint are REQUIRED — a null/blank either → invalid_idempotency_key /
--     invalid_request_fingerprint, zero writes (fail-closed).
--   * same key + same fingerprint → replays the SAME Room (never a second Room).
--   * same key + different fingerprint → idempotency_conflict, zero writes.
--   * the recorded Room later vanished (room_id set null on delete) → idempotency_target_missing.
--
-- Rollback:
--   drop function if exists public.create_additional_karaoke_room(uuid, text, text, text, text, text);
--   drop function if exists public.create_karaoke_room(uuid, text, text, text, text, text, text);
--   drop table    if exists public.karaoke_room_creation_idempotency;

-- 1. IDEMPOTENCY LEDGER -------------------------------------------------------------
-- One row per (account, idempotency_key). request_fingerprint = hash(version + normalized
-- display name), computed SERVER-SIDE (never submitted by the browser). room_id is
-- nullable + ON DELETE SET NULL so a deleted Room does not silently free a key to make a
-- brand-new Room — replays then return idempotency_target_missing, preserving the key's
-- meaning permanently.
create table if not exists public.karaoke_room_creation_idempotency (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.karaoke_accounts(id) on delete cascade,
  idempotency_key     text not null check (char_length(idempotency_key) between 1 and 128),
  request_fingerprint text not null check (char_length(request_fingerprint) between 1 and 128),
  room_id             uuid references public.karaoke_rooms(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (account_id, idempotency_key)
);

create index if not exists karaoke_room_creation_idempotency_account_idx
  on public.karaoke_room_creation_idempotency (account_id, created_at desc);

-- RLS default-deny; the browser must never reach this table. service_role only.
alter table public.karaoke_room_creation_idempotency enable row level security;
revoke all on table public.karaoke_room_creation_idempotency from public, anon, authenticated;
grant select, insert on table public.karaoke_room_creation_idempotency to service_role;

-- 2. FIRST-ROOM keyed overload (7-arg) — create_karaoke_room + idempotency ----------
-- Same first-Room contract as the 5-arg (has_room short-circuit via the canonical
-- membership path; creates the workspace/membership when needed) PLUS request-level
-- idempotency. Records the ledger row only on an actual CREATE; the has_room branch is
-- already idempotent by construction.
create or replace function public.create_karaoke_room(
  p_account_id         uuid,
  p_slug               text,
  p_display_name       text,
  p_dj_secret          text,
  p_workspace_name     text,
  p_idempotency_key    text,
  p_request_fingerprint text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_workspace_id  uuid;
  v_room_id       uuid;
  v_existing_id   uuid;
  v_existing_slug text;
  v_key           text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_fp            text := nullif(btrim(coalesce(p_request_fingerprint, '')), '');
  v_prior         public.karaoke_room_creation_idempotency%rowtype;
  v_prior_slug    text;
begin
  perform pg_advisory_xact_lock(hashtext('karaoke_first_room:' || p_account_id::text));

  -- Fail closed: the keyed contract requires both a key and a fingerprint.
  if v_key is null then return jsonb_build_object('outcome', 'invalid_idempotency_key'); end if;
  if v_fp  is null then return jsonb_build_object('outcome', 'invalid_request_fingerprint'); end if;

  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('outcome', 'account_not_found');
  end if;

  -- Idempotency replay.
  select * into v_prior
    from public.karaoke_room_creation_idempotency
   where account_id = p_account_id and idempotency_key = v_key
   limit 1;
  if found then
    if v_prior.request_fingerprint is distinct from v_fp then
      return jsonb_build_object('outcome', 'idempotency_conflict');
    end if;
    if v_prior.room_id is null then
      return jsonb_build_object('outcome', 'idempotency_target_missing');
    end if;
    select slug into v_prior_slug from public.karaoke_rooms where id = v_prior.room_id;
    if v_prior_slug is null then
      return jsonb_build_object('outcome', 'idempotency_target_missing');
    end if;
    return jsonb_build_object('outcome', 'created', 'slug', v_prior_slug, 'roomId', v_prior.room_id, 'replayed', true);
  end if;

  -- Canonical owns-a-Room check (active membership → ownership).
  select r.id, r.slug into v_existing_id, v_existing_slug
    from public.karaoke_workspace_members m
    join public.karaoke_room_ownership o on o.workspace_id = m.workspace_id
    join public.karaoke_rooms r on r.id = o.room_id
   where m.account_id = p_account_id and m.status = 'active'
   order by o.claimed_at asc
   limit 1;
  if v_existing_slug is not null then
    return jsonb_build_object('outcome', 'has_room', 'slug', v_existing_slug, 'roomId', v_existing_id);
  end if;

  -- Reuse the account's active workspace, else create it (first Room only).
  select m.workspace_id into v_workspace_id
    from public.karaoke_workspace_members m
   where m.account_id = p_account_id and m.status = 'active'
   order by m.created_at asc
   limit 1;
  if v_workspace_id is null then
    insert into public.karaoke_workspaces (name, created_by)
    values (coalesce(nullif(btrim(p_workspace_name), ''), 'My Norebang'), p_account_id)
    returning id into v_workspace_id;
    insert into public.karaoke_workspace_members (workspace_id, account_id, role, status)
    values (v_workspace_id, p_account_id, 'owner', 'active');
  end if;

  insert into public.karaoke_rooms (slug, display_name, dj_secret, status)
  values (p_slug, p_display_name, p_dj_secret, 'open')
  returning id into v_room_id;

  insert into public.karaoke_room_ownership (room_id, workspace_id, claimed_by_account)
  values (v_room_id, v_workspace_id, p_account_id);

  insert into public.karaoke_room_creation_idempotency (account_id, idempotency_key, request_fingerprint, room_id)
  values (p_account_id, v_key, v_fp, v_room_id);

  return jsonb_build_object('outcome', 'created', 'slug', p_slug, 'roomId', v_room_id, 'replayed', false);
end;
$$;

-- 3. UNCAPPED 4-ARG additional (rollout-safe replace; canonical count; no idempotency) --
create or replace function public.create_additional_karaoke_room(
  p_account_id   uuid,
  p_slug         text,
  p_display_name text,
  p_dj_secret    text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_room_id      uuid;
  v_owned_count  int;
begin
  perform pg_advisory_xact_lock(hashtext('karaoke_first_room:' || p_account_id::text));

  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('outcome', 'account_not_found');
  end if;

  -- Canonical owned-Room count (active membership → ownership), NOT claimed_by_account.
  select count(distinct o.room_id) into v_owned_count
    from public.karaoke_workspace_members m
    join public.karaoke_room_ownership o on o.workspace_id = m.workspace_id
   where m.account_id = p_account_id and m.status = 'active';

  if v_owned_count = 0 then
    return jsonb_build_object('outcome', 'first_room_required', 'count', v_owned_count);
  end if;

  select m.workspace_id into v_workspace_id
    from public.karaoke_workspace_members m
   where m.account_id = p_account_id and m.status = 'active'
   order by m.created_at asc
   limit 1;
  if v_workspace_id is null then
    return jsonb_build_object('outcome', 'ownership_state_invalid', 'count', v_owned_count);
  end if;

  insert into public.karaoke_rooms (slug, display_name, dj_secret, status)
  values (p_slug, p_display_name, p_dj_secret, 'open')
  returning id into v_room_id;

  insert into public.karaoke_room_ownership (room_id, workspace_id, claimed_by_account)
  values (v_room_id, v_workspace_id, p_account_id);

  return jsonb_build_object('outcome', 'created', 'slug', p_slug, 'roomId', v_room_id, 'count', v_owned_count + 1);
end;
$$;

-- 4. ADDITIONAL keyed overload (6-arg) — uncapped + REQUIRED idempotency -------------
create or replace function public.create_additional_karaoke_room(
  p_account_id         uuid,
  p_slug               text,
  p_display_name       text,
  p_dj_secret          text,
  p_idempotency_key    text,
  p_request_fingerprint text
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_room_id      uuid;
  v_owned_count  int;
  v_key          text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_fp           text := nullif(btrim(coalesce(p_request_fingerprint, '')), '');
  v_prior        public.karaoke_room_creation_idempotency%rowtype;
  v_prior_slug   text;
begin
  perform pg_advisory_xact_lock(hashtext('karaoke_first_room:' || p_account_id::text));

  if v_key is null then return jsonb_build_object('outcome', 'invalid_idempotency_key'); end if;
  if v_fp  is null then return jsonb_build_object('outcome', 'invalid_request_fingerprint'); end if;

  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('outcome', 'account_not_found');
  end if;

  select * into v_prior
    from public.karaoke_room_creation_idempotency
   where account_id = p_account_id and idempotency_key = v_key
   limit 1;
  if found then
    if v_prior.request_fingerprint is distinct from v_fp then
      return jsonb_build_object('outcome', 'idempotency_conflict');
    end if;
    if v_prior.room_id is null then
      return jsonb_build_object('outcome', 'idempotency_target_missing');
    end if;
    select slug into v_prior_slug from public.karaoke_rooms where id = v_prior.room_id;
    if v_prior_slug is null then
      return jsonb_build_object('outcome', 'idempotency_target_missing');
    end if;
    return jsonb_build_object('outcome', 'created', 'slug', v_prior_slug, 'roomId', v_prior.room_id, 'replayed', true);
  end if;

  select count(distinct o.room_id) into v_owned_count
    from public.karaoke_workspace_members m
    join public.karaoke_room_ownership o on o.workspace_id = m.workspace_id
   where m.account_id = p_account_id and m.status = 'active';

  if v_owned_count = 0 then
    return jsonb_build_object('outcome', 'first_room_required', 'count', v_owned_count);
  end if;

  select m.workspace_id into v_workspace_id
    from public.karaoke_workspace_members m
   where m.account_id = p_account_id and m.status = 'active'
   order by m.created_at asc
   limit 1;
  if v_workspace_id is null then
    return jsonb_build_object('outcome', 'ownership_state_invalid', 'count', v_owned_count);
  end if;

  insert into public.karaoke_rooms (slug, display_name, dj_secret, status)
  values (p_slug, p_display_name, p_dj_secret, 'open')
  returning id into v_room_id;

  insert into public.karaoke_room_ownership (room_id, workspace_id, claimed_by_account)
  values (v_room_id, v_workspace_id, p_account_id);

  insert into public.karaoke_room_creation_idempotency (account_id, idempotency_key, request_fingerprint, room_id)
  values (p_account_id, v_key, v_fp, v_room_id);

  return jsonb_build_object('outcome', 'created', 'slug', p_slug, 'roomId', v_room_id, 'count', v_owned_count + 1, 'replayed', false);
end;
$$;

-- 5. GRANTS — service_role only for every signature (correct arg lists) --------------
revoke all on function public.create_karaoke_room(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_karaoke_room(uuid, text, text, text, text, text, text)
  to service_role;
revoke all on function public.create_additional_karaoke_room(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_additional_karaoke_room(uuid, text, text, text)
  to service_role;
revoke all on function public.create_additional_karaoke_room(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_additional_karaoke_room(uuid, text, text, text, text, text)
  to service_role;
