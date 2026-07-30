/**
 * CLI for the offline migration-audit comparator (Slice 3.2I-R5B1A.1-R2.4).
 *   npm run compare:foundry-migration-audit -- <live-audit-result.(json|csv)>
 * Recomputes the packet identity from the CHECKED-IN authoritative files (manifest, provenance,
 * statement map, audit-query body, migration files), verifies it matches the manifest's stored
 * packetId, then verifies the live result's embedded packet metadata against it BEFORE comparing.
 * Connects to nothing; runs no repair/apply. Rejects a mismatched packet with `PACKET REJECTED`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  compareMigrationAudit, parseLiveAudit, assertManifestIntegrity, assertPacketHandshake, computePacketId,
  COMPARATOR_CONTRACT_VERSION, AuditPacketError, type ExpectedManifest, type PacketMeta,
} from "../../../src/lib/bty/foundry/migrationAuditComparator";

const liveArg = process.argv[2];
if (!liveArg) {
  console.error("usage: npm run compare:foundry-migration-audit -- <live-audit-result.(json|csv)>");
  process.exit(2);
}
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const shaFile = (p: string) => sha(readFileSync(resolve(p)));
const MIG = "supabase/migrations";

try {
  const expected: ExpectedManifest & { packetId?: string } = JSON.parse(readFileSync(resolve("docs/audit/foundry_migration_expected_catalog.json"), "utf8"));
  assertManifestIntegrity(expected);

  // Recompute every packet component from the checked-in files (Gate 6).
  const migrationChecksums: Record<string, string> = {
    "20260726000000": shaFile(`${MIG}/20260726000000_foundry_shared_understanding_v1.sql`),
    "20260727000000": shaFile(`${MIG}/20260727000000_personalize_today_from_reflections_v1.sql`),
    "20260728000000": shaFile(`${MIG}/20260728000000_foundry_participant_followups_v1.sql`),
    "20260729000000": shaFile(`${MIG}/20260729000000_foundry_submit_followup_ambiguity_fix_v1.sql`),
  };
  const base = {
    auditSchemaVersion: expected.auditSchemaVersion!, auditPacketVersion: (expected as { auditPacketVersion?: string }).auditPacketVersion!,
    comparatorContractVersion: COMPARATOR_CONTRACT_VERSION,
    expectedManifestDigest: sha(JSON.stringify(expected.effects)),
    provenanceDigest: shaFile("docs/audit/foundry_migration_provenance.json"),
    securityStatementMapDigest: shaFile("docs/audit/foundry_migration_security_statement_map.json"),
    auditQueryBodyDigest: shaFile("scripts/migration-proof/audit-query-body.sql"),
    migrationChecksums,
  };
  const expectedMeta: PacketMeta = { ...base, packetId: computePacketId(base) };
  if (expectedMeta.packetId !== expected.packetId) {
    throw new AuditPacketError("recomputed packetId does not match the manifest — a checked-in authoritative file was changed without regenerating the packet");
  }

  const live = parseLiveAudit(readFileSync(resolve(liveArg), "utf8"));
  assertPacketHandshake(expectedMeta, live);

  const report = compareMigrationAudit(expected, live);
  console.log(`packet ${expectedMeta.packetId.slice(0, 12)}… OK · PostgreSQL major: expected ${report.expectedMajor} vs live ${report.liveMajor} — ${report.postgresMajorMatch ? "match" : "MISMATCH (digests → manual)"}`);
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
    console.error(`PACKET REJECTED: ${e.message}`);
    console.error("No trusted comparison occurred. Re-run the CURRENT docs/audit/foundry_migration_provenance_readonly.sql and re-export.");
    process.exit(3);
  }
  throw e;
}
