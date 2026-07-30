#!/usr/bin/env bash
# Regenerate docs/audit/foundry_migration_expected_catalog.json by REPLAYING the historical
# migrations 20260726–20260729 (in canonical order, incl. the 20260729 replace of submit_followup)
# onto a disposable PostgreSQL, then extracting the expected catalog. NO live DB, NO Docker.
# Reproducible: same migrations + same PG major → same manifest. Run from anywhere.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # bty-app
MP="$ROOT/scripts/migration-proof"; MIG="$ROOT/supabase/migrations"
BASE="${PGPROOF_DIR:-/tmp/bty-expected}"; DATA="$BASE/data"; SOCK="$BASE/sock"; PORT="${PGPROOF_PORT:-5463}"
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER="postgres" PGDATABASE="proofdb"
cleanup() { pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$BASE"; }
trap cleanup EXIT
rm -rf "$BASE"; mkdir -p "$DATA" "$SOCK"
initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$BASE/pg.log" -w start >/dev/null
createdb -h "$SOCK" -p "$PORT" -U postgres proofdb

psql -q -v ON_ERROR_STOP=1 -f "$MP/expected/bootstrap.sql"
for v in 20260726000000_foundry_shared_understanding_v1 20260727000000_personalize_today_from_reflections_v1 \
         20260728000000_foundry_participant_followups_v1 20260729000000_foundry_submit_followup_ambiguity_fix_v1; do
  echo "  apply $v" >&2
  psql -q -v ON_ERROR_STOP=1 -f "$MIG/$v.sql"
done

# Run the SAME canonical read-only audit query used against live — no expected/live query drift.
AUDIT=$(psql -tAq -f "$ROOT/docs/audit/foundry_migration_provenance_readonly.sql")

# Exact checksums of the audited migration files + the audit query (Gate 6/7): a change to any of
# them without regenerating this manifest is detected by the reproducibility test.
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
CHECKSUMS=$(node -e "console.log(JSON.stringify({
  '20260726000000': process.argv[1], '20260727000000': process.argv[2],
  '20260728000000': process.argv[3], '20260729000000': process.argv[4], auditQuery: process.argv[5] }))" \
  "$(sha "$MIG/20260726000000_foundry_shared_understanding_v1.sql")" \
  "$(sha "$MIG/20260727000000_personalize_today_from_reflections_v1.sql")" \
  "$(sha "$MIG/20260728000000_foundry_participant_followups_v1.sql")" \
  "$(sha "$MIG/20260729000000_foundry_submit_followup_ambiguity_fix_v1.sql")" \
  "$(sha "$ROOT/docs/audit/foundry_migration_provenance_readonly.sql")")

AUDIT="$AUDIT" CHECKSUMS="$CHECKSUMS" node --input-type=module -e "
import { createHash } from 'node:crypto';
const { auditSchemaVersion, auditQueryVersion, serverVersionNum, effects: facts } = JSON.parse(process.env.AUDIT);
const META = { g26:['20260726000000','20260726000000'], g27:['20260727000000','20260727000000'],
               g28:['20260728000000','20260728000000'], g29:['20260728000000','20260729000000'] };
const effects = facts.map(f => { const [mig,fin]=META[f.grp]||[null,null];
  const { grp, ...rest } = f; return { ...rest, migrationVersion:mig, finalAuthorityMigration:fin }; })
  .sort((a,b)=>a.effectId.localeCompare(b.effectId));
const digestOf = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const manifest = {
  generatorVersion: 'r2.3',
  generator: 'scripts/migration-proof/build-expected-manifest.sh',
  regenCommand: 'bash scripts/migration-proof/build-expected-manifest.sh',
  auditQuery: 'docs/audit/foundry_migration_provenance_readonly.sql',
  auditSchemaVersion, auditQueryVersion,
  provenanceRef: 'docs/audit/foundry_migration_provenance.json',
  postgresServerVersionNum: serverVersionNum,
  functionBodyChecking: 'on',
  migrationChecksums: JSON.parse(process.env.CHECKSUMS),
  note: 'Expected FINAL state after every relevant later migration. submit_followup finalAuthority=20260729.',
  effectCount: effects.length,
  expectedManifestDigest: digestOf(effects),
  effects,
};
process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
" > "$ROOT/docs/audit/foundry_migration_expected_catalog.json"

echo "wrote docs/audit/foundry_migration_expected_catalog.json ($(grep -c effectId "$ROOT/docs/audit/foundry_migration_expected_catalog.json") effect lines)"
