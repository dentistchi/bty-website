// Assemble the RUNTIME-ATTESTED audit packet (Slice 3.2I-R5B1A.1-R2.5). From the disposable-replay
// effects (env FACTS) + the checked-in files, write: the expected manifest, the DERIVED security +
// constraint statement maps (exact source-statement provenance via the tokenizer, not grep counts),
// and the GENERATED single-statement live SQL that measures the ACTUAL executed query via
// current_query(). Invoked by build-expected-manifest.sh with PG* env set (it shells to psql to
// obtain the empirical runtime-query digest).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { splitStatements, classifySecurity, classifyConstraintSource } from "./sqlStatements.mjs";

const ROOT = process.env.ROOT;
const AUD = ROOT + "/docs/audit", MIG = ROOT + "/supabase/migrations", MP = ROOT + "/scripts/migration-proof";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const shaFile = (p) => sha(readFileSync(p));
const META = { g26: ["20260726000000", "20260726000000"], g27: ["20260727000000", "20260727000000"],
               g28: ["20260728000000", "20260728000000"], g29: ["20260728000000", "20260729000000"] };
const AUDIT_SCHEMA = "r2.6", PACKET_VERSION = "r2.6", COMPARATOR_CONTRACT = "r2.6", RUNTIME_CONTRACT = "r2.6";
const MIG_FILES = {
  "20260726000000": "20260726000000_foundry_shared_understanding_v1.sql",
  "20260727000000": "20260727000000_personalize_today_from_reflections_v1.sql",
  "20260728000000": "20260728000000_foundry_participant_followups_v1.sql",
  "20260729000000": "20260729000000_foundry_submit_followup_ambiguity_fix_v1.sql",
};

// 1) EXPECTED MANIFEST
const facts = JSON.parse(process.env.FACTS);
const effects = facts.map((f) => { const [mig, fin] = META[f.grp] || [null, null]; const { grp, ...rest } = f;
  return { ...rest, migrationVersion: mig, finalAuthorityMigration: fin }; })
  .sort((a, b) => a.effectId.localeCompare(b.effectId));
const expectedManifestDigest = sha(JSON.stringify(effects));

// 2) SECURITY STATEMENT MAP — fully DERIVED from the tokenizer (exact source provenance).
const TABLES = ["foundry_shared_review_audit", "foundry_participant_followups", "foundry_participant_followup_audit"];
const FNS = ["bty_foundry_set_shared_review", "bty_foundry_materialize_followup", "bty_foundry_submit_followup", "bty_foundry_get_my_followup"];
const aclFnId = (name) => { const e = effects.find((x) => x.objectType === "acl_function" && x.effectId.startsWith("acl:function:public." + name + "(")); if (!e) throw new Error("no acl_function " + name); return e.effectId; };
const rolesIn = (text) => ["anon", "public", "authenticated", "service_role"].filter((r) => new RegExp("\\b" + r + "\\b", "i").test(text.replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, " ")));
function securityEffectIds(type, text) {
  if (type === "REVOKE_TABLE" || type === "GRANT_TABLE") { const t = TABLES.find((x) => text.includes(x)); return t ? ["acl:table:public." + t] : []; }
  if (type === "REVOKE_FUNCTION" || type === "GRANT_FUNCTION") { const f = FNS.find((x) => text.includes(x)); return f ? [aclFnId(f)] : []; }
  if (type.startsWith("RLS_")) { const t = TABLES.find((x) => text.includes(x)); return t ? ["rls:public." + t] : []; }
  if (type.endsWith("_POLICY")) { const t = TABLES.find((x) => text.includes(x)); return t ? ["policies:public." + t] : []; }
  return [];
}
const securityStatements = [];
for (const [ver, file] of Object.entries(MIG_FILES)) {
  const sql = readFileSync(MIG + "/" + file, "utf8");
  for (const st of splitStatements(sql)) {
    const type = classifySecurity(st);
    if (!type) continue;
    securityStatements.push({ statementId: ver + "#" + String(st.ordinal).padStart(3, "0"), migrationVersion: ver,
      statementType: type, startLine: st.startLine, sourceSha256: st.sha256, roles: rolesIn(st.text), effectIds: securityEffectIds(type, st.text) });
  }
}
// 2b) ACL AUTHORITY-SCOPE PROOF (R2.6). The audit query DECLARES, per ACL effect, which grantees the
// migrations explicitly control (`controlledRoles`). That declaration is only trustworthy if it
// equals the role set DERIVED from the tokenized GRANT/REVOKE statements themselves. Assert it here,
// at generation time, so the packet can never ship an authority boundary that was widened or
// narrowed to make a result pass. Anything outside this set is environment state (diagnostic only).
const NORMALIZE_ROLE = (r) => (r === "public" ? "PUBLIC" : r);
const derivedControlled = {};
for (const s of securityStatements) {
  if (!/^(GRANT|REVOKE)_(TABLE|FUNCTION)$/.test(s.statementType)) continue;
  for (const id of s.effectIds) {
    derivedControlled[id] ||= new Set();
    for (const r of s.roles) derivedControlled[id].add(NORMALIZE_ROLE(r));
  }
}
for (const e of effects.filter((x) => x.objectType === "acl_table" || x.objectType === "acl_function")) {
  const declared = e.properties.controlledRoles;
  if (!Array.isArray(declared)) throw new Error(`ACL effect ${e.effectId} has no declared controlledRoles — regenerate audit-query-body.sql`);
  const derived = [...(derivedControlled[e.effectId] ?? new Set())].sort();
  if (JSON.stringify(declared) !== JSON.stringify(derived)) {
    throw new Error(`ACL AUTHORITY SCOPE MISMATCH for ${e.effectId}: query declares ${JSON.stringify(declared)} but the migration statements control ${JSON.stringify(derived)}`);
  }
  if (!Array.isArray(e.properties.environmentTuples)) throw new Error(`ACL effect ${e.effectId} has no environmentTuples channel`);
}

