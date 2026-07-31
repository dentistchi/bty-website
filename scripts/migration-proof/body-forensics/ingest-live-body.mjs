#!/usr/bin/env node
// ============================================================================
// Ingest a TRUSTED read-only live function body export (Slice 3.2I-R2.7).
//
//   node scripts/migration-proof/body-forensics/ingest-live-body.mjs \
//        <live_body_export.json> <live_audit_result.r2.6.json>
//
// Verifies every exported body against the digests the r2.6 packet audit ALREADY
// attested (see src/lib/bty/foundry/migrationBodyForensics.ts), then writes the
// verified bodies as installable forensic fixtures:
//
//   docs/audit/forensics/live_body_set_shared_review.sql
//   docs/audit/forensics/live_body_submit_followup.sql
//
// The forensic harness picks those up automatically on its next run.
//
// It connects to nothing. It refuses to write any body that fails verification —
// an unattested body must never be measured as if it were the live one.
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  parseBodyExport, attestedBodyDigests, verifyBodyExport, renderBodyInstallSql, BodyExportError,
} from "../../../src/lib/bty/foundry/migrationBodyForensics.ts";

const [, , exportPath, auditPath] = process.argv;
if (!exportPath || !auditPath) {
  console.error("usage: node ingest-live-body.mjs <live_body_export.json> <live_audit_result.r2.6.json>");
  process.exit(2);
}

// Only these two are in question; the other two audited functions already match repository authority.
const EMIT = { bty_foundry_set_shared_review: "set_shared_review", bty_foundry_submit_followup: "submit_followup" };
const OUT_DIR = resolve("docs/audit/forensics");

try {
  const exported = parseBodyExport(readFileSync(resolve(exportPath), "utf8"));
  const attested = attestedBodyDigests(JSON.parse(readFileSync(resolve(auditPath), "utf8")));
  const report = verifyBodyExport(exported, attested);

  if (!report.boundPacketOk) {
    throw new BodyExportError(`export boundPacketId ${exported.boundPacketId.slice(0, 12)}… does not match the audit packetId ${attested.packetId.slice(0, 12)}… — re-run BOTH against the same packet`);
  }
  if (!report.serverMajorOk) {
    throw new BodyExportError("export and audit result came from different PostgreSQL majors — re-export from the same live database");
  }

  console.log(`packet ${attested.packetId.slice(0, 12)}… bound OK · PostgreSQL major matches`);
  for (const r of report.results) {
    console.log(`  ${r.authentic ? "AUTHENTIC" : "REJECTED "}  ${r.proname}  ${r.computedSha256.slice(0, 12)}…  ${r.reason}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const f of exported.functions) {
    const short = EMIT[f.proname];
    if (!short) continue;
    const v = report.results.find((r) => r.proname === f.proname);
    if (!v?.authentic) {
      console.error(`  SKIPPED ${f.proname} — not authentic, no fixture written`);
      continue;
    }
    const target = join(OUT_DIR, `live_body_${short}.sql`);
    writeFileSync(target, renderBodyInstallSql(f, v));
    console.log(`  wrote ${target}`);
    written++;
  }

  if (written === 0) {
    console.error("\nNo verified live body was written. The forensic decision stays UNRESOLVED.");
    process.exit(1);
  }
  console.log(`\n${written} live body fixture(s) written. Now run:`);
  console.log("  PGPROOF_BINDIR=/opt/homebrew/opt/postgresql@17/bin bash scripts/migration-proof/body-forensics/run.sh");
  console.log("The harness will FAIL against its recorded baseline until a human reviews the new live rows and records them.");
} catch (e) {
  if (e instanceof BodyExportError) {
    console.error(`BODY EXPORT REJECTED: ${e.message}`);
    console.error("No forensic fixture was written. Re-run the UNEDITED export in a trusted read-only runner.");
    process.exit(3);
  }
  throw e;
}
