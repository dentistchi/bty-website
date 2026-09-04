-- ===========================================================================
-- BIND ON CANONICAL ENTRY — the rule was only on ONE road in. Stage 2.
--
-- ADDITIVE. ONE new function. No table, no column, no constraint, no grant and
-- no policy is altered or dropped, and NOTHING is backfilled. The existing
-- three-argument `bty_bind_announcement_recipients` is untouched and keeps its
-- caller.
--
-- ORDERING: 20260911, after 20260910.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS — MEASURED, NOT INFERRED.
--
-- `bty_bind_announcement_recipients(user_id, tid, oid)` attaches the recipient
-- rows frozen for a Microsoft identity to the canonical BTY account that just
-- proved it owns that identity. It has exactly ONE production caller: the Teams
-- personal-tab bootstrap. That is one road in, and there are two.
--
-- The other road is the ordinary Microsoft sign-in on the web -- which is where
-- the Teams notification's "Open BTY" link actually sends people, and which is
-- how every non-Teams-tab user activates. Nothing on that road binds anything.
--
-- The cost is not theoretical. Measured in production on 2026-09-03: recipient
-- 7e979fc3 was notified in Teams at 19:57 and is STILL unbound, because its
-- owner has not since opened the tab. `listMyAnnouncements` scopes on `user_id`,
-- so an unbound row is invisible to the very person it was created for. Someone
-- is waiting on an answer that the person was never shown.
--
-- ★ THE FIX IS TO PUT THE EXISTING RULE ON THE OTHER ROAD, NOT TO WRITE A
--   SECOND ONE. This function derives the identity tuple and then DELEGATES to
--   `bty_bind_announcement_recipients`. There is still exactly one UPDATE
--   statement in this schema that can bind a recipient, so "never re-point an
--   already-bound row" cannot drift apart between two copies.
--
-- ---------------------------------------------------------------------------
-- WHY THE ARGUMENT IS A USER ID AND THE TUPLE IS DERIVED.
--
-- On the Teams tab the tuple arrives already verified inside the Entra token, so
-- the caller can pass it. On the web there is no such token by the time a
-- Supabase session exists -- only a user id. The tuple must therefore be read
-- from `auth.identities`, which is NOT reachable through PostgREST and must not
-- be pulled into application memory. Hence SECURITY DEFINER here, exactly as in
-- `bty_resolve_user_from_microsoft_identity`.
--
-- ★ THE CLAIM PATH IS `identity_data->'custom_claims'->>'tid' / '->>'oid'`, and
--   nothing else. The top-level `identity_data->>'oid'` and `provider_id`/`sub`
--   paths were MEASURED wrong for this tenant and fail SILENTLY -- they return
--   zero rows rather than an error, which reads exactly like "this person has no
--   announcements".
--
-- EMAIL IS NEVER IDENTITY. No email parameter, no email column, no email
-- comparison. `provider` is pinned to 'azure'.
--
-- ★ IT NEVER CREATES ANYTHING and returns no identity material -- only a count.
--   No user, no identity, no recipient row, no announcement. A recipient row is
--   not permission to make an account, and a count is not a disclosure.
--
-- FAILS CLOSED ON AMBIGUITY, for the same reason the resolver does:
-- `auth.identities` is unique on (provider_id, provider) -- that is `sub`, which
-- is per-application -- so two rows could in principle share an `oid`. BTY uses
-- one Entra app, so this should be unreachable; if it ever happens we bind
-- NOTHING rather than attach one person's rows on a guess.
--
-- ROLLBACK:
--   drop function if exists public.bty_bind_announcement_recipients_for_user(uuid);
-- ===========================================================================

create or replace function public.bty_bind_announcement_recipients_for_user(
  p_user_id uuid
)
returns table (bound integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_tids text[];
  v_oids text[];
begin
  if p_user_id is null then
    return query select 0; return;
  end if;

  /*
    Both halves, from the same identity row, aggregated so that "more than one"
    is a value we can SEE. A bare SELECT INTO would silently take an arbitrary
    row when two matched, which is the exact guess this refuses to make.

    Rows whose claims are absent are excluded rather than collected as NULL: a
    non-Microsoft identity on the same account is not an ambiguity, it is simply
    not a Microsoft identity.
  */
  select array_agg(lower(btrim(i.identity_data->'custom_claims'->>'tid'))),
         array_agg(lower(btrim(i.identity_data->'custom_claims'->>'oid')))
    into v_tids, v_oids
  from auth.identities i
  where i.user_id = p_user_id
    and i.provider = 'azure'
    and i.identity_data->'custom_claims'->>'tid' is not null
    and i.identity_data->'custom_claims'->>'oid' is not null;

  -- No Microsoft identity on this account. Ordinary, and not an error: a
  -- password-only BTY user has no recipient rows to bind.
  if v_tids is null or array_length(v_tids, 1) is null then
    return query select 0; return;
  end if;

  -- FAIL CLOSED. See the note above.
  if array_length(v_tids, 1) > 1 then
    return query select 0; return;
  end if;

  /*
    DELEGATE. The GUID shape gate, the `user_id is null` guard and the
    never-re-point rule all live in the function being called, and are not
    repeated here -- there is one definition of what binding means.
  */
  return query
    select b.bound
      from public.bty_bind_announcement_recipients(p_user_id, v_tids[1], v_oids[1]) b;
end;
$$;

revoke all on function public.bty_bind_announcement_recipients_for_user(uuid) from public;
revoke all on function public.bty_bind_announcement_recipients_for_user(uuid) from anon;
revoke all on function public.bty_bind_announcement_recipients_for_user(uuid) from authenticated;
grant execute on function public.bty_bind_announcement_recipients_for_user(uuid) to service_role;

comment on function public.bty_bind_announcement_recipients_for_user(uuid) is
  'Bind announcement recipient rows to a canonical BTY user whose Microsoft identity is already established, deriving (tid, oid) from auth.identities via SECURITY DEFINER because no verified Entra token exists on the web sign-in road. Reads identity_data->custom_claims->>tid/oid ONLY; the top-level oid/tid and provider_id/sub paths are measurably wrong and fail silently. Returns ONLY a count -- never identity_data, email, sub or provider_id. Creates nothing. Fails closed when an account carries more than one azure identity. Delegates the UPDATE to bty_bind_announcement_recipients so this schema has exactly one definition of binding.';
