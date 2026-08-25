-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ============================================================================
-- BUILD 26U-R4G-R1 · STATUS-AWARE NOTIFICATION RETRY.
-- Sorts after 20260829120000_karaoke_refund_credit_v1.sql.
-- FUNCTION REDEFINITION ONLY. No table, no column, no status, no index, no constraint.
--
-- THE DEFECT THIS CLOSES, measured by R4G-R0 against production migrations:
--
--   verified Apple REFUND -> inbox row INSERTed (RECEIVED) -> lifecycle apply fails
--   -> row FAILED -> HTTP 503 -> Apple retries the SAME notificationUUID
--   -> the recorder answered "duplicate" from ROW EXISTENCE ALONE
--   -> the handler returned success -> HTTP 200 -> Apple stopped retrying
--   -> the refund was NEVER applied, and the customer kept paid Room Time.
--
-- The operator recovery path inherited it exactly, because it replays through the same handler:
-- a FAILED row came back as "duplicate (already recorded)", so the tool built to repair the gap
-- reported that nothing was wrong.
--
-- THE INBOX ANSWERS TWO DIFFERENT QUESTIONS, and only one of them was being asked:
--
--   "have we SEEN this notification?"     -> notification_uuid UNIQUE
--   "have we HANDLED this notification?"  -> processing_status
--
-- The unique index is untouched and still guarantees exactly ONE evidence row per Apple
-- notification. What changes is that the recorder now REPORTS the second answer, so the caller
-- can tell a finished event from an unfinished one instead of inferring it from a row's mere
-- existence.
--
-- WHY THIS IS SAFE TO RE-RUN AGAINST A LIVE WORKER. The previous Worker read `duplicate`, which
-- this definition no longer returns. Absent reads as false, so an old Worker would REPROCESS
-- rather than skip — and reprocessing is exactly what the canonical RPCs are already idempotent
-- against. The compatibility failure direction is the safe one, deliberately.
-- ============================================================================

-- ── A. THE RECORDER NOW REPORTS PROCESSING TRUTH ──
--
-- Same 9-argument input, so no caller signature changes and no second definition can appear.
-- The return value gains the facts the caller needs to make a correct decision.
create or replace function public.karaoke_record_apple_notification(
  p_notification_uuid text,
  p_notification_type text,
  p_subtype text,
  p_environment text,
  p_transaction_id text,
  p_original_transaction_id text,
  p_signed_date timestamptz,
  p_payload_sha256 text,
  p_discovery_source text default 'SERVER_NOTIFICATION'
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id       uuid;
  v_status   text;
  v_row_src  text;
  v_inserted boolean := false;
  v_src      text := coalesce(nullif(btrim(coalesce(p_discovery_source, '')), ''), 'SERVER_NOTIFICATION');
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

  -- ON CONFLICT DO NOTHING, exactly as before. This is also what preserves R4E-R3's
  -- discovery_source rule: the column records how BTY FIRST recorded the event, so a live
  -- delivery that later arrives through recovery (or the reverse) never rewrites it.
  insert into public.karaoke_apple_server_notifications
    (notification_uuid, notification_type, subtype, environment, apple_transaction_id,
     apple_original_transaction_id, signed_date, signed_payload_sha256, discovery_source)
  values (p_notification_uuid, p_notification_type, p_subtype, p_environment, p_transaction_id,
          p_original_transaction_id, p_signed_date, p_payload_sha256, v_src)
  on conflict (notification_uuid) do nothing
  returning id into v_id;

  if v_id is not null then
    v_inserted := true;
    v_status   := 'RECEIVED';
    v_row_src  := v_src;
  else
    select id, processing_status, discovery_source
      into v_id, v_status, v_row_src
      from public.karaoke_apple_server_notifications
     where notification_uuid = p_notification_uuid;
    -- The insert conflicted, so a row exists. If it cannot be read, something is wrong that this
    -- function must not paper over: refuse, so the caller returns a retryable failure rather than
    -- proceeding without durable evidence.
    if v_id is null then
      return jsonb_build_object('ok', false, 'error', 'record_unreadable');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'notificationId', v_id,
    'inserted', v_inserted,
    'processingStatus', v_status,
    'discoverySource', v_row_src,
    -- ONLY a successfully terminal state means there is nothing left to do. Every other state --
    -- RECEIVED (the process died, or the status write failed), FAILED (the apply failed), and
    -- any state a future migration might add -- is UNFINISHED and must be picked back up. The
    -- test is deliberately written as "not done" rather than "in this list of retryable values",
    -- so an unrecognised state fails toward reprocessing, never toward silent acknowledgement.
    'shouldProcess', v_status not in ('APPLIED', 'IGNORED'),
    'alreadyHandled', v_status in ('APPLIED', 'IGNORED'));
end;
$$;

revoke all on function public.karaoke_record_apple_notification(
  text, text, text, text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.karaoke_record_apple_notification(
  text, text, text, text, text, text, timestamptz, text, text) to service_role;

-- ── B. WHAT THIS FILE DELIBERATELY DOES NOT DO ──
--
-- No new processing status. R4G-R0 asked whether one was needed and the concurrency proof says
-- no: `apply_apple_purchase_refund` and `apply_apple_refund_reversal` are already idempotent, and
-- `timed_pass_reversal_once_idx` is already the declarative authority on one compensation per
-- purchase. Two concurrent deliveries may both enter processing; only one mutation results. A
-- PROCESSING state would add a lock nothing needs and a stuck-state class nothing repairs.
--
-- No change to notification_uuid UNIQUE. One Apple notification still has exactly one evidence
-- row; no synthetic uuid, no prefix, no suffix.
--
-- No change to apply_apple_purchase_refund, apply_apple_refund_reversal, the refund or reversal
-- semantics, the partial credit, entitlement, or any R4B/R4C/R4D/R4E/R4F object.
