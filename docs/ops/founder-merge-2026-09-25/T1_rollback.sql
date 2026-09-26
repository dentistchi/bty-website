-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- BTY FOUNDER MERGE — T1 ROLLBACK (identities back to A)
-- REVIEW ONLY. Only valid while NO live T2 exists (run T2_rollback.sql first if T2 ran).
--
-- ORDER: first undo the Admin API step on A (unban + restore email ddshanbit@gmail.com), THEN
-- run this. Deleted sessions/refresh tokens/flow state are NOT restorable and need not be:
-- A simply signs in again. A's Microsoft authority snapshot is derived and is rebuilt by the next
-- sign-in / manager sync; it is not re-inserted here (re-inserting could collide with a snapshot
-- B wrote for oid 644ff2ac in the meantime, on UNIQUE (tenant_id, aad_object_id)).
-- ===========================================================================

begin;

set local lock_timeout = '10s';

do $rb1$
declare
  v_a constant uuid := '81f08aa1-44a2-40b1-9190-7866151461a7';
  v_b constant uuid := '18b1ee80-2200-4bc6-91d7-039ba43f6a50';
  v_n int;
  v_status text;
  v_user uuid;
begin
  if exists (select 1 from bty_ops.founder_merge_ledger where phase = 'T2' and step not like 'rolled_back/%') then
    raise exception 'RB1 ABORT: a live T2 exists — run T2_rollback.sql first';
  end if;
  perform 1 from bty_ops.founder_merge_ledger where phase = 'T1' and step = 'committed_marker';
  if not found then raise exception 'RB1 ABORT: no live T1 to roll back'; end if;

  perform 1 from auth.users where id = v_a and deleted_at is null
     and (banned_until is null or banned_until <= now()) and lower(email) = 'ddshanbit@gmail.com';
  if not found then raise exception 'RB1 ABORT: undo the Admin API step first (unban A, restore its email)'; end if;

  perform 1 from auth.identities where id in (select (row_key ->> 'id')::uuid from bty_ops.founder_merge_ledger
                                               where phase = 'T1' and step = 'identity_move') for update;

  update auth.identities i
     set user_id = v_a
    from bty_ops.founder_merge_ledger l
   where l.phase = 'T1' and l.step = 'identity_move'
     and i.id = (l.row_key ->> 'id')::uuid
     and i.user_id = v_b
     and l.old_value = v_a::text;
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'RB1 ABORT: restored % identities, expected 2', v_n; end if;

  select r.status, r.user_id into v_status, v_user
    from public.bty_resolve_user_from_microsoft_identity('10110d5c-bd30-467e-9912-e44e67777647',
                                                         '644ff2ac-9135-4bcc-9669-c382986e4b60') r;
  if v_status <> 'RESOLVED' or v_user <> v_a then raise exception 'RB1 ABORT: oid A resolves to % / %', v_status, v_user; end if;
  select r.status, r.user_id into v_status, v_user
    from public.bty_resolve_user_from_microsoft_identity('10110d5c-bd30-467e-9912-e44e67777647',
                                                         'f5767307-f693-4f8c-8e6c-5fb8a256b895') r;
  if v_status <> 'RESOLVED' or v_user <> v_b then raise exception 'RB1 ABORT: oid B resolves to % / %', v_status, v_user; end if;

  update bty_ops.founder_merge_ledger set step = 'rolled_back/' || step
   where phase = 'T1' and step not like 'rolled_back/%';

  raise notice 'RB1 OK — identities back on A';
end
$rb1$;

commit;
