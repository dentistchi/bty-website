begin;

-- Serialize admission with the event's open -> closed update. Existing PENDING
-- rows may already have reached Teams, so the migration leaves every row intact.
create or replace function public.claim_foundry_teams_training_delivery(
  p_event_id uuid,
  p_owner_user_id uuid,
  p_tenant_id uuid,
  p_aad_object_id uuid,
  p_display_name text,
  p_service_url text,
  p_conversation_id text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_status text;
  v_delivery_id uuid;
  v_delivery_status text;
begin
  select status into v_event_status
  from public.foundry_events
  where id = p_event_id and owner_user_id = p_owner_user_id
  for share;

  if not found then return jsonb_build_object('state', 'not_owner'); end if;
  if v_event_status <> 'open' then return jsonb_build_object('state', 'event_closed'); end if;

  insert into public.foundry_teams_training_deliveries as delivery (
    event_id, owner_user_id_snapshot, tenant_id, aad_object_id, display_name_snapshot,
    service_url, conversation_id, delivery_status
  ) values (
    p_event_id, p_owner_user_id, p_tenant_id::text, p_aad_object_id::text, p_display_name,
    p_service_url, p_conversation_id, 'PENDING'
  )
  on conflict (event_id, tenant_id, aad_object_id) do update
    set display_name_snapshot = excluded.display_name_snapshot,
        service_url = excluded.service_url,
        conversation_id = excluded.conversation_id,
        delivery_status = 'PENDING',
        updated_at = now()
    where delivery.delivery_status = 'UNDELIVERABLE'
  returning id into v_delivery_id;

  if found then
    return jsonb_build_object('state', 'claimed', 'deliveryId', v_delivery_id);
  end if;

  select delivery_status into v_delivery_status
  from public.foundry_teams_training_deliveries
  where event_id = p_event_id and tenant_id = p_tenant_id::text and aad_object_id = p_aad_object_id::text;

  if v_delivery_status = 'DELIVERED' then
    return jsonb_build_object('state', 'already_sent');
  end if;
  return jsonb_build_object('state', 'pending');
end;
$$;

-- A learner already admitted may resume after closure, just as in the web
-- room. A first-time Teams learner must be admitted before the close commits.
create or replace function public.join_foundry_teams_training(
  p_event_id uuid,
  p_tenant_id uuid,
  p_aad_object_id uuid,
  p_user_id uuid,
  p_display_name text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_status text;
  v_participant public.foundry_event_participants%rowtype;
begin
  select status into v_event_status
  from public.foundry_events
  where id = p_event_id
  for share;

  if not found then return jsonb_build_object('state', 'event_closed'); end if;

  if v_event_status = 'open' then
    insert into public.foundry_event_participants (
      event_id, display_name, participant_session_token_hash, user_id,
      microsoft_tenant_id, microsoft_aad_object_id
    ) values (
      p_event_id, p_display_name, 'teams:' || p_event_id || ':' || p_tenant_id || ':' || p_aad_object_id,
      p_user_id, p_tenant_id::text, p_aad_object_id::text
    )
    on conflict do nothing
    returning * into v_participant;
  end if;

  if v_participant.id is null then
    select * into v_participant
    from public.foundry_event_participants
    where event_id = p_event_id and microsoft_tenant_id = p_tenant_id::text
      and microsoft_aad_object_id = p_aad_object_id::text;
  end if;

  if v_participant.id is null then
    return jsonb_build_object(
      'state', case when v_event_status = 'open' then 'unavailable' else 'event_closed' end
    );
  end if;
  if v_participant.status <> 'joined' then return jsonb_build_object('state', 'removed'); end if;

  return jsonb_build_object('state', 'joined', 'participant', jsonb_build_object(
    'id', v_participant.id, 'event_id', v_participant.event_id,
    'display_name', v_participant.display_name, 'user_id', v_participant.user_id
  ));
end;
$$;

revoke all on function public.claim_foundry_teams_training_delivery(uuid, uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_foundry_teams_training_delivery(uuid, uuid, uuid, uuid, text, text, text)
  to service_role;

revoke all on function public.join_foundry_teams_training(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.join_foundry_teams_training(uuid, uuid, uuid, uuid, text)
  to service_role;

commit;
