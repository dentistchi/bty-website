#!/usr/bin/env bash
# Part 5 — REAL concurrency invariant test on disposable PostgreSQL, using many independent
# connections. The one-shell UNIQUE index (not a service fake) must serialize concurrent inserts of
# the same (owner_user_id, source_event_id) new-authority relationship to exactly one row.
set -u
PSQL="${PSQL:-psql}"
MIG="supabase/migrations/20260803000000_foundry_arena_draft_one_shell_v1.sql"
NA='{"practiceSetupVersion":1}'   # new-authority discriminator
fails=0

$PSQL -q -v ON_ERROR_STOP=1 <<SQL
drop table if exists public.foundry_arena_scenario_drafts cascade;
create table public.foundry_arena_scenario_drafts (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null, source_event_id uuid not null,
  guided_answers jsonb not null default '{}'::jsonb, scenario_draft jsonb, status text not null default 'draft',
  revision int not null default 0, updated_at timestamptz not null default now());
SQL
$PSQL -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null

# Fire N concurrent inserts of the SAME relationship. Each connection waits on a shared advisory
# lock so they release together (maximal contention), then attempts the insert.
race() {
  local n="$1" owner="$2" event="$3"; local wins=0 conflicts=0 tmp; tmp=$(mktemp -d)
  for i in $(seq 1 "$n"); do
    ( $PSQL -tAq -c "select pg_advisory_lock(42); select pg_advisory_unlock(42);
        insert into public.foundry_arena_scenario_drafts(owner_user_id, source_event_id, guided_answers)
        values ('$owner','$event','$NA'::jsonb);" >/dev/null 2>"$tmp/$i.err"; echo $? >"$tmp/$i.rc" ) &
  done
  wait
  for i in $(seq 1 "$n"); do
    if [ "$(cat "$tmp/$i.rc")" = "0" ]; then wins=$((wins+1));
    elif grep -q "23505\|duplicate key" "$tmp/$i.err"; then conflicts=$((conflicts+1)); fi
  done
  local rows; rows=$($PSQL -tAq -c "select count(*) from public.foundry_arena_scenario_drafts where owner_user_id='$owner' and source_event_id='$event' and guided_answers ? 'practiceSetupVersion';")
  echo "  N=$n winners=$wins conflicts=$conflicts rows=$rows"
  [ "$rows" = "1" ] && [ "$wins" = "1" ] && [ "$conflicts" = "$((n-1))" ] || { echo "  FAIL: expected rows=1 winners=1 conflicts=$((n-1))"; fails=$((fails+1)); }
  rm -rf "$tmp"
}

echo "2-connection race:";  race 2  "11111111-1111-1111-1111-111111111111" "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
echo "10-connection race:"; race 10 "22222222-2222-2222-2222-222222222222" "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

# Separation + legacy + in-place revision.
$PSQL -tAq <<SQL > /tmp/.sep_out 2>&1
-- different owner, same event → allowed
insert into public.foundry_arena_scenario_drafts(owner_user_id, source_event_id, guided_answers)
  values ('33333333-3333-3333-3333-333333333333','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','$NA'::jsonb);
-- same owner, different event → allowed
insert into public.foundry_arena_scenario_drafts(owner_user_id, source_event_id, guided_answers)
  values ('11111111-1111-1111-1111-111111111111','cccccccc-cccc-cccc-cccc-cccccccccccc','$NA'::jsonb);
-- TWO legacy rows (no practiceSetupVersion) for one relationship → deliberately UNCONSTRAINED
insert into public.foundry_arena_scenario_drafts(owner_user_id, source_event_id, guided_answers)
  values ('44444444-4444-4444-4444-444444444444','dddddddd-dddd-dddd-dddd-dddddddddddd','{}'::jsonb);
insert into public.foundry_arena_scenario_drafts(owner_user_id, source_event_id, guided_answers)
  values ('44444444-4444-4444-4444-444444444444','dddddddd-dddd-dddd-dddd-dddddddddddd','{}'::jsonb);
-- in-place revision UPDATE of an existing new-authority row → succeeds (no new row)
update public.foundry_arena_scenario_drafts set revision=revision+1, scenario_draft='{"x":1}'::jsonb
  where owner_user_id='11111111-1111-1111-1111-111111111111' and source_event_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select 'SEP_OK';
SQL
if grep -q "SEP_OK" /tmp/.sep_out; then
  legacy=$($PSQL -tAq -c "select count(*) from public.foundry_arena_scenario_drafts where owner_user_id='44444444-4444-4444-4444-444444444444';")
  [ "$legacy" = "2" ] && echo "  separation + legacy(2 rows) + in-place revision: PASS" || { echo "  legacy expected 2 got $legacy: FAIL"; fails=$((fails+1)); }
else echo "  separation block FAILED:"; cat /tmp/.sep_out; fails=$((fails+1)); fi

echo "----"
if [ "$fails" -eq 0 ]; then echo "PART5_CONCURRENCY: PASS"; else echo "PART5_CONCURRENCY: FAIL ($fails)"; exit 1; fi
