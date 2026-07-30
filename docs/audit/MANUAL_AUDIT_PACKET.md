# Manual read-only live audit packet — Foundry migrations 20260726–20260729 (authoritative, R2.3)

Collect the live evidence to give each historical migration a strict **A/D/E** verdict.
**Machine-comparison first — never review policies, grants, or function bodies by hand.**

## 1. Audit SQL path
`bty-app/docs/audit/foundry_migration_provenance_readonly.sql`

## 2. Exact inner commit
The commit that carries this packet (`git log -1 -- bty-app/docs/audit/`). The **same** query builds
the expected manifest, so live and expected are produced identically — no query drift.

## 3. Audit query version / digest
`auditSchemaVersion = "r2.3"` (emitted by the query and recorded in the manifest). The exact SHA-256
of the query file is stored in the manifest at `migrationChecksums.auditQuery`; the manifest-integrity
guard test fails if the query file changes without regenerating the manifest.

## 4. Expected manifest digest
`docs/audit/foundry_migration_expected_catalog.json` → `expectedManifestDigest` (SHA-256 of its
effects). The comparator recomputes and rejects a hand-edited manifest.

## 5. Read-only proof summary
Only `pg_catalog` / `information_schema` + `has_*_privilege()`. No `INSERT/UPDATE/DELETE/ALTER/CREATE/
DROP/GRANT/REVOKE`. No application rows are selected — no Training text, emails, `guided_answers`, or
constraint statements. Policies compared exactly (name/cmd/permissive/roles/USING/WITH CHECK);
privileges compared as exact booleans per role; function bodies by SHA-256 of raw `prosrc`.

## 6. Supabase SQL Editor instructions
Open the SQL Editor on the live project → paste the **entire** audit SQL file → Run. It returns
**one row / one JSON value** in a column named `audit`.

## 7. Export format + filename
Export the single `audit` cell. Either works: **JSON** (copy the cell / "Export → JSON") or the
**CSV** export (header `audit` + one quoted JSON row). Save as `live_audit_result.json` (or `.csv`).

## 8. Zero-manual-edit extraction
Do **not** hand-edit escaped JSON. The comparator ingests raw JSON, a `{ "audit": … }` wrapper, or the
single-cell CSV directly. If you copied the cell, paste it verbatim into the file.

## 9. Comparator command
```
cd bty-app
npm run compare:foundry-migration-audit -- /path/to/live_audit_result.json
```
Reads only the checked-in manifest + your file. Connects to nothing. Runs no repair/apply.

## 10. Expected integrity-check output
First lines: `audit schema: r2.3 · PostgreSQL major: expected 16 vs live <n> — match/MISMATCH`, then
`totals: {...}`, then per-migration `A/D/E` (grouped by **final authority** — `submit_followup` is
judged under `20260729`). If the packet does not match, the tool prints `REJECTED (packet mismatch): …`
and exits `3` **without comparing** (stale audit version, wrong manifest digest, missing metadata,
duplicate/unknown effect IDs, or a truncated export).

## 11. Running the query authorizes nothing
An `A` candidate is **not** authorization to `supabase migration repair`, `db push`, or apply any
schema. Those remain separately gated (single live database = production).

## 12. Stop condition
If the comparator prints `REJECTED (packet mismatch)`, **stop** — re-run the current
`docs/audit/foundry_migration_provenance_readonly.sql` and re-export. Do not compare an old export
against a newer manifest.

---
Nothing in the audited migrations creates policies (RLS-on, deny-all → `policies: []`) or grants to
`anon/authenticated/public` (all revoked). Any such live tuple surfaces as a `CONFLICT`, not a manual
review item.