const securityMap = { note: "DERIVED from the SQL tokenizer — every explicit security statement with exact source SHA-256 + line + resolved manifest effectIds. Grep is diagnostic only.", auditSchemaVersion: AUDIT_SCHEMA, statements: securityStatements, aclAuthorityScope: Object.fromEntries(Object.entries(derivedControlled).map(([k, v]) => [k, [...v].sort()]).sort(([a], [b]) => a.localeCompare(b))) };
const securityMapJson = JSON.stringify(securityMap, null, 2) + "\n";
writeFileSync(AUD + "/foundry_migration_security_statement_map.json", securityMapJson);

// 3) CONSTRAINT STATEMENT MAP — each pk/fk/unique/check effect → the exact source statement that
//    carries its constraint name (inline CREATE TABLE or a guarded ALTER … ADD CONSTRAINT).
const constraintEffects = effects.filter((e) => ["pk", "fk", "unique", "check"].includes(e.objectType));
const stmtCache = {};
const stmtsOf = (ver) => (stmtCache[ver] ||= splitStatements(readFileSync(MIG + "/" + MIG_FILES[ver], "utf8")));
const constraintStatements = constraintEffects.map((e) => {
  const conname = e.effectId.split(".").pop();
  const table = e.properties.table; // e.g. 'foundry_participant_followups'
  // Prefer the statement that names the constraint (explicit / DO-guarded ADD CONSTRAINT); fall back
  // to the CREATE TABLE that carries it inline (auto-named FK/PK have no name in source text).
  const stmts = stmtsOf(e.migrationVersion);
  const src = stmts.find((s) => s.text.includes(conname))
    || stmts.find((s) => classifyConstraintSource(s) === "CREATE_TABLE" && s.text.includes(table));
  if (!src) throw new Error("no source statement for constraint " + e.effectId);
  return { effectId: e.effectId, objectType: e.objectType, migrationVersion: e.migrationVersion, finalAuthorityMigration: e.finalAuthorityMigration,
    constraintName: conname, table, sourceKind: src.text.includes(conname) ? "named" : "inline_create_table",
    statementOrdinal: src.ordinal, startLine: src.startLine, sourceSha256: src.sha256 };
});
const constraintMap = { note: "Each PK/FK/UNIQUE/CHECK effect → the exact migration statement (by constraint name) that creates it, with source SHA-256.", auditSchemaVersion: AUDIT_SCHEMA, statements: constraintStatements };
const constraintMapJson = JSON.stringify(constraintMap, null, 2) + "\n";
writeFileSync(AUD + "/foundry_migration_constraint_statement_map.json", constraintMapJson);

// 4) COMPONENT DIGESTS
const migrationChecksums = Object.fromEntries(Object.entries(MIG_FILES).map(([v, f]) => [v, shaFile(MIG + "/" + f)]));
const auditQueryBodyDigest = shaFile(MP + "/audit-query-body.sql");
const provenanceDigest = shaFile(AUD + "/foundry_migration_provenance.json");
const securityStatementMapDigest = sha(securityMapJson);
const constraintStatementMapDigest = sha(constraintMapJson);

