// Assemble the authoritative audit packet from the disposable-replay effects (env FACTS) + the
// checked-in files. Writes the expected manifest, the resolved security statement map, and the
// GENERATED self-authenticating live audit SQL. Invoked by build-expected-manifest.sh.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = process.env.ROOT;
const AUD = ROOT + "/docs/audit", MIG = ROOT + "/supabase/migrations", MP = ROOT + "/scripts/migration-proof";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const shaFile = (p) => sha(readFileSync(p));
const META = { g26: ["20260726000000", "20260726000000"], g27: ["20260727000000", "20260727000000"],
               g28: ["20260728000000", "20260728000000"], g29: ["20260728000000", "20260729000000"] };
const AUDIT_SCHEMA = "r2.4", PACKET_VERSION = "r2.4", COMPARATOR_CONTRACT = "r2.4";

// 1) EXPECTED MANIFEST
const facts = JSON.parse(process.env.FACTS);
const effects = facts.map((f) => { const [mig, fin] = META[f.grp] || [null, null]; const { grp, ...rest } = f;
  return { ...rest, migrationVersion: mig, finalAuthorityMigration: fin }; })
  .sort((a, b) => a.effectId.localeCompare(b.effectId));
const expectedManifestDigest = sha(JSON.stringify(effects));

// 2) SECURITY STATEMENT MAP — authored by object; effectIds RESOLVED from the manifest (exact).
const findFn = (name) => {
  const e = effects.find((x) => x.objectType === "acl_function" && x.effectId.startsWith("acl:function:public." + name + "("));
  if (!e) throw new Error("statement-map: no acl_function effect for " + name);
  return e.effectId;
};
const A_T = (t) => "acl:table:public." + t, R = (t) => "rls:public." + t;
const S = (migrationVersion, statementType, objectKey, roles, privileges, effectIds) =>
  ({ migrationVersion, statementType, objectKey, roles, privileges, effectIds });
const raw = [
  S("20260726000000", "REVOKE_TABLE", "table:foundry_shared_review_audit", ["anon", "PUBLIC", "authenticated"], ["ALL"], [A_T("foundry_shared_review_audit")]),
  S("20260726000000", "RLS_ENABLE", "table:foundry_shared_review_audit", [], [], [R("foundry_shared_review_audit")]),
  S("20260726000000", "REVOKE_FUNCTION", "function:bty_foundry_set_shared_review", ["anon", "PUBLIC", "authenticated"], ["EXECUTE"], [findFn("bty_foundry_set_shared_review")]),
  S("20260726000000", "GRANT_FUNCTION", "function:bty_foundry_set_shared_review", ["service_role"], ["EXECUTE"], [findFn("bty_foundry_set_shared_review")]),
  S("20260728000000", "REVOKE_TABLE", "table:foundry_participant_followups", ["anon", "PUBLIC", "authenticated"], ["ALL"], [A_T("foundry_participant_followups")]),
  S("20260728000000", "RLS_ENABLE", "table:foundry_participant_followups", [], [], [R("foundry_participant_followups")]),
  S("20260728000000", "REVOKE_TABLE", "table:foundry_participant_followup_audit", ["anon", "PUBLIC", "authenticated"], ["ALL"], [A_T("foundry_participant_followup_audit")]),
  S("20260728000000", "RLS_ENABLE", "table:foundry_participant_followup_audit", [], [], [R("foundry_participant_followup_audit")]),
  S("20260728000000", "REVOKE_FUNCTION", "function:bty_foundry_materialize_followup", ["anon", "PUBLIC", "authenticated"], ["EXECUTE"], [findFn("bty_foundry_materialize_followup")]),
  S("20260728000000", "GRANT_FUNCTION", "function:bty_foundry_materialize_followup", ["service_role"], ["EXECUTE"], [findFn("bty_foundry_materialize_followup")]),
  S("20260728000000", "REVOKE_FUNCTION", "function:bty_foundry_submit_followup", ["anon", "PUBLIC", "authenticated"], ["EXECUTE"], [findFn("bty_foundry_submit_followup")]),
  S("20260728000000", "GRANT_FUNCTION", "function:bty_foundry_submit_followup", ["service_role"], ["EXECUTE"], [findFn("bty_foundry_submit_followup")]),
  S("20260728000000", "REVOKE_FUNCTION", "function:bty_foundry_get_my_followup", ["anon", "PUBLIC", "authenticated"], ["EXECUTE"], [findFn("bty_foundry_get_my_followup")]),
  S("20260728000000", "GRANT_FUNCTION", "function:bty_foundry_get_my_followup", ["service_role"], ["EXECUTE"], [findFn("bty_foundry_get_my_followup")]),
  S("20260729000000", "REVOKE_FUNCTION", "function:bty_foundry_submit_followup", ["anon", "PUBLIC", "authenticated"], ["EXECUTE"], [findFn("bty_foundry_submit_followup")]),
  S("20260729000000", "GRANT_FUNCTION", "function:bty_foundry_submit_followup", ["service_role"], ["EXECUTE"], [findFn("bty_foundry_submit_followup")]),
];
const statements = raw.map((s, i) => ({ statementId: s.migrationVersion + "#" + String(i).padStart(2, "0"), ...s }));
const statementMap = {
  note: "Every explicit GRANT/REVOKE/RLS statement in 20260726-20260729 → the manifest effect(s) it controls; effectIds resolved from the manifest.",
  auditSchemaVersion: AUDIT_SCHEMA,
  statementCountsByMigration: { "20260726000000": 4, "20260728000000": 10, "20260729000000": 2 },
  statements,
};
const statementMapJson = JSON.stringify(statementMap, null, 2) + "\n";
writeFileSync(AUD + "/foundry_migration_security_statement_map.json", statementMapJson);

