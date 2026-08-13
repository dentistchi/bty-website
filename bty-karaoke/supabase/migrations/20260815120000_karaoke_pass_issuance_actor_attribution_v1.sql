-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- BUILD 26O — pass issuance actor attribution.
--
-- THE DEFECT. `issue_timed_access_pass` recorded WHO issued a pass as the single hardcoded
-- string 'bty_mgr', supplied by a parameter that defaulted to that same constant, and wrote
-- NOTHING into `timed_access_pass_audit.metadata` — the column existed and stayed NULL on every
-- ISSUED row. Measured on production before this migration: 53 ISSUED audit rows, 0 with
-- metadata. So an issuance could be proven to have HAPPENED and never proven to have been
-- ORIGINATED by anything in particular.
--
-- BUILD 26M paid for that: 15 grants appeared 11 seconds apart, and the audit could not
-- distinguish one script from fifteen sessions, or say anything about the operator beyond the
-- shared credential every manager call already uses. That cohort is NOT repaired here — see the
-- historical policy below.
--
-- WHAT THIS CHANGES. Issuance now requires a server-constructed provenance document and persists
-- it in the SAME statement pair as the grant, inside the SAME transaction. There is no path that
-- creates a grant first and attributes it afterwards.
--
-- WHAT THIS DOES NOT CHANGE. Durations, carryover, activation, expiry, selection, revocation,
-- idempotent replay, the PRO block, the advisory lock, and the FREE meter are all untouched.
-- No commerce object is read or written. No pass row is created, deleted, or re-timestamped.
--
-- HISTORICAL POLICY — NO BACKFILL. Not one pre-existing row is updated by this file. An unknown
-- historical issuer stays unknown. Attributing the 53 existing ISSUED rows to 'bty_mgr' merely
-- because the route uses 'bty_mgr' today would manufacture evidence about the past from a fact
-- about the present, which is precisely the mistake BUILD 26M's §11 refused to make.

-- 1. Structural floor: a NEW ISSUED audit row cannot be unattributed -----------------------
--
-- NOT VALID is the whole point, and is deliberate rather than a shortcut: it enforces the rule
-- on every row written from now on while leaving the 53 historical rows unexamined and unedited.
-- Validating it would demand a backfill, and the backfill is the thing that must not happen.
--
-- This is a floor, not the mechanism. The RPC below refuses first and with a legible error; the
-- constraint is what remains true if some future code path forgets to.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'timed_pass_issue_attribution_chk') then
    alter table public.timed_access_pass_audit
      add constraint timed_pass_issue_attribution_chk
      check (
        action <> 'ISSUED'
        or (
          metadata is not null
          and metadata ? 'version'
          and metadata ? 'source'
          and metadata ? 'actor_kind'
          and metadata ? 'actor_id'
        )
      ) not valid;
  end if;
end $$;

-- 2. Retire the unattributed signature ------------------------------------------------------
--
-- The old function is DROPPED rather than left beside the new one. `create or replace` would not
-- have replaced it — the new parameter list has a different type signature, so both would exist
-- and the 5-text overload would remain a live, callable path that issues grants with no
-- provenance at all. A bypass that still works is not retired.
--
-- Safe to drop: it is revoked from public/anon/authenticated and executable only by service_role,
-- and the sole caller in the repository (src/lib/timed-pass.server.ts) is updated in the same
-- commit.
drop function if exists public.issue_timed_access_pass(uuid, text, text, text, text);

