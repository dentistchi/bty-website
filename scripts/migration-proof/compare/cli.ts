/**
 * CLI wrapper for the offline migration-audit comparator (Slice 3.2I-R5B1A.1-R2.3).
 *   npm run compare:foundry-migration-audit -- <live-audit-result.(json|csv)>
 * <live-audit-result> is the single cell exported from the Supabase SQL Editor after running
 * docs/audit/foundry_migration_provenance_readonly.sql. Accepts raw JSON, a {audit:…} wrapper, or
 * the single-cell CSV export. It NEVER connects to a database and runs no repair/apply. It REJECTS
 * a mismatched packet (schema version / manifest digest / duplicate / unknown / truncated) before
 * comparing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  compareMigrationAudit, parseLiveAudit, assertManifestIntegrity, assertPacketHandshake, AuditPacketError,
  type ExpectedManifest,
} from "../../../src/lib/bty/foundry/migrationAuditComparator";

const liveArg = process.argv[2];
if (!liveArg) {
  console.error("usage: npm run compare:foundry-migration-audit -- <live-audit-result.(json|csv)>");
  process.exit(2);
}
const expected: ExpectedManifest = JSON.parse(readFileSync(resolve("docs/audit/foundry_migration_expected_catalog.json"), "utf8"));

try {
  assertManifestIntegrity(expected);
  const live = parseLiveAudit(readFileSync(resolve(liveArg), "utf8"));
  assertPacketHandshake(expected, live);

  const report = compareMigrationAudit(expected, live);
  console.log(`audit schema: ${expected.auditSchemaVersion} · PostgreSQL major: expected ${report.expectedMajor} vs live ${report.liveMajor} — ${report.postgresMajorMatch ? "match" : "MISMATCH (digests → manual)"}`);
  console.log(`totals: ${JSON.stringify(report.totals)}`);
  console.log("\nPer-migration verdict candidates (grouped by FINAL authority):");
  for (const m of report.migrations) {
    console.log(`  ${m.migration}: ${m.verdict}${m.repairEligible ? " (REPAIR-ELIGIBLE candidate)" : ""}` +
      (m.blockingEffectIds.length ? `  blocked by ${m.blockingEffectIds.length}: ${m.blockingEffectIds.slice(0, 4).join(", ")}${m.blockingEffectIds.length > 4 ? " …" : ""}` : ""));
  }
  const problems = report.effects.filter((e) => e.status === "CONFLICT" || e.status === "MISSING_OBJECT");
  if (problems.length) {
    console.log("\nConflicts / missing objects:");
    for (const p of problems) console.log(`  [${p.status}] ${p.effectId} — ${p.detail}`);
  }
  console.log("\nNOTE: an A candidate is NOT authorization to repair migration history or apply schema.");
  process.exit(problems.length ? 1 : 0);
} catch (e) {
  if (e instanceof AuditPacketError) {
    console.error(`REJECTED (packet mismatch): ${e.message}`);
    console.error("Re-run the CURRENT docs/audit/foundry_migration_provenance_readonly.sql and re-export.");
    process.exit(3);
  }
  throw e;
}
