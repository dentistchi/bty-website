-- BUILD 25 — GUEST-VISIBLE REQUEST RESOLUTION V1
--
-- THE DEFECT. A Guest-owned request can be removed, skipped, or closed by the Host or the Event
-- lifecycle and simply vanish from the Guest's screen. Forensics (BUILD 25 §5) showed the
-- disappearance has TWO independent halves:
--
--   1. SERVER: `karaoke_requests.status` cannot carry WHY. Three different writers produce
--      'removed' (Guest cancel, Host remove, Event end) and three produce 'skipped' (Host skip of
--      a waiting row, Host stop of a playing row, Event end of a playing row). The status alone
--      cannot distinguish "you cancelled this" from "the Host removed it" — and those must never
--      be confused.
--   2. CLIENT: both Guest clients then DELIBERATELY drop the terminal row
--      (`domain/guest-requests.ts` "belongs to NEITHER — it drops out"; native `myRequestStatus`
--      default branch). That half is fixed in the client, not here.
--
-- This migration fixes half 1 ONLY, additively.
--
-- WHY A COLUMN AND NOT INFERENCE. Verified against the live schema: `karaoke_requests` has no
-- `removed_at`, no `ended_at`, and no reason field; `completed_at` is written only on completion.
-- Inference was considered and rejected: once an Event is ended, a Host removal that happened
-- EARLIER is indistinguishable from an Event-end closure, so inference would actively assert a
-- false reason. The product contract forbids exactly that ("never claim the Guest cancelled when
-- the Host acted"), so the reason must be recorded by the writer that knows it.
--
-- WHY ON THE REQUEST ROW AND NOT AN EVENT LOG. Every terminal transition already takes the row
-- lock (or a guarded single-statement UPDATE) inside the transaction that performs it, and each
-- request has exactly one terminal disposition. A side table would add a second write to every
-- terminal path with no fact the row cannot hold.
--
-- FORWARD-ONLY AND ADDITIVE. No historical backfill, no guessed UPDATE, no destructive operation,
-- and NOTHING in the accounting graph is touched: no entitlement, lease, grace, duration, pass,
-- usage-segment, or window object is read or written by this migration. Existing rows keep
-- (null, null), which is a legal state and projects to the safe `unknown_resolution` copy for the
-- verified owner only.

begin;

-- ── A. THE ADDITIVE PAIR ───────────────────────────────────────────────────────────────────────
--
-- Nullable on purpose. 362 production rows exist today (11 waiting / 1 playing / 233 completed /
-- 7 skipped / 110 removed, verified read-only before authoring); every one of them takes
-- (null, null). Nothing is backfilled, because no truthful reason for them exists anywhere.

alter table public.karaoke_requests
  add column if not exists resolution_code text,
  add column if not exists resolved_at     timestamptz;

comment on column public.karaoke_requests.resolution_code is
  'BUILD 25: why this request left the queue without completing normally. One of '
  '(guest_cancelled, host_removed, host_skipped, event_ended), written ONLY by the server '
  'mutation that actually resolved the row. Null = legacy/unknown, projected to the verified '
  'OWNER as unknown_resolution. Never a localized sentence; never client-supplied.';
comment on column public.karaoke_requests.resolved_at is
  'BUILD 25: when the resolution above was recorded. Always null iff resolution_code is null.';

-- ── B. CONSTRAINT ──────────────────────────────────────────────────────────────────────────────
--
-- One constraint carries all five required invariants, because they are one predicate:
--
--   (1) resolution_code is null or one of exactly four codes  -> the IN list
--   (2) both null or both non-null                            -> the two disjuncts
--   (3) a resolution only on a NON-NORMAL terminal status     -> status in ('removed','skipped')
--   (4) normal completion never carries an abnormal reason    -> 'completed' is not in that list
--   (5) an ACTIVE request holds no resolution                 -> 'waiting'/'playing' not in it
--
-- `unknown_resolution` is deliberately NOT accepted: it is a projection fallback for a null
-- reason, never a stored value. Writing it would destroy the distinction between "no reason was
-- ever recorded" and "the reason is genuinely unknown".
--
-- SAFE AGAINST EVERY EXISTING ROW: all 362 satisfy the first disjunct (both null) regardless of
-- their status, so this validates immediately and rejects nothing that legitimately exists. The
-- deployed status domain was re-verified before authoring — no value outside the documented five
-- exists in production.
--
-- THE `resolution_code is not null` GUARD IS LORE-BEARING, NOT REDUNDANT. A CHECK constraint only
-- rejects a row when its expression evaluates to FALSE — an expression that evaluates to NULL
-- PASSES. Written the obvious way, `(resolution_code, resolved_at) = (null, <ts>)` yields
-- `FALSE or (NULL in (...) and ...)` = `FALSE or NULL` = NULL, so a resolved_at with NO reason
-- would have been silently ACCEPTED, breaking invariant (2) in exactly the direction that
-- produces a timestamped resolution the client cannot explain. The local Postgres suite caught
-- this before it was applied anywhere. Leading each disjunct with an explicit IS [NOT] NULL test
-- forces a FALSE. Do not "simplify" these away.

alter table public.karaoke_requests
  drop constraint if exists karaoke_requests_resolution_valid;

alter table public.karaoke_requests
  add constraint karaoke_requests_resolution_valid check (
    (resolution_code is null and resolved_at is null)
    or (
      resolution_code is not null
      and resolved_at is not null
      and resolution_code in ('guest_cancelled', 'host_removed', 'host_skipped', 'event_ended')
      and status in ('removed', 'skipped')
    )
  );

-- Owner-only retrieval reads "this Event's resolved rows, newest first". Partial: only resolved
-- rows are indexed, so the 233 completed and 12 active rows cost nothing.
create index if not exists karaoke_requests_resolved_idx
  on public.karaoke_requests (event_id, resolved_at desc)
  where resolution_code is not null;

-- ── C. END SONG v2 — republished to record host_skipped ────────────────────────────────────────
--
-- Byte-for-byte the 20260803120000 body EXCEPT the resolution write. Every metering guarantee is
-- preserved verbatim and deliberately: the same lock order (account then room), the same
-- `for update` re-read, the same status guard, the same `row_count` check, the same segment
-- close_reason mapping, and — the BUILD 20M non-shrink invariant — lease_ends_at is STILL never
-- modified. This function must not change what it charges; it only records why a row ended.
--
-- 'complete' writes NO resolution: natural completion is not an abnormal disposition, and giving
-- it one would be the exact false claim the product contract forbids.
--
-- 'pass' and 'replace' are accepted actions with NO production caller (verified: only 'complete'
-- and 'skip' are reachable from the server). They therefore write NO resolution rather than an
-- invented one — a future caller would surface as `unknown_resolution` to its owner, which is
-- honest, instead of being mislabelled as a Host skip. Do not add a code here without a writer.

create or replace function public.karaoke_end_song_v2(p_room_id uuid, p_request_id uuid, p_action text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare v_account uuid; v_now timestamptz; v_new_status text; v_reason text; v_status text; v_seg_open boolean; v_upd int;
  v_resolution text;
begin
  if p_action not in ('complete','skip','pass','replace') then return jsonb_build_object('outcome','invalid_action'); end if;
  v_account := public.karaoke_room_owner_account(p_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account));
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));
  v_now := clock_timestamp();
  select status into v_status from public.karaoke_requests where id=p_request_id and room_id=p_room_id for update;
  if v_status is null then return jsonb_build_object('outcome','not_found'); end if;
  select exists(select 1 from public.karaoke_event_usage_segments where request_id=p_request_id and ended_at is null) into v_seg_open;
  v_new_status := case p_action when 'complete' then 'completed' else 'skipped' end;
  v_reason     := case p_action when 'complete' then 'completed' when 'skip' then 'skipped'
                                when 'pass' then 'passed' else 'replaced' end;
  -- BUILD 25: ONLY an explicit Host skip of a playing song is a host_skipped disposition.
  v_resolution := case when p_action = 'skip' then 'host_skipped' else null end;
  if v_status='playing' then
    update public.karaoke_requests
       set status=v_new_status, completed_at = case when v_new_status='completed' then v_now else completed_at end,
           -- Same statement as the status flip: status and reason can never diverge, and the
           -- `status='playing'` guard means a row already resolved by another writer matches
           -- zero rows here, so an earlier truthful reason cannot be overwritten.
           resolution_code = case when v_resolution is not null then v_resolution else resolution_code end,
           resolved_at     = case when v_resolution is not null then v_now         else resolved_at     end
     where id=p_request_id and room_id=p_room_id and status='playing';
    get diagnostics v_upd = row_count;
    if v_upd <> 1 then return jsonb_build_object('outcome','request_state_changed'); end if;
    if v_seg_open then
      -- Close for provenance; lease_ends_at is NEVER modified → Finish cannot shrink the lease.
      update public.karaoke_event_usage_segments set ended_at=v_now, close_reason=v_reason
        where request_id=p_request_id and ended_at is null;
    end if;
    return jsonb_build_object('outcome','ok','segmentClosed',v_seg_open,
      'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
  elsif v_status in ('completed','skipped') then
    -- Replay of a terminal mutation. It closes an orphaned segment for provenance and does NOT
    -- touch resolution_code — the first truthful disposition stands.
    if v_seg_open then
      update public.karaoke_event_usage_segments set ended_at=v_now, close_reason='recovery'
        where request_id=p_request_id and ended_at is null;
    end if;
    return jsonb_build_object('outcome','recovered',
      'entitlement', public.karaoke_free_minutes_entitlement_at_v2(v_account, v_now));
  end if;
  return jsonb_build_object('outcome','request_state_changed');
end; $$;
revoke all on function public.karaoke_end_song_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.karaoke_end_song_v2(uuid, uuid, text) to service_role;

-- ── D. END EVENT — republished to record event_ended ───────────────────────────────────────────
--
-- Byte-for-byte the 20260726120000 body EXCEPT the two resolution writes. Preserved verbatim:
-- the room+account advisory lock order, the `for update` event read, the already-ended recovery
-- branch (including the FIX 4 ended_at cap and the anomaly flag), segment closure with
-- close_reason='event_ended', session closure, and the completed-history count — Event end has
-- never rewritten completed rows and still does not.
--
-- Both closures carry event_ended: from the Guest's side "the room closed" is the same fact
-- whether their song was waiting or on stage. The STATUS still distinguishes them
-- (removed vs skipped), so no information is lost.
--
-- `and resolution_code is null` on both UPDATEs is defence in depth. The status guards already
-- make an overwrite impossible (a resolved row is no longer 'waiting'/'playing'); this makes the
-- no-overwrite rule explicit at the one site that closes many rows at once, so a future edit to
-- the status predicate cannot silently start rewriting a Guest's own cancellation as event_ended.

create or replace function public.end_karaoke_event(p_event_id uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare v_room_id uuid; v_status text; v_ended_at timestamptz; v_now timestamptz; v_account uuid;
  v_closed int:=0; v_n int:=0; v_completed int:=0; v_rec int:=0; v_anom boolean:=false;
begin
  select room_id into v_room_id from public.karaoke_events where id=p_event_id;
  if v_room_id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext(v_room_id::text));
  v_account := public.karaoke_room_owner_account(v_room_id);
  if v_account is null then return jsonb_build_object('outcome','ownership_state_invalid'); end if;
  perform pg_advisory_xact_lock(hashtext('acct:' || v_account::text));
  v_now := clock_timestamp();
  select status, ended_at into v_status, v_ended_at from public.karaoke_events where id=p_event_id for update;
  if v_status in ('ended','archived') then
    if v_ended_at is null then v_anom := true; end if;   -- abnormal ended-without-ts
    -- FIX 4: cap recovery close at the event's real ended_at (not v_now), clamped >= started_at
    with rc as (
      update public.karaoke_event_usage_segments s
         set ended_at = greatest(s.started_at, least(v_now, coalesce(v_ended_at, v_now))),
             close_reason = 'recovery'
       where s.event_id = p_event_id and s.ended_at is null returning 1)
    select count(*) into v_rec from rc;
    select count(*) into v_completed from public.karaoke_requests where event_id=p_event_id and status='completed';
    return jsonb_build_object('eventId',p_event_id,'status',v_status,'endedAt',v_ended_at,
      'completedCount',coalesce(v_completed,0),'unfinishedClosedCount',0,'recoveryClosedCount',v_rec,'anomaly',v_anom);
  end if;
  -- Active→ended: closing NOW is correct (event ends now).
  update public.karaoke_event_usage_segments set ended_at=v_now, close_reason='event_ended'
    where event_id=p_event_id and ended_at is null;
  update public.karaoke_sessions set status='ended', ended_at=v_now where room_id=v_room_id and status='active';
  with w  as (update public.karaoke_requests set status='removed', ready_at=null, youtube_queued_at=null,
                     resolution_code='event_ended', resolved_at=v_now
              where event_id=p_event_id and status='waiting' and resolution_code is null returning 1)
              select count(*) into v_n from w;  v_closed:=v_closed+coalesce(v_n,0);
  with pl as (update public.karaoke_requests set status='skipped', ready_at=null, youtube_queued_at=null,
                     resolution_code='event_ended', resolved_at=v_now
              where event_id=p_event_id and status='playing' and resolution_code is null returning 1)
              select count(*) into v_n from pl; v_closed:=v_closed+coalesce(v_n,0);
  update public.karaoke_events set status='ended', ended_at=v_now
    where id=p_event_id and status in ('draft','active') returning status, ended_at into v_status, v_ended_at;
  select count(*) into v_completed from public.karaoke_requests where event_id=p_event_id and status='completed';
  return jsonb_build_object('eventId',p_event_id,'status',v_status,'endedAt',v_ended_at,
    'completedCount',coalesce(v_completed,0),'unfinishedClosedCount',v_closed);
end; $$;
revoke all on function public.end_karaoke_event(uuid) from public, anon, authenticated;
grant execute on function public.end_karaoke_event(uuid) to service_role;

commit;
