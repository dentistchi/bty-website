#!/usr/bin/env bash
# Gate 2/9 — REAL PostgreSQL proof that EXACT ACL (aclexplode of the object ACL) is the correct
# migration-authority evidence and that effective has_*_privilege() is INSUFFICIENT (PUBLIC / role
# inheritance / owner implicit rights can make it lie). Requires PG* env → a disposable database.
set -u
PSQL="${PSQL:-psql}"
fails=0
check() { # desc  expected  actual
  if [ "$2" = "$3" ]; then echo "  PASS: $1"; else echo "  FAIL: $1 (expected [$2] got [$3])"; fails=$((fails+1)); fi
}

$PSQL -q -v ON_ERROR_STOP=1 <<'SQL'
drop schema if exists m cascade; create schema m;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='svc') then create role svc; end if;
  if not exists (select 1 from pg_roles where rolname='parent_r') then create role parent_r; end if;
end $$;
create function m.f() returns int language sql as 'select 1';
SQL

# Explicit ACL of m.f() restricted to controlled role 'svc' + PUBLIC.
acl() { $PSQL -tAq -c "select coalesce(string_agg(case when a.grantee=0 then 'PUBLIC' else gr.rolname end||':'||a.privilege_type||':'||a.is_grantable, ',' order by 1),'')
  from aclexplode(coalesce((select proacl from pg_proc where oid='m.f()'::regprocedure), acldefault('f',(select proowner from pg_proc where oid='m.f()'::regprocedure)))) a
  left join pg_roles gr on gr.oid=a.grantee where a.grantee=0 or gr.rolname='svc';"; }
eff() { $PSQL -tAq -c "select has_function_privilege('$1','m.f()','EXECUTE');"; }

# Case 1 — default: PUBLIC has EXECUTE; svc has EFFECTIVE execute via PUBLIC but NO explicit svc tuple.
check "case1 effective svc EXECUTE is TRUE via PUBLIC (misleading)" "t" "$(eff svc)"
check "case1 exact ACL shows PUBLIC only, no explicit svc grant" "PUBLIC:EXECUTE:false" "$(acl)"

# Case 2 — svc inherits from parent_r which has EXECUTE; still no explicit svc tuple.
$PSQL -q -c "revoke all on function m.f() from public; grant execute on function m.f() to parent_r; grant parent_r to svc;" >/dev/null 2>&1
check "case2 effective svc EXECUTE TRUE via inheritance" "t" "$(eff svc)"
check "case2 exact ACL has parent_r not svc (svc excluded from controlled set here)" "" "$(acl)"

# Case 3 — owner implicit only (revoke everyone): effective for owner true, but no explicit controlled tuple.
$PSQL -q -c "revoke all on function m.f() from parent_r, public;" >/dev/null 2>&1
check "case3 exact ACL empty for controlled roles (owner implicit is NOT an ACL grant)" "" "$(acl)"

# Case 4 — the migration's exact intent: revoke public + grant svc → exactly one explicit tuple.
$PSQL -q -c "revoke all on function m.f() from public; grant execute on function m.f() to svc;" >/dev/null 2>&1
check "case4 exact ACL = svc EXECUTE non-grantable" "svc:EXECUTE:false" "$(acl)"
check "case4 PUBLIC has no execute" "f" "$(eff public)"

# Case 5 — wrong grantable state is visible in exact ACL.
$PSQL -q -c "grant execute on function m.f() to svc with grant option;" >/dev/null 2>&1
check "case5 grantable difference visible in exact ACL" "svc:EXECUTE:true" "$(acl)"

$PSQL -q -c "drop schema m cascade;" >/dev/null 2>&1
echo "----"
if [ "$fails" -eq 0 ]; then echo "ACL_MATRIX: PASS"; else echo "ACL_MATRIX: FAIL ($fails)"; exit 1; fi
