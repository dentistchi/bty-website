-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- SLICE R1C-B-2R — MICROSOFT IDENTITY RESOLVER V1.
-- ADDITIVE ONLY. No existing table, column, constraint, function or grant is
-- altered. `auth.identities` is READ, never written, and never exposed.
-- ===========================================================================
--
-- WHY THIS SHAPE, MEASURED RATHER THAN ASSUMED (R1C-B-1a, 2026-08-29).
-- A real Microsoft account was linked to a real Supabase user on a disposable
-- local stack (GoTrue v2.186.0) and the resulting identity row was read back:
--
--   PROVIDER_ID_EQUALS_SUB = true
--   PROVIDER_ID_EQUALS_OID = false        <- the trap
--   SUB_EQUALS_OID         = false
--
-- and the claims were found NESTED, not at the top level:
--
--   identity_data->'custom_claims'->>'oid'      (Entra object id)
--   identity_data->'custom_claims'->>'tid'      (Entra tenant id)
--
-- All three "obvious" lookups return ZERO rows against a genuinely linked
-- account -- `identity_data->>'oid'`, `provider_id = oid`, `sub = oid` -- and
-- they fail SILENTLY: the caller reads "not linked" forever and no error is
-- ever raised. That is why the paths below are pinned in SQL rather than left
-- to application code to remember.
--
-- Microsoft's reference explains it: `sub` is "a pairwise identifier and is
-- unique to an application ID", so the Supabase Azure app and a Teams Bot app
-- receive DIFFERENT `sub` values for the same person. `oid` is the claim that
-- "uniquely identifies the user across applications". Teams supplies `oid` and
-- `tid` on every authenticated invoke, in every scope.
--
-- WHY A SECURITY DEFINER FUNCTION. Measured: PostgREST does not expose the
-- `auth` schema (`/rest/v1/identities` -> 404), so no client and no service
-- route can query it directly. The alternative already used in this codebase --
-- `auth.admin.listUsers({perPage:1000})` -- would pull EVERY user's
-- `identity_data` into application memory to find one row. This function reads
-- exactly what it needs and returns ONLY a status and a user id: no claims, no
-- email, no `sub`, no `provider_id` ever crosses the boundary.
--
-- EMAIL IS NEVER IDENTITY. There is no email parameter, no email column and no
-- email comparison anywhere in this file, by construction.
--
-- NO LINK CEREMONY. BTY is Microsoft-first: a BTY account IS a Microsoft account, so there is
-- nothing to merge and no challenge to authorise. An identity that does not resolve has simply
-- not signed in yet. This migration creates ONE function and NO tables.
--
-- ROLLBACK:
--   drop function if exists public.bty_resolve_user_from_microsoft_identity(text, text);
-- ===========================================================================

create or replace function public.bty_resolve_user_from_microsoft_identity(
  p_tenant_id text,
  p_aad_object_id text
)
returns table (status text, user_id uuid)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
#variable_conflict use_column
declare
  v_tid text := lower(btrim(coalesce(p_tenant_id, '')));
  v_oid text := lower(btrim(coalesce(p_aad_object_id, '')));
  v_guid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_rows uuid[];
begin
  -- Shape gate first: a non-GUID can never be an Entra identifier, and refusing
  -- it here keeps a malformed value from reaching a scan at all.
  if v_tid !~ v_guid then
    return query select 'INVALID_INPUT'::text, null::uuid; return;
  end if;
  if v_oid !~ v_guid then
    return query select 'INVALID_INPUT'::text, null::uuid; return;
  end if;

  -- The ONLY lookup. Nested claim paths, both halves required, provider pinned.
  select array_agg(i.user_id)
    into v_rows
  from auth.identities i
  where i.provider = 'azure'
    and lower(i.identity_data->'custom_claims'->>'tid') = v_tid
    and lower(i.identity_data->'custom_claims'->>'oid') = v_oid;

  if v_rows is null or array_length(v_rows, 1) is null then
    return query select 'NOT_LINKED'::text, null::uuid; return;
  end if;

  -- FAIL CLOSED. `auth.identities` is unique on (provider_id, provider) -- that
  -- is `sub`, which is per-application -- so two rows could in principle share
  -- an `oid`. BTY uses one Entra app, so this should be unreachable; if it ever
  -- happens we refuse rather than choose an owner.
  if array_length(v_rows, 1) > 1 then
    return query select 'AMBIGUOUS_IDENTITY'::text, null::uuid; return;
  end if;

  return query select 'RESOLVED'::text, v_rows[1];
end;
$$;

revoke all on function public.bty_resolve_user_from_microsoft_identity(text, text) from public;
revoke all on function public.bty_resolve_user_from_microsoft_identity(text, text) from anon;
revoke all on function public.bty_resolve_user_from_microsoft_identity(text, text) from authenticated;
grant execute on function public.bty_resolve_user_from_microsoft_identity(text, text) to service_role;

comment on function public.bty_resolve_user_from_microsoft_identity(text, text) is
  'Trusted Microsoft (tenant_id, aadObjectId) -> exactly one BTY auth.users.id. Reads auth.identities via SECURITY DEFINER and returns ONLY a status and a user id -- never identity_data, email, sub or provider_id. Matches on identity_data->custom_claims->>tid/oid ONLY; the top-level oid/tid paths and provider_id/sub are measurably wrong and would fail silently. Email is never identity. Fails closed on more than one match.';
