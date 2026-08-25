-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4E-R3-R1 · RECOVERY PROVENANCE.
-- ADDITIVE. One column and one parameter. No lifecycle semantics change.
--
-- WHY. A refund Apple pushed to us and a refund we later fetched from Apple are the SAME
-- authoritative event, and both must apply through the same handler -- but they are not the same
-- OPERATIONAL fact, and an operator investigating a missed notification needs to know which
-- happened. Provenance is therefore its own column.
--
-- WHAT IT IS DELIBERATELY NOT. It is NOT encoded into `notification_uuid`, by prefix or by any
-- other synthetic scheme. That column means exactly one thing: the real Apple notificationUUID
-- taken from a verified Apple V2 signedPayload. Overloading it would break the UNIQUE index that
-- makes delivery order irrelevant -- the same event arriving live and by recovery would look like
-- two events, which is precisely the bug this build exists to prevent.
-- ============================================================================

alter table public.karaoke_apple_server_notifications
  add column if not exists discovery_source text;

-- Every row that exists today arrived by live push, because recovery did not exist until now.
update public.karaoke_apple_server_notifications
   set discovery_source = 'SERVER_NOTIFICATION'
 where discovery_source is null;

alter table public.karaoke_apple_server_notifications
  alter column discovery_source set default 'SERVER_NOTIFICATION';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'karaoke_apple_notification_source_chk') then
    alter table public.karaoke_apple_server_notifications
      add constraint karaoke_apple_notification_source_chk
      check (discovery_source in ('SERVER_NOTIFICATION', 'API_RECOVERY'));
  end if;
end $$;

alter table public.karaoke_apple_server_notifications
  alter column discovery_source set not null;

-- ── the recorder learns one optional argument ──
--
-- DEFAULTED, so every existing call site keeps its exact meaning without being touched.
--
-- ON CONFLICT DO NOTHING is unchanged and load-bearing: a duplicate does not overwrite
-- `discovery_source`. The column therefore records the FIRST successful discovery path, which is
-- the operationally true answer -- if a live push landed it first, recovery finding it again does
-- not make it a recovered event.
create or replace function public.karaoke_record_apple_notification(
  p_notification_uuid text,
  p_notification_type text,
  p_subtype           text,
  p_environment       text,
  p_transaction_id    text,
  p_original_transaction_id text,
  p_signed_date       timestamptz,
  p_payload_sha256    text,
  p_discovery_source  text default 'SERVER_NOTIFICATION'
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_src text := coalesce(nullif(btrim(coalesce(p_discovery_source, '')), ''), 'SERVER_NOTIFICATION');
begin
  if nullif(btrim(coalesce(p_notification_uuid, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'notification_uuid_required');
  end if;
  if nullif(btrim(coalesce(p_payload_sha256, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'payload_digest_required');
  end if;
  if v_src not in ('SERVER_NOTIFICATION', 'API_RECOVERY') then
    return jsonb_build_object('ok', false, 'error', 'invalid_discovery_source');
  end if;

  insert into public.karaoke_apple_server_notifications
    (notification_uuid, notification_type, subtype, environment, apple_transaction_id,
     apple_original_transaction_id, signed_date, signed_payload_sha256, discovery_source)
  values (p_notification_uuid, p_notification_type, p_subtype, p_environment, p_transaction_id,
          p_original_transaction_id, p_signed_date, p_payload_sha256, v_src)
  on conflict (notification_uuid) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  return jsonb_build_object('ok', true, 'duplicate', false, 'notificationId', v_id,
                            'discoverySource', v_src);
end; $$;
revoke all on function public.karaoke_record_apple_notification(text,text,text,text,text,text,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.karaoke_record_apple_notification(text,text,text,text,text,text,timestamptz,text,text)
  to service_role;

-- The 8-argument signature is dropped so exactly one recorder exists. Its only caller is the
-- notification service, updated in the same commit.
drop function if exists public.karaoke_record_apple_notification(text,text,text,text,text,text,timestamptz,text);
