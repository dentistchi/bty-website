-- Track collaboration authority alignment V1.
--
-- Track is a collaboration action. Its sender (actor) and its recipients now share ONE
-- participant rule, bty_track_participant_user_v1, and neither needs a bty_org_memberships row.
--
-- WHY. Measured in production 2026-09-27: a correctly resolved, same-tenant, unbanned BTY user
-- (Michael Song) was rejected as a recipient only because he had no bty_org_memberships row. That
-- table holds two rows in production (one active: the Founder), so the previous rules made Track
-- Founder-only in both directions: nobody else could be selected, and nobody else could send.
--
-- PARTICIPANT = tenant+OID resolves, via the EXISTING bty_resolve_user_from_microsoft_identity,
-- to exactly one account (RESOLVED) in the tenant of the verified Teams activity -- the route has
-- already required that tenant to be BTY's -- and that auth.users row exists, is not soft-deleted
-- and is not currently banned. No email, UPN, display name or from.id, ever.
--
-- SCOPE. Track participant validity only. No global auth policy changes, and every other feature
-- that reads bty_org_memberships (leadership authority, review queues, observation opportunities,
-- authoring, XP/admin organization actions) is untouched.
--
-- bty_track_announcement_v1 is re-declared byte-identical to 20260927051100 except for its actor
-- and recipient authority gates. Signature, return shape, SECURITY DEFINER, search_path, grants,
-- self exclusion (a separate recipient rule), service_url, idempotency and the single transaction
-- are unchanged. No DDL on any table, no data change.
begin;
do $$
begin
  if to_regprocedure('public.bty_track_announcement_v1(uuid,text,jsonb,text,text[],text,text)') is null then
    raise exception 'bty_track_announcement_v1 with the canonical signature is missing; apply 20260927051100 first';
  end if;
end $$;

-- The ONE Track participant predicate. Returns the canonical user id, or NULL when the identity
-- is not a valid Track participant. Internal: callable only by its owner (the Track RPC).
create or replace function public.bty_track_participant_user_v1(p_tenant_id text, p_aad_object_id text)
returns uuid language plpgsql stable security definer set search_path=pg_catalog, public as $$
declare v_resolution record;
begin
 select * into v_resolution from public.bty_resolve_user_from_microsoft_identity(p_tenant_id,p_aad_object_id);
 if v_resolution.status is distinct from 'RESOLVED' or v_resolution.user_id is null then return null; end if;
 perform 1 from auth.users u
   where u.id=v_resolution.user_id and u.deleted_at is null
     and (u.banned_until is null or u.banned_until<=now());
 if not found then return null; end if;
 return v_resolution.user_id;
end $$;
revoke all on function public.bty_track_participant_user_v1(text,text) from public,anon,authenticated,service_role;

create or replace function public.bty_track_announcement_v1(
 p_owner_user_id uuid, p_actor_oid text, p_source jsonb, p_host_framing text,
 p_recipient_oids text[], p_tracking_mode text, p_service_url text
) returns table(announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql security definer set search_path=pg_catalog, public as $$
declare
 v_tenant text := lower(btrim(p_source->>'tenant_id'));
 v_conversation text := btrim(p_source->>'conversation_id');
 v_message text := btrim(p_source->>'message_id');
 v_guid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
 v_org uuid; v_oid text; v_user uuid; v_ids uuid[] := '{}'; v_oids text[] := '{}';
 v_capture uuid; v_key text; v_run record; v_resolution record;
begin
 -- Service-only does not authorize an audience. Resolve both actor and every target
 -- via the existing tenant+OID authority. No metadata/email/name authorization.
 v_user := public.bty_track_participant_user_v1(v_tenant,p_actor_oid);
 if v_user is null or v_user is distinct from p_owner_user_id then
   raise exception 'invalid_actor' using errcode='42501';
 end if;
 if p_tracking_mode is null or p_tracking_mode not in ('acknowledgment','response') then
   raise exception 'invalid_tracking_mode' using errcode='22023';
 end if;
 if char_length(btrim(coalesce(p_host_framing,''))) not between 1 and 1000 then
   raise exception 'invalid_framing' using errcode='22023';
 end if;
 if p_source->>'provider' is distinct from 'teams' or coalesce(v_tenant,'') !~ v_guid
   or coalesce(v_conversation,'')='' or coalesce(v_message,'')='' then
   raise exception 'missing_source_identity' using errcode='22023';
 end if;
 if exists(select 1 from unnest(p_recipient_oids) o where o is null or lower(btrim(o)) !~ v_guid) then
   raise exception 'invalid_recipients' using errcode='42501';
 end if;
 for v_oid in select distinct lower(btrim(o)) from unnest(p_recipient_oids) o order by 1 loop
   v_user := public.bty_track_participant_user_v1(v_tenant,v_oid);
   if v_user is null then raise exception 'invalid_recipients' using errcode='42501'; end if;
   if v_user=p_owner_user_id then continue; end if;
   if not (v_user=any(v_ids)) then
     v_ids:=array_append(v_ids,v_user); v_oids:=array_append(v_oids,v_oid);
   end if;
 end loop;
 if cardinality(v_ids)=0 then raise exception 'zero_recipients' using errcode='22023'; end if;

 -- ALL validation precedes ALL writes. Capture, run and audience share this transaction.
 -- Match resolveTeamsCaptureSource exactly; identity lookup normalizes tenant case,
 -- but the existing Save external key preserves the source spelling.
 v_key:='teams:'||btrim(p_source->>'tenant_id')||':'||v_conversation||':'||v_message;
 perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text||':'||v_key,0));
 select c.id into v_capture from public.bty_action_captures c
 where c.user_id=p_owner_user_id and c.source_type='teams_message' and c.external_key=v_key;
 if v_capture is null then
   insert into public.bty_action_captures(user_id,source_type,external_key,preview_text,source_url,source_metadata,status,saved_at)
   values(p_owner_user_id,'teams_message',v_key,left(p_source->>'preview_text',280),
     case when p_source->>'source_url' ~* '^(https:|msteams:)' then p_source->>'source_url' else null end,
     p_source-'preview_text'-'source_url','captured',null)
   on conflict(user_id,source_type,external_key) do nothing returning id into v_capture;
   if v_capture is null then
     select c.id into v_capture from public.bty_action_captures c
     where c.user_id=p_owner_user_id and c.source_type='teams_message' and c.external_key=v_key;
   end if;
 end if;
 select * into v_run from public.bty_track_announcement(p_owner_user_id,v_capture,p_host_framing,v_tenant,v_conversation,p_service_url,v_oids);
 if not v_run.already_existed then
   update public.bty_tracked_announcements set tracking_mode=p_tracking_mode where id=v_run.announcement_id;
   update public.bty_tracked_announcement_recipients r set user_id=v_ids[array_position(v_oids,r.aad_object_id)],bound_at=clock_timestamp()
   where r.announcement_id=v_run.announcement_id;
 end if;
 return query select v_run.announcement_id::uuid,v_run.resolved_count::integer,v_run.already_existed::boolean;
end $$;
revoke all on function public.bty_track_announcement_v1(uuid,text,jsonb,text,text[],text,text) from public,anon,authenticated;
grant execute on function public.bty_track_announcement_v1(uuid,text,jsonb,text,text[],text,text) to service_role;
commit;