// 3) COMPONENT DIGESTS + PACKET ID (non-circular: over component digests, not whole files)
const migrationChecksums = {
  "20260726000000": shaFile(MIG + "/20260726000000_foundry_shared_understanding_v1.sql"),
  "20260727000000": shaFile(MIG + "/20260727000000_personalize_today_from_reflections_v1.sql"),
  "20260728000000": shaFile(MIG + "/20260728000000_foundry_participant_followups_v1.sql"),
  "20260729000000": shaFile(MIG + "/20260729000000_foundry_submit_followup_ambiguity_fix_v1.sql"),
};
const auditQueryBodyDigest = shaFile(MP + "/audit-query-body.sql");
const provenanceDigest = shaFile(AUD + "/foundry_migration_provenance.json");
const securityStatementMapDigest = sha(statementMapJson);
const components = {
  auditSchemaVersion: AUDIT_SCHEMA, packetVersion: PACKET_VERSION, comparatorContractVersion: COMPARATOR_CONTRACT,
  expectedManifestDigest, provenanceDigest, securityStatementMapDigest, auditQueryBodyDigest, migrationChecksums,
};
const packetId = sha(JSON.stringify(components));

const manifest = {
  generatorVersion: "r2.4", generator: "scripts/migration-proof/build-expected-manifest.sh",
  regenCommand: "bash scripts/migration-proof/build-expected-manifest.sh",
  auditQuery: "docs/audit/foundry_migration_provenance_readonly.sql",
  auditQueryBody: "scripts/migration-proof/audit-query-body.sql",
  provenanceRef: "docs/audit/foundry_migration_provenance.json",
  securityStatementMapRef: "docs/audit/foundry_migration_security_statement_map.json",
  auditSchemaVersion: AUDIT_SCHEMA, auditPacketVersion: PACKET_VERSION, comparatorContractVersion: COMPARATOR_CONTRACT,
  postgresServerVersionNum: Number(process.env.SVN), functionBodyChecking: "on",
  migrationChecksums, auditQueryBodyDigest, provenanceDigest, securityStatementMapDigest, expectedManifestDigest, packetId,
  note: "Expected FINAL state after every relevant later migration. submit_followup finalAuthority=20260729. Privileges = exact aclexplode tuples (not effective access).",
  effectCount: effects.length, effects,
};
writeFileSync(AUD + "/foundry_migration_expected_catalog.json", JSON.stringify(manifest, null, 2) + "\n");

// 4) GENERATED self-authenticating LIVE SQL (body inlined verbatim + injected packet metadata)
const body = readFileSync(MP + "/audit-query-body.sql", "utf8").trimEnd();
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const sql = [
  "-- ============================================================================",
  "-- GENERATED — do not hand-edit. Regenerate: bash scripts/migration-proof/build-expected-manifest.sh",
  "-- Self-authenticating read-only live audit for migrations 20260726-20260729 (Slice R2.4).",
  "-- Paste into the Supabase SQL Editor and run. Returns ONE row / ONE JSON value (column \"audit\")",
  "-- carrying the packetId + every component digest, so the comparator can prove exactly which",
  "-- manifest / migration files / security map / query body / comparator contract produced it.",
  "-- STRICTLY read-only (pg_catalog / information_schema / aclexplode). Authorizes NO repair or apply.",
  "-- ============================================================================",
  "select json_build_object(",
  "  'auditSchemaVersion', " + lit(AUDIT_SCHEMA) + ",",
  "  'auditPacketVersion', " + lit(PACKET_VERSION) + ",",
  "  'packetId', " + lit(packetId) + ",",
  "  'expectedManifestDigest', " + lit(expectedManifestDigest) + ",",
  "  'provenanceDigest', " + lit(provenanceDigest) + ",",
  "  'securityStatementMapDigest', " + lit(securityStatementMapDigest) + ",",
  "  'auditQueryBodyDigest', " + lit(auditQueryBodyDigest) + ",",
  "  'comparatorContractVersion', " + lit(COMPARATOR_CONTRACT) + ",",
  "  'migrationChecksums', " + lit(JSON.stringify(migrationChecksums)) + "::json,",
  "  'serverVersionNum', current_setting('server_version_num')::int,",
  "  'effects', (",
  body.split("\n").map((l) => "    " + l).join("\n"),
  "  )",
  ") as audit;",
  "",
].join("\n");
writeFileSync(AUD + "/foundry_migration_provenance_readonly.sql", sql);

process.stdout.write(`packetId ${packetId} | effects ${effects.length} | statements ${statements.length}\n`);
