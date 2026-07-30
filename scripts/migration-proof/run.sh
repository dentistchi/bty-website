#!/usr/bin/env bash
# Orchestrates the executable migration proofs against a disposable PostgreSQL reachable via the
# standard PG* env vars (PGHOST/PGPORT/PGUSER/PGDATABASE). Used by BOTH local.sh (initdb cluster,
# no Docker) and CI (services: postgres). Exits non-zero if any proof fails.
set -euo pipefail
cd "$(dirname "$0")/../.."   # → bty-app
export PSQL="psql -v ON_ERROR_STOP=1"

echo "== Part 2: selected_path =="; psql -v ON_ERROR_STOP=1 -f scripts/migration-proof/01_selected_path.sql | tail -1
echo "== Part 3: one-shell =="; psql -v ON_ERROR_STOP=1 -f scripts/migration-proof/02_one_shell.sql | tail -1
echo "== Part 4: negative guard matrix =="; PSQL="psql" bash scripts/migration-proof/negatives.sh
echo "== Part 5: concurrency =="; PSQL="psql" bash scripts/migration-proof/concurrency.sh
echo "ALL_MIGRATION_PROOFS: PASS"