// 5) BUILD the single-statement live SQL; obtain the EMPIRICAL runtime-query digest by executing it.
const body = readFileSync(MP + "/audit-query-body.sql", "utf8").trimEnd();
const ZERO = "0".repeat(64);
function buildSql(packetId, runtimeDigest) {
  const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  return [
    "-- ============================================================================",
    "-- GENERATED — do not hand-edit. Regenerate: bash scripts/migration-proof/build-expected-manifest.sh",
    "-- Runtime-attested read-only live audit for migrations 20260726-20260729 (Slice R2.5). ONE",
    "-- statement. Run in a trusted runner (psql -f) that exposes current_query(); returns one JSON",
    "-- value (column \"audit\") whose actualRuntimeQueryDigest MEASURES the statement that actually ran",
    "-- (only the self-referential packetId + expectedRuntimeQueryDigest literals are canonicalized).",
    "-- STRICTLY read-only. Authorizes NO repair or apply.",
    "-- ============================================================================",
    "select json_build_object(",
    "  'auditSchemaVersion', " + lit(AUDIT_SCHEMA) + ",",
    "  'auditPacketVersion', " + lit(PACKET_VERSION) + ",",
    "  'runtimeQueryContractVersion', " + lit(RUNTIME_CONTRACT) + ",",
    "  'comparatorContractVersion', " + lit(COMPARATOR_CONTRACT) + ",",
    "  'packetId', " + lit(packetId) + ",",
    "  'expectedManifestDigest', " + lit(expectedManifestDigest) + ",",
    "  'provenanceDigest', " + lit(provenanceDigest) + ",",
    "  'securityStatementMapDigest', " + lit(securityStatementMapDigest) + ",",
    "  'constraintStatementMapDigest', " + lit(constraintStatementMapDigest) + ",",
    "  'auditQueryBodyDigest', " + lit(auditQueryBodyDigest) + ",",
    "  'migrationChecksums', " + lit(JSON.stringify(migrationChecksums)) + "::json,",
    "  'expectedRuntimeQueryDigest', " + lit(runtimeDigest) + ",",
    "  'actualRuntimeQueryDigest', encode(sha256(convert_to(",
    "    regexp_replace(",
    "      regexp_replace(current_query(), $q1$('packetId', ')[0-9a-f]{64}(')$q1$, $r1$\\1__PID__\\2$r1$, 'g'),",
    "      $q2$('expectedRuntimeQueryDigest', ')[0-9a-f]{64}(')$q2$, $r2$\\1__RQD__\\2$r2$, 'g'),",
    "    'UTF8')), 'hex'),",
    "  'serverVersionNum', current_setting('server_version_num')::int,",
    "  'effects', (",
    body.split("\n").map((l) => "    " + l).join("\n"),
    "  )",
    ") as audit;",
    "",
  ].join("\n");
}
const runtimeDigestOf = (sqlText) => {
  const tmp = "/tmp/bty-audit-v.sql";
  writeFileSync(tmp, sqlText);
  const out = execFileSync("psql", ["-tAq", "-f", tmp], { encoding: "utf8" });
  return JSON.parse(out).actualRuntimeQueryDigest;
};
const expectedRuntimeQueryDigest = runtimeDigestOf(buildSql(ZERO, ZERO)); // placeholder self-refs → canonicalized away

// 6) PACKET ID binds every component including the runtime-query digest (non-circular).
const components = {
  auditSchemaVersion: AUDIT_SCHEMA, packetVersion: PACKET_VERSION, comparatorContractVersion: COMPARATOR_CONTRACT,
  runtimeQueryContractVersion: RUNTIME_CONTRACT, expectedManifestDigest, provenanceDigest, securityStatementMapDigest,
  constraintStatementMapDigest, auditQueryBodyDigest, expectedRuntimeQueryDigest, migrationChecksums,
};
const packetId = sha(JSON.stringify(components));

const manifest = {
  generatorVersion: "r2.5", generator: "scripts/migration-proof/build-expected-manifest.sh",
  regenCommand: "bash scripts/migration-proof/build-expected-manifest.sh",
  auditQuery: "docs/audit/foundry_migration_provenance_readonly.sql",
  auditQueryBody: "scripts/migration-proof/audit-query-body.sql",
  provenanceRef: "docs/audit/foundry_migration_provenance.json",
  securityStatementMapRef: "docs/audit/foundry_migration_security_statement_map.json",
  constraintStatementMapRef: "docs/audit/foundry_migration_constraint_statement_map.json",
  auditSchemaVersion: AUDIT_SCHEMA, auditPacketVersion: PACKET_VERSION, comparatorContractVersion: COMPARATOR_CONTRACT,
  runtimeQueryContractVersion: RUNTIME_CONTRACT,
  postgresServerVersionNum: Number(process.env.SVN), functionBodyChecking: "on",
  migrationChecksums, auditQueryBodyDigest, provenanceDigest, securityStatementMapDigest, constraintStatementMapDigest,
  expectedManifestDigest, expectedRuntimeQueryDigest, packetId,
  note: "Runtime-attested. Privileges = exact aclexplode tuples. PK/FK/UNIQUE/CHECK are first-class. submit_followup finalAuthority=20260729.",
  effectCount: effects.length, effects,
};
writeFileSync(AUD + "/foundry_migration_expected_catalog.json", JSON.stringify(manifest, null, 2) + "\n");

// 7) Emit the FINAL SQL and self-check the runtime digest is invariant under real packetId/RQD.
const finalSql = buildSql(packetId, expectedRuntimeQueryDigest);
writeFileSync(AUD + "/foundry_migration_provenance_readonly.sql", finalSql);
const selfCheck = runtimeDigestOf(finalSql);
if (selfCheck !== expectedRuntimeQueryDigest) throw new Error(`runtime-digest self-check FAILED: ${selfCheck} vs ${expectedRuntimeQueryDigest}`);

process.stdout.write(`packetId ${packetId} | effects ${effects.length} | sec-stmts ${securityStatements.length} | con-stmts ${constraintStatements.length} | runtimeDigest ${expectedRuntimeQueryDigest.slice(0, 12)}… (self-check OK)\n`);
