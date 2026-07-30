/**
 * CLI wrapper for the offline migration-audit comparator (Slice 3.2I-R5B1A.1-R2.2).
 *   npm run compare:foundry-migration-audit -- <live-audit-result.json>
 * <live-audit-result.json> is the single JSON cell exported from the Supabase SQL Editor after
 * running docs/audit/foundry_migration_provenance_readonly.sql (shape {serverVersionNum, effects}).
 * It NEVER connects to a database, runs no repair/apply, and only reads two local files.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareMigrationAudit, type ExpectedManifest, type LiveAudit } from "../../../src/lib/bty/foundry/migrationAuditComparator";

const liveArg = process.argv[2];
if (!liveArg) {
  console.error("usage: npm run compare:foundry-migration-audit -- <live-audit-result.json>");
  process.exit(2);
}
const expected: ExpectedManifest = JSON.parse(readFileSync(resolve("docs/audit/foundry_migration_expected_catalog.json"), "utf8"));
const live: LiveAudit = JSON.parse(readFileSync(resolve(liveArg), "utf8"));

const report = compareMigrationAudit(expected, live);
console.log(`PostgreSQL major: expected ${report.expectedMajor} vs live ${report.liveMajor} — ${report.postgresMajorMatch ? "match" : "MISMATCH (digests → manual)"}`);
console.log("\nPer-migration verdict candidates:");
for (const m of report.migrations) {
  const counts = m.effects.reduce<Record<string, number>>((a, e) => ((a[e.status] = (a[e.status] ?? 0) + 1), a), {});
  console.log(`  ${m.migration}: ${m.verdict}${m.repairEligible ? " (REPAIR-ELIGIBLE candidate)" : ""}  ${JSON.stringify(counts)}`);
}
const problems = report.effects.filter((e) => e.status === "CONFLICT" || e.status === "MISSING_OBJECT");
if (problems.length) {
  console.log("\nConflicts / missing objects:");
  for (const p of problems) console.log(`  [${p.status}] ${p.effectId} — ${p.detail}`);
}
const manual = report.effects.filter((e) => e.status === "MANUAL" || e.status === "EVIDENCE_ABSENT");
if (manual.length) {
  console.log("\nManual review / evidence gaps:");
  for (const p of manual) console.log(`  [${p.status}] ${p.effectId} — ${p.detail}`);
}
console.log("\nNOTE: A candidate is NOT authorization to repair migration history or apply schema.");
// Exit code: 0 if any migration is repair-eligible-clean and none conflict; 1 if any conflict/missing.
process.exit(problems.length ? 1 : 0);