-- 3. Issuance with mandatory, server-derived provenance --------------------------------------
--
-- `p_issuance` has NO DEFAULT. A caller that omits it fails to resolve the function at all,
-- rather than quietly issuing an unattributed pass — the failure lands at the call, not in the
-- forensic record months later.
--
-- The document is built by the server from AUTHENTICATED context only (see
-- manager-auth.server.ts). Nothing here is read from a request body: this function receives no
-- client-controlled attribution field, so there is no forged value for it to prefer.
create or replace function public.issue_timed_access_pass(
  p_account_id      uuid,
  p_pass_type       text,
  p_reason          text,
  p_idempotency_key text,
  p_issuance        jsonb
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_key      text := btrim(coalesce(p_idempotency_key, ''));
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor    text;
  v_dur      int;
  v_plan     text; v_plan_n int;
  v_existing public.timed_access_pass_grants%rowtype;
  v_new_id   uuid;
begin
  if p_pass_type not in ('ONE_HOUR', 'FOUR_HOURS', 'TWENTY_FOUR_HOURS') then
    return jsonb_build_object('ok', false, 'error', 'invalid_pass_type');
  end if;
  if v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'idempotency_key_required');
  end if;

  -- Provenance is validated BEFORE the lock and before every write, so a refusal mutates
  -- nothing at all — the same discipline BUILD 26M-R3 used for the playing guard.
  v_actor := nullif(btrim(coalesce(p_issuance->>'actor_id', '')), '');
  if p_issuance is null
     or jsonb_typeof(p_issuance) <> 'object'
     or nullif(btrim(coalesce(p_issuance->>'source', '')), '') is null
     or nullif(btrim(coalesce(p_issuance->>'actor_kind', '')), '') is null
     or v_actor is null
     or p_issuance->>'version' is null
  then
    return jsonb_build_object('ok', false, 'error', 'issuance_provenance_required');
  end if;

  v_dur := case p_pass_type when 'ONE_HOUR' then 3600 when 'FOUR_HOURS' then 14400 else 86400 end;

  perform pg_advisory_xact_lock(hashtext('timed_pass:' || p_account_id::text));

  if not exists (select 1 from public.karaoke_accounts where id = p_account_id) then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  -- Replay: the same issue key returns its grant unchanged. A retry does NOT re-attribute an
  -- existing grant — the provenance of a pass is the provenance of the issuance that created it,
  -- and a second caller replaying the key did not create it.
  select * into v_existing
    from public.timed_access_pass_grants where issue_idempotency_key = v_key limit 1;
  if found then
    return jsonb_build_object('ok', true, 'passGrantId', v_existing.id,
      'passType', v_existing.pass_type, 'status', v_existing.status, 'reused', true);
  end if;

  -- A PRO base account cannot consume a pass — block issuance (never a silent no-op).
  select count(*), max(plan_code) into v_plan_n, v_plan
    from public.karaoke_host_plan_assignments where account_id = p_account_id and status = 'active';
  if v_plan_n = 1 and v_plan = 'PRO' then
    return jsonb_build_object('ok', false, 'error', 'account_is_pro');
  end if;

  -- Both rows below take their actor from the SAME v_actor, extracted from the SAME document.
  -- The grant's `issued_by_manager` and the audit's `actor_ref` therefore cannot disagree about
  -- who issued a pass, which two independently-passed parameters could.
  insert into public.timed_access_pass_grants
    (account_id, pass_type, duration_seconds, issued_by_manager, issue_reason, issue_idempotency_key)
  values (p_account_id, p_pass_type, v_dur, v_actor, v_reason, v_key)
  returning id into v_new_id;

  -- One statement writes the ISSUED event and its provenance together. There is no window in
  -- which the grant exists and the attribution does not: both inserts are in this function's
  -- single transaction, so a failure of either rolls back the other.
  insert into public.timed_access_pass_audit
    (pass_grant_id, account_id, actor_type, actor_ref, action, from_status, to_status,
     idempotency_key, reason, metadata)
  values (v_new_id, p_account_id, 'MANAGER', v_actor, 'ISSUED', null, 'AVAILABLE',
          v_key, v_reason, p_issuance);

  return jsonb_build_object('ok', true, 'passGrantId', v_new_id,
    'passType', p_pass_type, 'status', 'AVAILABLE', 'reused', false);
end;
$$;
revoke all on function public.issue_timed_access_pass(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.issue_timed_access_pass(uuid, text, text, text, jsonb) to service_role;

comment on constraint timed_pass_issue_attribution_chk on public.timed_access_pass_audit is
  'BUILD 26O: a NEW ISSUED audit row must carry server-derived issuance provenance. NOT VALID on '
  'purpose — historical rows predate the rule and are deliberately never backfilled.';
