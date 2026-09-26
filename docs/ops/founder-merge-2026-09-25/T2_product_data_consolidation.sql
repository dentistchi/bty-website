-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BTY FOUNDER MERGE — T2: PRODUCT DATA CONSOLIDATION (A → B)
-- REVIEW ONLY. Run as ONE script in the Supabase SQL editor (role: postgres).
--
-- JWT TTL is LOCKED at 3600 s — measured from production (Dashboard → Authentication → JWT
-- expiry) on 2026-09-25.
--
-- The transaction itself enforces the gate: T1 committed, A has no identity that can resolve a
-- person (the only identity allowed is GoTrue's own `email` identity for the neutralized
-- retired+81f08aa1@ address — see below), no sessions, no refresh tokens, A is banned, A's email
-- is neutralized, and now() is past T1 + JWT TTL + 5 minutes. Any mismatch RAISEs and nothing is
-- applied.
--
-- The ledger (created by T1) receives ONLY what rollback needs: primary keys, the ownership
-- column's old/new value, and — for user_day, membership and host grant — the few scalar columns
-- that change. No message bodies, previews, source metadata, training content or other business
-- text is copied; the ledger's CHECK constraints reject it.
-- Snapshot columns, arena_consent_log, clinical_reasoning_traces, A's arena_profiles and
-- user_learning_paths rows, and Teams delivery history are NOT touched.
-- ===========================================================================

begin;

set local lock_timeout = '10s';
set local statement_timeout = '300s';

do $t2$
declare
  v_a constant uuid := '81f08aa1-44a2-40b1-9190-7866151461a7';
  v_b constant uuid := '18b1ee80-2200-4bc6-91d7-039ba43f6a50';
  v_jwt_ttl_seconds constant int := 3600;

  v_t1_at      timestamptz;
  v_earliest   timestamptz;
  v_n          int;
  v_m          int;
  v_tbl        text;
  v_baseline   jsonb := '{}'::jsonb;
  v_after      jsonb := '{}'::jsonb;
  v_b_core_xp_sum_0   bigint;
  v_b_core_xp_total_0 bigint;
  v_snap_ann_0 int;
  v_snap_prog_0 int;
  r record;
