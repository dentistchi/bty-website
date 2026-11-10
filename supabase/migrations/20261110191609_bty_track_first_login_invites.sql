-- First-login Track invitations. The Teams server supplies the exact OIDs it
-- verified against its own Microsoft tenant. The database repeats the canonical
-- BTY identity check and accepts an unbound recipient only on NOT_LINKED.
-- Apply before the Worker that uses v2. Existing v1 callers and data are preserved.
begin;

do $$
begin
  if to_regprocedure('public.bty_track_announcement_v1(uuid,text,jsonb,text,text[],text,text)') is null
     or to_regprocedure('public.bty_track_participant_user_v1(text,text)') is null then
    raise exception 'Apply the Track collaboration authority migration before Track invitations';
  end if;
end;
$$;

create or replace function public.bty_track_announcement_v2(
  p_owner_user_id uuid,
  p_actor_oid text,
  p_source jsonb,
  p_host_framing text,
  p_recipient_oids text[],
  p_tracking_mode text,
  p_service_url text,
  p_preverified_unlinked_oids text[]
)
returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_tenant text := lower(btrim(p_source->>'tenant_id'));
  v_conversation text := btrim(p_source->>'conversation_id');
  v_message text := btrim(p_source->>'message_id');
  v_guid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_oid text;
  v_user uuid;
  v_selected_oids text[];
  v_preverified_oids text[];
  v_oids text[] := '{}';
  v_ids uuid[] := '{}';
  v_capture uuid;
  v_key text;
  v_run record;
  v_resolution record;
begin
  v_user := public.bty_track_participant_user_v1(v_tenant, p_actor_oid);
  if v_user is null or v_user is distinct from p_owner_user_id then
    raise exception 'invalid_actor' using errcode = '42501';
  end if;
  if p_tracking_mode is null or p_tracking_mode not in ('acknowledgment', 'response') then
    raise exception 'invalid_tracking_mode' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_host_framing, ''))) not between 1 and 1000 then
    raise exception 'invalid_framing' using errcode = '22023';
  end if;
  if p_source->>'provider' is distinct from 'teams' or coalesce(v_tenant, '') !~ v_guid
     or coalesce(v_conversation, '') = '' or coalesce(v_message, '') = '' then
    raise exception 'missing_source_identity' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_recipient_oids) o where o is null or lower(btrim(o)) !~ v_guid)
     or exists (select 1 from unnest(p_preverified_unlinked_oids) o where o is null or lower(btrim(o)) !~ v_guid) then
    raise exception 'invalid_recipients' using errcode = '42501';
  end if;

  v_selected_oids := array(select distinct lower(btrim(o)) from unnest(p_recipient_oids) o order by 1);
  v_preverified_oids := array(select distinct lower(btrim(o)) from unnest(p_preverified_unlinked_oids) o);
  if not (v_preverified_oids <@ v_selected_oids) then
    raise exception 'invalid_recipients' using errcode = '42501';
  end if;

  foreach v_oid in array v_selected_oids loop
    select * into v_resolution from public.bty_resolve_user_from_microsoft_identity(v_tenant, v_oid);
    if v_resolution.status = 'RESOLVED' then
      v_user := public.bty_track_participant_user_v1(v_tenant, v_oid);
      if v_user is null then raise exception 'invalid_recipients' using errcode = '42501'; end if;
      if v_user = p_owner_user_id or array_position(v_ids, v_user) is not null then continue; end if;
    elsif v_resolution.status = 'NOT_LINKED' and v_oid = any(v_preverified_oids) then
      v_user := null;
    else
      raise exception 'invalid_recipients' using errcode = '42501';
    end if;
    v_ids := array_append(v_ids, v_user);
    v_oids := array_append(v_oids, v_oid);
  end loop;
  if cardinality(v_ids) = 0 then raise exception 'zero_recipients' using errcode = '22023'; end if;

  -- Same key and lock as v1, shared with retries and overlapping old Workers.
  -- Every authority and proof check above happens before any write.
  v_key := 'teams:' || btrim(p_source->>'tenant_id') || ':' || v_conversation || ':' || v_message;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text || ':' || v_key, 0));
  select c.id into v_capture from public.bty_action_captures c
  where c.user_id = p_owner_user_id and c.source_type = 'teams_message' and c.external_key = v_key;
  if v_capture is null then
    insert into public.bty_action_captures (user_id, source_type, external_key, preview_text, source_url, source_metadata, status, saved_at)
    values (p_owner_user_id, 'teams_message', v_key, left(p_source->>'preview_text', 280),
      case when p_source->>'source_url' ~* '^(https:|msteams:)' then p_source->>'source_url' else null end,
      p_source - 'preview_text' - 'source_url', 'captured', null)
    on conflict (user_id, source_type, external_key) do nothing returning id into v_capture;
    if v_capture is null then
      select c.id into v_capture from public.bty_action_captures c
      where c.user_id = p_owner_user_id and c.source_type = 'teams_message' and c.external_key = v_key;
    end if;
  end if;

  select * into v_run from public.bty_track_announcement(
    p_owner_user_id, v_capture, p_host_framing, v_tenant, v_conversation, p_service_url, v_oids
  );
  if not v_run.already_existed then
    update public.bty_tracked_announcements a set tracking_mode = p_tracking_mode
    where a.id = v_run.announcement_id;
    update public.bty_tracked_announcement_recipients r
    set user_id = v_ids[array_position(v_oids, r.aad_object_id)], bound_at = clock_timestamp()
    where r.announcement_id = v_run.announcement_id
      and v_ids[array_position(v_oids, r.aad_object_id)] is not null;
  end if;
  return query select v_run.announcement_id::uuid, v_run.resolved_count::integer, v_run.already_existed::boolean;
end;
$$;

revoke all on function public.bty_track_announcement_v2(uuid, text, jsonb, text, text[], text, text, text[])
  from public, anon, authenticated;
grant execute on function public.bty_track_announcement_v2(uuid, text, jsonb, text, text[], text, text, text[])
  to service_role;

comment on function public.bty_track_announcement_v2(uuid, text, jsonb, text, text[], text, text, text[]) is
  'Service-only Track creation with positively verified same-tenant Microsoft recipients who have yet to sign in to BTY. The server passes only the OIDs it just verified. This writer freezes those recipients unbound for canonical first-sign-in binding.';

commit;
