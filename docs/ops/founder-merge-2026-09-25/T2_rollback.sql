-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BTY FOUNDER MERGE — T2 ROLLBACK (restores every product row T2 touched, from the ledger)
-- REVIEW ONLY. Atomic: every restore is asserted row by row; any miss aborts everything.
--
-- Reverse order of T2: rehomes → user_day moves → user_day deletes → user_day updates →
-- authority. Rows created on B AFTER T2 are never touched (only ledgered keys are addressed).
-- A later edit to a rehomed row by the Founder (e.g. clearing a saved item) survives: only the
-- ownership column is flipped back.
-- ===========================================================================

begin;

set local lock_timeout = '10s';
set local statement_timeout = '300s';

do $rb2$
declare
  v_a constant uuid := '81f08aa1-44a2-40b1-9190-7866151461a7';
  v_b constant uuid := '18b1ee80-2200-4bc6-91d7-039ba43f6a50';
  l record;
  v_where text;
  v_n int;
begin
  perform 1 from bty_ops.founder_merge_ledger where phase = 'T2' and step = 'committed_marker';
  if not found then raise exception 'RB2 ABORT: no live T2 to roll back'; end if;

  -- 1. Direct rehomes: flip the ownership column back to A, addressing each row by its
  --    original primary key (with the ownership column as it is now, i.e. B).
  for l in
    select * from bty_ops.founder_merge_ledger
     where phase = 'T2' and step = 'rehome' order by id desc
  loop
    select string_agg(format('%I::text = %L', kk,
             case when kk = l.column_name then l.new_value else l.row_key ->> kk end), ' and ')
      into v_where
      from jsonb_object_keys(l.row_key) kk;
    execute format('update %s set %I = %L::uuid where %s and %I::text = %L',
                   l.table_name, l.column_name, l.old_value, v_where, l.column_name, l.new_value);
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'RB2 ABORT: % ledger % restored % rows', l.table_name, l.id, v_n; end if;
  end loop;

  -- 2. user_day rows that were moved.
  for l in select * from bty_ops.founder_merge_ledger where phase = 'T2' and step = 'user_day_move' loop
    update public.user_day set user_id = v_a
     where id = (l.row_key ->> 'id')::uuid and user_id = v_b;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'RB2 ABORT: user_day move % not restored', l.row_key; end if;
  end loop;

  -- 3. user_day A rows that were deleted as collisions: re-insert the exact pre-image.
  for l in select * from bty_ops.founder_merge_ledger
            where phase = 'T2' and step = 'user_day_merge' and action = 'delete' loop
    insert into public.user_day (id, user_id, day_key, timezone_snapshot, tz_fallback, opened_at)
    values ((l.pre_image ->> 'id')::uuid, (l.pre_image ->> 'user_id')::uuid, l.pre_image ->> 'day_key',
            l.pre_image ->> 'timezone_snapshot', (l.pre_image ->> 'tz_fallback')::boolean,
            (l.pre_image ->> 'opened_at')::timestamptz);
  end loop;

  -- 4. user_day B rows whose opened_at was lowered: restore the three values together.
  for l in select * from bty_ops.founder_merge_ledger
            where phase = 'T2' and step = 'user_day_merge' and action = 'update' loop
    update public.user_day
       set opened_at         = (l.pre_image ->> 'opened_at')::timestamptz,
           timezone_snapshot = l.pre_image ->> 'timezone_snapshot',
           tz_fallback       = (l.pre_image ->> 'tz_fallback')::boolean
     where id = (l.row_key ->> 'id')::uuid and user_id = v_b;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'RB2 ABORT: user_day update % not restored', l.row_key; end if;
  end loop;

  -- 5. Authority on A.
  for l in select * from bty_ops.founder_merge_ledger
            where phase = 'T2' and step = 'authority' and table_name = 'public.foundry_host_grants' loop
    update public.foundry_host_grants
       set status                    = l.pre_image ->> 'status',
           revoked_at                = (l.pre_image ->> 'revoked_at')::timestamptz,
           manual_granted            = (l.pre_image ->> 'manual_granted')::boolean,
           microsoft_manager_granted = (l.pre_image ->> 'microsoft_manager_granted')::boolean
     where user_id = v_a;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'RB2 ABORT: A host grant not restored'; end if;
  end loop;

  for l in select * from bty_ops.founder_merge_ledger
            where phase = 'T2' and step = 'authority' and table_name = 'public.bty_org_memberships' loop
    update public.bty_org_memberships
       set status = l.pre_image ->> 'status', updated_at = (l.pre_image ->> 'updated_at')::timestamptz
     where id = (l.row_key ->> 'id')::uuid and user_id = v_a;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'RB2 ABORT: A membership not restored'; end if;
  end loop;

  -- 6. Retire the T2 ledger rows (kept for audit, ignored by every guard).
  update bty_ops.founder_merge_ledger set step = 'rolled_back/' || step
   where phase = 'T2' and step not like 'rolled_back/%';

  raise notice 'RB2 OK — T2 fully reversed';
end
$rb2$;

commit;