begin
  -- -------------------------------------------------------------------------
  -- GATE
  -- -------------------------------------------------------------------------
  if exists (select 1 from bty_ops.founder_merge_ledger where phase = 'T2' and step not like 'rolled_back/%') then
    raise exception 'T2 ABORT: ledger already holds T2 rows — T2 has run before';
  end if;

  select new_value::timestamptz into v_t1_at
    from bty_ops.founder_merge_ledger where phase = 'T1' and step = 'committed_marker';
  if v_t1_at is null then raise exception 'T2 ABORT: T1 marker missing — T1 has not committed'; end if;

  v_earliest := v_t1_at + make_interval(secs => v_jwt_ttl_seconds) + interval '5 minutes';
  if now() < v_earliest then
    raise exception 'T2 ABORT: TTL gate not reached — earliest start is %', v_earliest;
  end if;

  -- A may hold NO identity that can sign a person in. Measured in production 2026-09-26: the
  -- Admin API email neutralization (updateUserById email + email_confirm) makes GoTrue create a
  -- provider='email' identity for the new address. That one — and only for the retired address —
  -- is tolerated; any azure/google/other identity, or an email identity for a routable address,
  -- still aborts.
  select count(*) into v_n from auth.identities where user_id = v_a and provider <> 'email';
  if v_n <> 0 then raise exception 'T2 ABORT: A has % non-email identities', v_n; end if;
  select count(*) into v_n from auth.identities
   where user_id = v_a and provider = 'email'
     and lower(coalesce(identity_data->>'email', '')) not like 'retired+81f08aa1@%';
  if v_n <> 0 then raise exception 'T2 ABORT: A has % email identities for a non-retired address', v_n; end if;
  select count(*) into v_n from auth.sessions where user_id = v_a;
  if v_n <> 0 then raise exception 'T2 ABORT: A has % sessions', v_n; end if;
  select count(*) into v_n from auth.refresh_tokens where user_id::text = v_a::text;
  if v_n <> 0 then raise exception 'T2 ABORT: A has % refresh tokens', v_n; end if;

  perform 1 from auth.users
   where id = v_a and deleted_at is null
     and banned_until is not null and banned_until > now() + interval '10 years'
     and lower(email) like 'retired+81f08aa1@%';
  if not found then raise exception 'T2 ABORT: A is not banned with a neutralized email (run the Admin API step)'; end if;

  -- B authority must be intact before anything moves.
  perform 1 from public.bty_platform_admin_grants where user_id = v_b and status = 'active';
  if not found then raise exception 'T2 ABORT: B platform admin not active'; end if;
  perform 1 from public.foundry_host_grants where user_id = v_b and status = 'active' and manual_granted;
  if not found then raise exception 'T2 ABORT: B manual Foundry Host not active'; end if;
  select count(*) into v_n
    from public.bty_org_membership_responsibilities rr
    join public.bty_org_memberships mm on mm.id = rr.membership_id
   where mm.user_id = v_b and mm.status = 'active' and rr.status = 'active'
     and rr.responsibility_key in ('PARTNER', 'CLINICAL_DIRECTOR');
  if v_n <> 2 then raise exception 'T2 ABORT: B has % of PARTNER/CLINICAL_DIRECTOR active, expected 2', v_n; end if;

  -- -------------------------------------------------------------------------
  -- BASELINE for "nothing was created or changed" (XP, contracts, Arena, evidence).
  -- Counted by any-column mention so an absent table or a differently named user column
  -- cannot hide a row. Absent tables are skipped.
  -- -------------------------------------------------------------------------
  foreach v_tbl in array array[
    'public.bty_action_contracts', 'public.core_xp_ledger', 'public.weekly_xp_ledger',
    'public.weekly_xp', 'public.weekly_xp_history', 'public.activity_xp_events',
    'public.arena_runs', 'public.arena_events', 'public.bty_arena_signals',
    'public.pattern_signals', 'public.user_behavior_memory_events', 'public.user_scenario_history'
  ] loop
    if to_regclass(v_tbl) is not null then
      execute format('select count(*) from %s t where to_jsonb(t)::text like %L or to_jsonb(t)::text like %L',
                     v_tbl, '%' || v_a || '%', '%' || v_b || '%') into v_n;
      v_baseline := v_baseline || jsonb_build_object(v_tbl, v_n);
    end if;
  end loop;

  select coalesce(sum(delta_xp), 0) into v_b_core_xp_sum_0 from public.core_xp_ledger where user_id = v_b;
  select core_xp_total into v_b_core_xp_total_0 from public.arena_profiles where user_id = v_b;
  select count(*) into v_snap_ann_0 from public.bty_tracked_announcements where owner_user_id_snapshot = v_a;
  select count(*) into v_snap_prog_0 from public.foundry_programs where owner_user_id_snapshot = v_a;

  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, new_value)
  values ('T2', 'baseline_marker', '-', 'marker', v_baseline::text);

  -- -------------------------------------------------------------------------
  -- SECTION A — AUTHORITY PRESERVE. B rows are never written.
  -- -------------------------------------------------------------------------
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, row_key, column_name, old_value, new_value, pre_image)
  select 'T2', 'authority', 'public.bty_org_memberships', 'update', jsonb_build_object('id', m.id),
         'status', m.status, 'inactive',
         jsonb_build_object('id', m.id, 'status', m.status, 'updated_at', m.updated_at)
    from public.bty_org_memberships m where m.user_id = v_a and m.status = 'active';
  update public.bty_org_memberships
     set status = 'inactive', updated_at = now()
   where user_id = v_a and status = 'active';
  get diagnostics v_n = row_count;
  if v_n > 1 then raise exception 'T2 ABORT: deactivated % A memberships, expected at most 1', v_n; end if;

  -- effective_check: (status='active') = (manual_granted OR microsoft_manager_granted)
  -- revocation_check: revoked ⇔ revoked_at IS NOT NULL. Both flags go false together.
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, row_key, column_name, old_value, new_value, pre_image)
  select 'T2', 'authority', 'public.foundry_host_grants', 'update', jsonb_build_object('user_id', g.user_id),
         'status', g.status, 'revoked',
         jsonb_build_object('user_id', g.user_id, 'status', g.status, 'revoked_at', g.revoked_at,
                            'manual_granted', g.manual_granted,
                            'microsoft_manager_granted', g.microsoft_manager_granted)
    from public.foundry_host_grants g where g.user_id = v_a and g.status = 'active';
  update public.foundry_host_grants
     set status = 'revoked', revoked_at = now(),
         manual_granted = false, microsoft_manager_granted = false
   where user_id = v_a and status = 'active';
  get diagnostics v_n = row_count;
  if v_n > 1 then raise exception 'T2 ABORT: revoked % A host grants, expected at most 1', v_n; end if;

  -- -------------------------------------------------------------------------
  -- SECTION B — USER_DAY COLLISION MERGE. UNIQUE (user_id, day_key).
  -- Rule: the surviving row keeps the EARLIEST opened_at, and takes timezone_snapshot and
  -- tz_fallback FROM THE SAME ROW that supplied it, so the three values always describe one
  -- real open. On an exact tie B is left untouched.
  -- -------------------------------------------------------------------------
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, row_key, column_name, old_value, new_value, pre_image)
  select 'T2', 'user_day_merge', 'public.user_day', 'update', jsonb_build_object('id', b.id),
         'opened_at', b.opened_at::text, a.opened_at::text,
         jsonb_build_object('id', b.id, 'opened_at', b.opened_at,
                            'timezone_snapshot', b.timezone_snapshot, 'tz_fallback', b.tz_fallback)
    from public.user_day b
    join public.user_day a on a.user_id = v_a and a.day_key = b.day_key
   where b.user_id = v_b and a.opened_at < b.opened_at;
  update public.user_day b
     set opened_at = a.opened_at,
         timezone_snapshot = a.timezone_snapshot,
         tz_fallback = a.tz_fallback
    from public.user_day a
   where b.user_id = v_b and a.user_id = v_a and a.day_key = b.day_key
     and a.opened_at < b.opened_at;

  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, row_key, pre_image)
  select 'T2', 'user_day_merge', 'public.user_day', 'delete', jsonb_build_object('id', a.id),
         jsonb_build_object('id', a.id, 'user_id', a.user_id, 'day_key', a.day_key,
                            'timezone_snapshot', a.timezone_snapshot, 'tz_fallback', a.tz_fallback,
                            'opened_at', a.opened_at)
    from public.user_day a
   where a.user_id = v_a
     and exists (select 1 from public.user_day b where b.user_id = v_b and b.day_key = a.day_key);
  get diagnostics v_m = row_count;
  delete from public.user_day a
   where a.user_id = v_a
     and exists (select 1 from public.user_day b where b.user_id = v_b and b.day_key = a.day_key);
  get diagnostics v_n = row_count;
  if v_n <> v_m then raise exception 'T2 ABORT: user_day collision delete % <> ledger %', v_n, v_m; end if;
  raise notice 'T2: user_day collisions merged: %', v_n;

  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, row_key, column_name, old_value, new_value)
  select 'T2', 'user_day_move', 'public.user_day', 'reassign', jsonb_build_object('id', a.id),
         'user_id', v_a::text, v_b::text
    from public.user_day a where a.user_id = v_a;
  get diagnostics v_m = row_count;
  update public.user_day set user_id = v_b where user_id = v_a;
  get diagnostics v_n = row_count;
  if v_n <> v_m then raise exception 'T2 ABORT: user_day move % <> ledger %', v_n, v_m; end if;
  raise notice 'T2: user_day non-colliding days moved: %', v_n;

  -- -------------------------------------------------------------------------
  -- SECTION C — DIRECT REHOME. First prove every A key is free on B.
  -- -------------------------------------------------------------------------
  select count(*) into v_n from public.bty_action_captures a
   where a.user_id = v_a and exists (select 1 from public.bty_action_captures b
     where b.user_id = v_b and b.source_type = a.source_type and b.external_key = a.external_key);
  if v_n <> 0 then raise exception 'T2 ABORT: % capture keys collide', v_n; end if;

  select count(*) into v_n from public.bty_today_dismissals a
   where a.user_id = v_a and exists (select 1 from public.bty_today_dismissals b
     where b.user_id = v_b and b.item_kind = a.item_kind and b.item_id = a.item_id);
  if v_n <> 0 then raise exception 'T2 ABORT: % today-dismissal keys collide', v_n; end if;

  if exists (select 1 from public.user_conversation_preferences where user_id = v_a)
     and exists (select 1 from public.user_conversation_preferences where user_id = v_b) then
    raise exception 'T2 ABORT: both A and B have conversation preferences';
  end if;

  select count(*) into v_n from public.bty_foundry_event_history_dismissals a
   where a.user_id = v_a and exists (select 1 from public.bty_foundry_event_history_dismissals b
     where b.user_id = v_b and b.event_id = a.event_id);
  if v_n <> 0 then raise exception 'T2 ABORT: % history-dismissal keys collide', v_n; end if;

  select count(*) into v_n from public.bty_announcement_thread_message_reads a
   where a.reader_user_id = v_a and exists (select 1 from public.bty_announcement_thread_message_reads b
     where b.reader_user_id = v_b and b.message_id = a.message_id);
  if v_n <> 0 then raise exception 'T2 ABORT: % message-read keys collide', v_n; end if;

  select count(*) into v_n from public.bty_tracked_announcements a
   where a.owner_user_id = v_a and a.source_capture_id is not null
     and exists (select 1 from public.bty_tracked_announcements b
       where b.owner_user_id = v_b and b.source_capture_id = a.source_capture_id);
  if v_n <> 0 then raise exception 'T2 ABORT: % tracked-announcement keys collide', v_n; end if;

  select count(*) into v_n from public.foundry_program_generation_attempts a
   where a.owner_user_id = v_a and exists (select 1 from public.foundry_program_generation_attempts b
     where b.owner_user_id = v_b and b.submission_intent_id = a.submission_intent_id);
  if v_n <> 0 then raise exception 'T2 ABORT: % generation-attempt keys collide', v_n; end if;

  select count(*) into v_n from public.bty_announcement_thread_messages a
   where a.author_user_id = v_a and a.client_message_id is not null
     and exists (select 1 from public.bty_announcement_thread_messages b
       where b.author_user_id = v_b and b.recipient_id = a.recipient_id
         and b.client_message_id = a.client_message_id);
  if v_n <> 0 then raise exception 'T2 ABORT: % thread-message client keys collide', v_n; end if;

  -- Verification anchor: the IDs (only) of A's captures that are currently in Saved for later.
  -- T2_verify proves each of these appears in B's Today after the move.
  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, new_value)
  select 'T2', 'today_expectation', 'public.bty_action_captures', 'marker',
         coalesce(jsonb_agg(c.id order by c.id), '[]'::jsonb)::text
    from public.bty_action_captures c
   where c.user_id = v_a and c.status = 'captured' and c.saved_at is not null and c.saved_removed_at is null;

  -- Rehome. Only the named ownership column changes. The ledger holds the primary key as it was
  -- before the change plus the old/new owner — nothing else from the row (pre_image stays NULL).
  for r in
    select * from (values
      ('public.bty_action_captures',                   'user_id',            array['id']),
      ('public.bty_today_dismissals',                  'user_id',            array['user_id','item_kind','item_id']),
      ('public.user_conversation_preferences',         'user_id',            array['user_id']),
      ('public.bty_foundry_event_history_dismissals',  'user_id',            array['user_id','event_id']),
      ('public.foundry_events',                        'owner_user_id',      array['id']),
      ('public.foundry_event_quizzes',                 'created_by_user_id', array['event_id']),
      ('public.foundry_module_drafts',                 'owner_user_id',      array['id']),
      ('public.foundry_program_generation_attempts',   'owner_user_id',      array['id']),
      ('public.foundry_programs',                      'owner_user_id',      array['id']),
      ('public.bty_tracked_announcements',             'owner_user_id',      array['id']),
      ('public.bty_tracked_announcement_recipients',   'handled_by_user_id', array['id']),
      ('public.bty_announcement_thread_messages',      'author_user_id',     array['id']),
      ('public.bty_announcement_thread_message_reads', 'reader_user_id',     array['message_id','reader_user_id']),
      ('public.foundry_host_followup_contacts',        'host_user_id',       array['id'])
    ) t(tbl, col, pk)
  loop
    execute format(
      $f$insert into bty_ops.founder_merge_ledger
           (phase, step, table_name, action, row_key, column_name, old_value, new_value)
         select 'T2', 'rehome', %L, 'reassign',
                (select jsonb_object_agg(k, to_jsonb(x) -> k) from unnest(%L::text[]) k),
                %L, %L, %L
           from %s x where x.%I = $1$f$,
      r.tbl, r.pk, r.col, v_a::text, v_b::text, r.tbl, r.col)
    using v_a;
    get diagnostics v_m = row_count;

    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using v_b, v_a;
    get diagnostics v_n = row_count;
    if v_n <> v_m then raise exception 'T2 ABORT: % rehomed % rows but ledgered %', r.tbl, v_n, v_m; end if;

    execute format('select count(*) from %s where %I = $1', r.tbl, r.col) using v_a into v_n;
    if v_n <> 0 then raise exception 'T2 ABORT: % still has % A rows in %', r.tbl, v_n, r.col; end if;
    raise notice 'T2: rehomed % %.% rows', v_m, r.tbl, r.col;
  end loop;

  -- -------------------------------------------------------------------------
  -- SECTION D — COLLISION TABLES LEFT ON A (arena_profiles, user_learning_paths): no statement.
  -- SECTION E — IMMUTABLE HISTORY: no statement touches owner_user_id_snapshot, Teams delivery
  --             snapshots, arena_consent_log or clinical_reasoning_traces.
  -- SECTION F — Self-addressed Tracks / follow-up are accepted as-is; no cleanup.
  -- -------------------------------------------------------------------------

  -- -------------------------------------------------------------------------
  -- POSTCONDITIONS (in-transaction; any failure rolls everything back)
  -- -------------------------------------------------------------------------
  select count(*) into v_n from public.user_day where user_id = v_a;
  if v_n <> 0 then raise exception 'T2 ABORT: A still has % user_day rows', v_n; end if;

  select count(*) into v_n from public.bty_tracked_announcements where owner_user_id_snapshot = v_a;
  if v_n <> v_snap_ann_0 then raise exception 'T2 ABORT: announcement snapshots changed % → %', v_snap_ann_0, v_n; end if;
  select count(*) into v_n from public.foundry_programs where owner_user_id_snapshot = v_a;
  if v_n <> v_snap_prog_0 then raise exception 'T2 ABORT: program snapshots changed % → %', v_snap_prog_0, v_n; end if;

  foreach v_tbl in array (select coalesce(array_agg(k), '{}') from jsonb_object_keys(v_baseline) k) loop
    execute format('select count(*) from %s t where to_jsonb(t)::text like %L or to_jsonb(t)::text like %L',
                   v_tbl, '%' || v_a || '%', '%' || v_b || '%') into v_n;
    v_after := v_after || jsonb_build_object(v_tbl, v_n);
  end loop;
  if v_after <> v_baseline then
    raise exception 'T2 ABORT: XP/contract/Arena/evidence rows changed: before % after %', v_baseline, v_after;
  end if;

  select coalesce(sum(delta_xp), 0) into v_n from public.core_xp_ledger where user_id = v_b;
  if v_n <> v_b_core_xp_sum_0 then raise exception 'T2 ABORT: B core XP ledger sum changed'; end if;
  select core_xp_total into v_n from public.arena_profiles where user_id = v_b;
  if v_n is distinct from v_b_core_xp_total_0 then raise exception 'T2 ABORT: B core_xp_total changed'; end if;

  perform 1 from public.bty_platform_admin_grants where user_id = v_b and status = 'active';
  if not found then raise exception 'T2 ABORT: B platform admin lost'; end if;
  perform 1 from public.foundry_host_grants where user_id = v_b and status = 'active' and manual_granted;
  if not found then raise exception 'T2 ABORT: B manual host lost'; end if;
  select count(*) into v_n
    from public.bty_org_membership_responsibilities rr
    join public.bty_org_memberships mm on mm.id = rr.membership_id
   where mm.user_id = v_b and mm.status = 'active' and rr.status = 'active'
     and rr.responsibility_key in ('PARTNER', 'CLINICAL_DIRECTOR');
  if v_n <> 2 then raise exception 'T2 ABORT: B responsibilities changed'; end if;

  insert into bty_ops.founder_merge_ledger (phase, step, table_name, action, new_value)
  values ('T2', 'committed_marker', '-', 'marker', now()::text);

  raise notice 'T2 OK — product data consolidated onto B';
end
$t2$;

commit;
