# Manual read-only live audit packet — Foundry migrations 20260726–20260729

Slice 3.2I-R5B1A.1-R2.2. This packet lets the Commander collect the live evidence needed to give
each historical migration a strict A/D/E verdict. **Machine-comparison first — do not interpret raw
catalog rows by hand.**

## 1. Audit SQL file
`bty-app/docs/audit/foundry_migration_provenance_readonly.sql`

## 2. Exact version
Pinned by the inner commit that carries this packet (see `git log -1 -- docs/audit/`). The SAME
query builds the expected manifest (`build-expected-manifest.sh`), so live and expected are produced
identically — no query drift.

## 3. It is strictly read-only
Only `pg_catalog` / `information_schema`. No `INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/GRANT/REVOKE`.
It never selects application rows, so no Training text, emails, `guided_answers`, or constraint
statements are returned — only structured catalog metadata + version-stable digests.

## 4. Run it (Supabase SQL Editor)
Open the SQL Editor on the live project, paste the entire file, run. It returns **one row / one JSON
value** in a column named `audit`: `{ "serverVersionNum": <int>, "effects": [ … ] }`.

## 5. Export the result
Copy the single `audit` JSON cell (or use the editor's "Export → JSON"). Save it verbatim.

## 6. Filename
`live_audit_result.json` (contents = exactly the `{serverVersionNum, effects}` object).

## 7. Must NOT be included
No credentials, no `.env`, no application data, no user content. The query already excludes these;
do not add columns that select table rows.

## 8. Comparator command
```
cd bty-app
npm run compare:foundry-migration-audit -- /path/to/live_audit_result.json
```
It reads the checked-in expected manifest (`docs/audit/foundry_migration_expected_catalog.json`) and
your live result. It connects to nothing and executes no repair/apply.

## 9. Expected output categories
Per effect: `EXACT_MATCH`, `CONFLICT`, `MISSING_OBJECT`, `EVIDENCE_ABSENT`, `MANUAL`. Per migration
(grouped by **final authority**, so `bty_foundry_submit_followup` is judged under 20260729, not
20260728): verdict `A` (all effects exact → repair-eligible **candidate**), `D` (a conflict or
missing object), or `E` (evidence/manual gap). If live PostgreSQL major ≠ 16, digest-based effects
become `MANUAL` (format may differ across majors) — structured properties are still compared.

## 10. A candidate is not authorization
A verdict of `A` is a **candidate** only. Running this audit and the comparator does **not** authorize
`supabase migration repair`, `db push`, or any schema apply. Those remain separately gated (single
live database = production).

## Not covered by the automatic manifest (manual review items)
- Function/table **grants** (recipient/privilege) are environment-sensitive — verify manually from
  the audit SQL's function-attribute output if grant provenance is in question.
- The migrations create **no policies** (RLS-on, deny-all); the manifest asserts `policy_count = 0`.
