import { describe, it, expect } from "vitest";
import {
  compareMigrationAudit, parseLiveAudit, assertPacketHandshake, assertManifestIntegrity,
  computeEffectsDigest, computePacketId, COMPARATOR_CONTRACT_VERSION, AuditPacketError,
  type ExpectedEffect, type ExpectedManifest, type LiveAudit, type PacketMeta,
} from "./migrationAuditComparator";

/** Gate 10 matrix (R2.3): policy + grant + function-body authority, and packet/ingest integrity. */

const PG16 = 160014;
function eff(over: Partial<ExpectedEffect>): ExpectedEffect {
  return {
    effectId: "x", objectType: "column", objectIdentity: "x", properties: {},
    definitionDigest: null, comparisonMode: "structured", autoComparable: true, manualReason: null,
    migrationVersion: "20260728000000", finalAuthorityMigration: "20260728000000", ...over,
  };
}
function manifest(effects: ExpectedEffect[]): ExpectedManifest {
  return { postgresServerVersionNum: PG16, auditSchemaVersion: "r2.3", expectedManifestDigest: computeEffectsDigest(effects), effects };
}
function live(effects: LiveAudit["effects"], pg = PG16): LiveAudit {
  return { auditSchemaVersion: "r2.3", serverVersionNum: pg, effects };
}
const status = (exp: ExpectedEffect, liveEff: LiveAudit["effects"][number]) =>
  compareMigrationAudit(manifest([exp]), live([liveEff])).effects[0].status;

describe("POLICY effects", () => {
  const pol = (arr: unknown) => eff({ effectId: "policies:public.t", objectType: "policies", properties: arr });
  const P = { name: "p1", cmd: "SELECT", permissive: true, roles: ["authenticated"], using: "(owner = auth.uid())", withCheck: null };
  it("exact policy matches", () => expect(status(pol([P]), { effectId: "policies:public.t", properties: [P] })).toBe("EXACT_MATCH"));
  it("wrong command conflicts", () => expect(status(pol([P]), { effectId: "policies:public.t", properties: [{ ...P, cmd: "ALL" }] })).toBe("CONFLICT"));
  it("wrong role conflicts", () => expect(status(pol([P]), { effectId: "policies:public.t", properties: [{ ...P, roles: ["anon"] }] })).toBe("CONFLICT"));
  it("wrong USING conflicts", () => expect(status(pol([P]), { effectId: "policies:public.t", properties: [{ ...P, using: "(true)" }] })).toBe("CONFLICT"));
  it("wrong WITH CHECK conflicts", () => expect(status(pol([P]), { effectId: "policies:public.t", properties: [{ ...P, withCheck: "(true)" }] })).toBe("CONFLICT"));
  it("policy missing conflicts", () => expect(status(pol([P]), { effectId: "policies:public.t", properties: [] })).toBe("CONFLICT"));
  it("extra (forbidden) policy conflicts — expected empty, live has one", () =>
    expect(status(pol([]), { effectId: "policies:public.t", properties: [P] })).toBe("CONFLICT"));
});

describe("GRANT / privilege effects", () => {
  const fp = eff({ effectId: "funcpriv:public.f()", objectType: "funcpriv", properties: { service_role: true, anon: false, authenticated: false, public: false } });
  it("exact grant tuple matches", () => expect(status(fp, { effectId: fp.effectId, properties: { service_role: true, anon: false, authenticated: false, public: false } })).toBe("EXACT_MATCH"));
  it("missing required grant conflicts (service_role lost)", () => expect(status(fp, { effectId: fp.effectId, properties: { service_role: false, anon: false, authenticated: false, public: false } })).toBe("CONFLICT"));
  it("forbidden revoked privilege present conflicts (public execute)", () => expect(status(fp, { effectId: fp.effectId, properties: { service_role: true, anon: false, authenticated: false, public: true } })).toBe("CONFLICT"));
  it("wrong grantee (anon granted) conflicts", () => expect(status(fp, { effectId: fp.effectId, properties: { service_role: true, anon: true, authenticated: false, public: false } })).toBe("CONFLICT"));
  it("table privilege leak conflicts", () => {
    const tp = eff({ effectId: "tablepriv:public.t", objectType: "tablepriv", properties: { anon: false, authenticated: false, public: false } });
    expect(status(tp, { effectId: tp.effectId, properties: { anon: true, authenticated: false, public: false } })).toBe("CONFLICT");
  });
});

describe("FUNCTION body authority (SHA-256 of raw prosrc, no whitespace normalization)", () => {
  const fn = (over: Record<string, unknown>) => eff({ effectId: "function:public.f()", objectType: "function", comparisonMode: "structured+body_digest",
    properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"], result: "TABLE(x text)" }, definitionDigest: "sha_A", ...over });
  it("exact raw body matches", () => expect(status(fn({}), { effectId: "function:public.f()", properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"], result: "TABLE(x text)" }, definitionDigest: "sha_A" })).toBe("EXACT_MATCH"));
  it("whitespace-in-string-literal difference conflicts (different raw digest)", () =>
    expect(status(fn({}), { effectId: "function:public.f()", properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"], result: "TABLE(x text)" }, definitionDigest: "sha_B" })).toBe("CONFLICT"));
  it("SECURITY DEFINER difference conflicts", () =>
    expect(status(fn({}), { effectId: "function:public.f()", properties: { security_definer: false, proconfig: ["search_path=pg_catalog, public"], result: "TABLE(x text)" }, definitionDigest: "sha_A" })).toBe("CONFLICT"));
  it("search_path difference conflicts", () =>
    expect(status(fn({}), { effectId: "function:public.f()", properties: { security_definer: true, proconfig: ["search_path=public"], result: "TABLE(x text)" }, definitionDigest: "sha_A" })).toBe("CONFLICT"));
  it("result-type difference conflicts", () =>
    expect(status(fn({}), { effectId: "function:public.f()", properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"], result: "TABLE(y int)" }, definitionDigest: "sha_A" })).toBe("CONFLICT"));
  it("cross-major unresolved body → MANUAL (migration E)", () => {
    const r = compareMigrationAudit(manifest([fn({})]), live([{ effectId: "function:public.f()", properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"], result: "TABLE(x text)" }, definitionDigest: "sha_DIFF" }], 150010));
    expect(r.effects[0].status).toBe("MANUAL");
    expect(r.migrations[0].verdict).toBe("E");
  });
});

describe("ACL effects (exact aclexplode tuples, not effective access)", () => {
  const facl = (tuples: unknown) => eff({ effectId: "acl:function:public.f()", objectType: "acl_function", properties: { tuples } });
  const SR = { grantee: "service_role", privilege: "EXECUTE", grantable: false };
  it("exact function ACL matches", () => expect(status(facl([SR]), { effectId: "acl:function:public.f()", properties: { tuples: [SR] } })).toBe("EXACT_MATCH"));
  it("missing service_role explicit grant conflicts", () => expect(status(facl([SR]), { effectId: "acl:function:public.f()", properties: { tuples: [] } })).toBe("CONFLICT"));
  it("PUBLIC execute remains → conflict (exact tuple set differs)", () =>
    expect(status(facl([SR]), { effectId: "acl:function:public.f()", properties: { tuples: [{ grantee: "PUBLIC", privilege: "EXECUTE", grantable: false }, SR] } })).toBe("CONFLICT"));
  it("anon execute remains → conflict", () =>
    expect(status(facl([SR]), { effectId: "acl:function:public.f()", properties: { tuples: [{ grantee: "anon", privilege: "EXECUTE", grantable: false }, SR] } })).toBe("CONFLICT"));
  it("wrong grantable state → conflict", () =>
    expect(status(facl([SR]), { effectId: "acl:function:public.f()", properties: { tuples: [{ ...SR, grantable: true }] } })).toBe("CONFLICT"));
  it("wrong privilege → conflict", () =>
    expect(status(facl([SR]), { effectId: "acl:function:public.f()", properties: { tuples: [{ ...SR, privilege: "USAGE" }] } })).toBe("CONFLICT"));
  it("exact table revoke state (empty ACL) matches; a forbidden table grant conflicts", () => {
    const tacl = eff({ effectId: "acl:table:public.t", objectType: "acl_table", properties: { tuples: [] } });
    expect(status(tacl, { effectId: "acl:table:public.t", properties: { tuples: [] } })).toBe("EXACT_MATCH");
    expect(status(tacl, { effectId: "acl:table:public.t", properties: { tuples: [{ grantee: "anon", privilege: "SELECT", grantable: false }] } })).toBe("CONFLICT");
  });
});

/**
 * R2.6 — the three ACL conflicts observed in the PostgreSQL-17 live audit, as exact fixtures.
 * Root cause: the audited migrations' ONLY table privilege statement is
 *   revoke all on public.<t> from anon, public, authenticated;
 * so service_role's table privileges are Supabase ENVIRONMENT defaults, outside migration authority.
 * The r2.5 packet compared them anyway and reported CONFLICT. Scoping the comparison to
 * statement-controlled grantees fixes the model WITHOUT weakening any real check.
 */
describe("R2.6 — ACL authority scope: environment tuples are diagnostic, controlled tuples are not", () => {
  // Exactly what the live PostgreSQL-17 audit returned for all three tables (incl. PG17's MAINTAIN).
  const LIVE_ENV_TUPLES = ["DELETE", "INSERT", "MAINTAIN", "REFERENCES", "SELECT", "TRIGGER", "TRUNCATE", "UPDATE"]
    .map((privilege) => ({ grantee: "service_role", privilege, grantable: false }));
  const tacl = (over: Record<string, unknown> = {}) => eff({
    effectId: "acl:table:public.foundry_participant_followups", objectType: "acl_table",
    properties: { controlledRoles: ["PUBLIC", "anon", "authenticated"], tuples: [], environmentTuples: [], ...over },
  });
  const liveTacl = (props: Record<string, unknown>) => ({
    effectId: "acl:table:public.foundry_participant_followups",
    properties: { controlledRoles: ["PUBLIC", "anon", "authenticated"], tuples: [], environmentTuples: [], ...props },
  });

  it("the r2.5 defect reproduced: comparing the environment grant as a controlled tuple → CONFLICT", () => {
    const r25 = eff({ effectId: "acl:table:public.foundry_participant_followups", objectType: "acl_table", properties: { tuples: [] } });
    expect(status(r25, { effectId: r25.effectId, properties: { tuples: LIVE_ENV_TUPLES } })).toBe("CONFLICT");
  });

  it("R2.6: the same live state, scoped to migration authority → EXACT_MATCH", () => {
    expect(status(tacl(), liveTacl({ environmentTuples: LIVE_ENV_TUPLES }))).toBe("EXACT_MATCH");
  });

  it("the environment-only difference is REPORTED, not silently dropped", () => {
    const r = compareMigrationAudit(manifest([tacl()]), live([liveTacl({ environmentTuples: LIVE_ENV_TUPLES })]));
    expect(r.effects[0].detail).toContain("environment-only ACL difference");
  });

  it("an explicitly REVOKED privilege present live is STILL a real conflict (anon)", () => {
    expect(status(tacl(), liveTacl({ tuples: [{ grantee: "anon", privilege: "SELECT", grantable: false }] }))).toBe("CONFLICT");
  });

  it("an explicitly REVOKED privilege present live is STILL a real conflict (PUBLIC)", () => {
    expect(status(tacl(), liveTacl({ tuples: [{ grantee: "PUBLIC", privilege: "SELECT", grantable: false }] }))).toBe("CONFLICT");
  });

  it("a required explicit GRANT missing live is STILL a real conflict (function service_role EXECUTE)", () => {
    const facl = eff({ effectId: "acl:function:public.f()", objectType: "acl_function",
      properties: { controlledRoles: ["PUBLIC", "anon", "authenticated", "service_role"], tuples: [{ grantee: "service_role", privilege: "EXECUTE", grantable: false }], environmentTuples: [] } });
    expect(status(facl, { effectId: "acl:function:public.f()", properties: { controlledRoles: ["PUBLIC", "anon", "authenticated", "service_role"], tuples: [], environmentTuples: [] } })).toBe("CONFLICT");
  });

  it("service_role on a FUNCTION stays controlled — an environment channel cannot launder it", () => {
    const facl = eff({ effectId: "acl:function:public.f()", objectType: "acl_function",
      properties: { controlledRoles: ["PUBLIC", "anon", "authenticated", "service_role"], tuples: [{ grantee: "service_role", privilege: "EXECUTE", grantable: false }], environmentTuples: [] } });
    expect(status(facl, { effectId: "acl:function:public.f()", properties: { controlledRoles: ["PUBLIC", "anon", "authenticated", "service_role"], tuples: [], environmentTuples: [{ grantee: "service_role", privilege: "EXECUTE", grantable: false }] } })).toBe("CONFLICT");
  });

  it("a widened/narrowed authority boundary is itself a conflict (controlledRoles IS compared)", () => {
    expect(status(tacl(), liveTacl({ controlledRoles: ["PUBLIC", "anon"] }))).toBe("CONFLICT");
  });
});

function packetMeta(over: Partial<PacketMeta> = {}): PacketMeta {
  const base = {
    auditSchemaVersion: "r2.7", auditPacketVersion: "r2.7", runtimeQueryContractVersion: "r2.7",
    comparatorContractVersion: COMPARATOR_CONTRACT_VERSION,
    expectedManifestDigest: "m".repeat(64), provenanceDigest: "p".repeat(64), securityStatementMapDigest: "s".repeat(64),
    constraintStatementMapDigest: "c".repeat(64), auditQueryBodyDigest: "q".repeat(64),
    expectedRuntimeQueryDigest: "r".repeat(64), migrationChecksums: { "20260726000000": "a".repeat(64) },
  };
  return { ...base, packetId: computePacketId(base), ...over };
}
function liveOf(meta: PacketMeta, effects: LiveAudit["effects"] = [{ effectId: "a" }, { effectId: "b" }]): LiveAudit & PacketMeta & { actualRuntimeQueryDigest: string } {
  // By default the ACTUAL executed-query digest equals the embedded expectation (honest run).
  return { ...meta, serverVersionNum: PG16, actualRuntimeQueryDigest: meta.expectedRuntimeQueryDigest, effects };
}

describe("PACKET handshake — self-authenticating (all components verified)", () => {
  const meta = packetMeta();
  it("exact packet accepted", () => expect(() => assertPacketHandshake(meta, liveOf(meta))).not.toThrow());
  it("packetId tampered → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, packetId: "z".repeat(64) }))).toThrow(/packetId/));
  it("expectedManifestDigest tampered → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, expectedManifestDigest: "z".repeat(64) }))).toThrow(/expectedManifestDigest/));
  it("provenanceDigest tampered → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, provenanceDigest: "z".repeat(64) }))).toThrow(/provenanceDigest/));
  it("securityStatementMapDigest tampered → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, securityStatementMapDigest: "z".repeat(64) }))).toThrow(/securityStatementMapDigest/));
  it("migration checksum tampered → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, migrationChecksums: { "20260726000000": "z".repeat(64) } }))).toThrow(/migrationChecksums/));
  it("query body digest tampered → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, auditQueryBodyDigest: "z".repeat(64) }))).toThrow(/auditQueryBodyDigest/));
  it("comparator contract version changed → rejected", () => expect(() => assertPacketHandshake({ ...meta, comparatorContractVersion: "r9.9" }, liveOf(meta))).toThrow(/comparator contract/));
  it("packet version changed → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, auditPacketVersion: "r2.3" }))).toThrow(/auditPacketVersion/));
  it("missing migration checksum → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, migrationChecksums: {} }))).toThrow(/migrationChecksums/));
  it("extra replacement checksum → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, migrationChecksums: { ...meta.migrationChecksums, "99999999999999": "z".repeat(64) } }))).toThrow(/migrationChecksums/));
  it("missing metadata field → rejected", () => {
    const bad = { ...liveOf(meta) } as Record<string, unknown>; delete bad.provenanceDigest;
    expect(() => assertPacketHandshake(meta, bad as unknown as LiveAudit & PacketMeta)).toThrow(/provenanceDigest/);
  });
  it("stale query with the same human version string but wrong digest → rejected", () =>
    expect(() => assertPacketHandshake(meta, liveOf({ ...meta, auditQueryBodyDigest: "0".repeat(64) }))).toThrow(/auditQueryBodyDigest/));
  it("duplicate effect → rejected", () => expect(() => assertPacketHandshake(meta, liveOf(meta, [{ effectId: "a" }, { effectId: "a" }]))).toThrow(/duplicate/));
  it("truncated (no effects array) → rejected", () => expect(() => assertPacketHandshake(meta, { ...meta, serverVersionNum: PG16 } as unknown as LiveAudit & PacketMeta)).toThrow(/effects array/));
  it("constraintStatementMapDigest tampered → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, constraintStatementMapDigest: "z".repeat(64) }))).toThrow(/constraintStatementMapDigest/));
  it("runtimeQueryContractVersion changed → rejected", () => expect(() => assertPacketHandshake(meta, liveOf({ ...meta, runtimeQueryContractVersion: "r9" }))).toThrow(/runtimeQueryContractVersion/));

  // Gate 1 — the ACTUAL executed statement must match the embedded contract.
  it("EXECUTED QUERY DIGEST MISMATCH when the statement that ran differs (constants retained)", () => {
    const live = { ...liveOf(meta), actualRuntimeQueryDigest: "9".repeat(64) }; // modified body, stale constants
    expect(() => assertPacketHandshake(meta, live)).toThrow(/EXECUTED QUERY DIGEST MISMATCH/);
  });
  it("missing actualRuntimeQueryDigest → rejected", () => {
    const live = { ...liveOf(meta) } as Record<string, unknown>; delete live.actualRuntimeQueryDigest;
    expect(() => assertPacketHandshake(meta, live as unknown as LiveAudit & PacketMeta)).toThrow(/actualRuntimeQueryDigest/);
  });

  // Gate 9 (R2.6) — a live result exported under the PREVIOUS (r2.5, PostgreSQL-16) packet is not
  // evidence against the new packet. It must be rejected outright, never silently re-compared.
  it.each(["r2.5", "r2.6"])("a %s live result is REJECTED by the r2.7 packet (no cross-packet comparison)", (v) => {
    const stale = { ...liveOf(meta), auditSchemaVersion: v, auditPacketVersion: v, runtimeQueryContractVersion: v };
    expect(() => assertPacketHandshake(meta, stale)).toThrow(/auditSchemaVersion/);
  });
  it("an older comparator contract cannot validate an r2.7 binary", () => {
    expect(() => assertPacketHandshake({ ...meta, comparatorContractVersion: "r2.6" }, liveOf(meta))).toThrow(/comparator contract/);
  });
  // R2.8 — the reconciliation migration is part of packet identity.
  it("a changed RECONCILIATION migration checksum is rejected", () => {
    const m2 = packetMeta({ migrationChecksums: { ...meta.migrationChecksums, "20260804000000": "b".repeat(64) } });
    expect(() => assertPacketHandshake(meta, liveOf(m2))).toThrow(/migrationChecksums/);
  });
  it("a result carrying only ONE reconciled body (stale manifest digest) is rejected", () => {
    expect(() => assertPacketHandshake(meta, liveOf({ ...meta, expectedManifestDigest: "e".repeat(64) }))).toThrow(/expectedManifestDigest/);
  });
  it("a changed runtime query is rejected", () => {
    expect(() => assertPacketHandshake(meta, liveOf({ ...meta, expectedRuntimeQueryDigest: "f".repeat(64) }))).toThrow(/expectedRuntimeQueryDigest/);
  });
});

describe("CONSTRAINT effects — first-class comparison (Gate 10)", () => {
  const PK = eff({ effectId: "pk:t.t_pkey", objectType: "pk", comparisonMode: "structured+digest",
    properties: { contype: "p", table: "t", keys: ["id"], deferrable: false, initiallyDeferred: false, validated: true }, definitionDigest: "d1" });
  const liveEff = (effectId: string, properties: unknown, definitionDigest?: string) => ({ effectId, properties, definitionDigest });
  it("PK exact", () => expect(status(PK, liveEff(PK.effectId, PK.properties, "d1"))).toBe("EXACT_MATCH"));
  it("PK reversed column order → conflict", () => expect(status(PK, liveEff(PK.effectId, { ...(PK.properties as object), keys: ["a", "id"] }, "d1"))).toBe("CONFLICT"));
  it("PK wrong deferrability → conflict", () => expect(status(PK, liveEff(PK.effectId, { ...(PK.properties as object), deferrable: true }, "d1"))).toBe("CONFLICT"));
  it("PK wrong validation → conflict", () => expect(status(PK, liveEff(PK.effectId, { ...(PK.properties as object), validated: false }, "d1"))).toBe("CONFLICT"));
  it("PK missing → conflict (MISSING_OBJECT)", () => expect(compareMigrationAudit(manifest([PK]), live([])).effects[0].status).toBe("MISSING_OBJECT"));

  const FK = eff({ effectId: "fk:t.t_fk", objectType: "fk", comparisonMode: "structured+digest",
    properties: { contype: "f", table: "t", sourceColumns: ["a"], refTable: "r", refColumns: ["id"], onUpdate: "a", onDelete: "n", matchType: "s", deferrable: false, initiallyDeferred: false, validated: true }, definitionDigest: "d2" });
  const fkBad = (o: Record<string, unknown>) => status(FK, liveEff(FK.effectId, { ...(FK.properties as object), ...o }, "d2"));
  it("FK exact", () => expect(status(FK, liveEff(FK.effectId, FK.properties, "d2"))).toBe("EXACT_MATCH"));
  it("FK wrong source column → conflict", () => expect(fkBad({ sourceColumns: ["b"] })).toBe("CONFLICT"));
  it("FK wrong referenced table → conflict", () => expect(fkBad({ refTable: "other" })).toBe("CONFLICT"));
  it("FK wrong referenced column → conflict", () => expect(fkBad({ refColumns: ["other"] })).toBe("CONFLICT"));
  it("FK wrong ON DELETE → conflict", () => expect(fkBad({ onDelete: "c" })).toBe("CONFLICT"));
  it("FK wrong ON UPDATE → conflict", () => expect(fkBad({ onUpdate: "c" })).toBe("CONFLICT"));
  it("FK wrong match type → conflict", () => expect(fkBad({ matchType: "f" })).toBe("CONFLICT"));
  it("FK wrong deferrability → conflict", () => expect(fkBad({ deferrable: true })).toBe("CONFLICT"));
  it("FK wrong initially-deferred → conflict", () => expect(fkBad({ initiallyDeferred: true })).toBe("CONFLICT"));
  it("FK wrong validation → conflict", () => expect(fkBad({ validated: false })).toBe("CONFLICT"));

  const UQ = eff({ effectId: "unique:t.t_key", objectType: "unique", comparisonMode: "structured+digest",
    properties: { contype: "u", table: "t", keys: ["a", "b"], nullsNotDistinct: false, deferrable: false, validated: true }, definitionDigest: "d3" });
  it("UNIQUE wrong key order → conflict", () => expect(status(UQ, liveEff(UQ.effectId, { ...(UQ.properties as object), keys: ["b", "a"] }, "d3"))).toBe("CONFLICT"));
  it("UNIQUE wrong validation → conflict", () => expect(status(UQ, liveEff(UQ.effectId, { ...(UQ.properties as object), validated: false }, "d3"))).toBe("CONFLICT"));

  const CK = eff({ effectId: "check:t.t_chk", objectType: "check", comparisonMode: "structured+body_digest",
    properties: { contype: "c", table: "t", validated: true, noInherit: false }, definitionDigest: "ck1" });
  it("CHECK exact", () => expect(status(CK, liveEff(CK.effectId, CK.properties, "ck1"))).toBe("EXACT_MATCH"));
  it("CHECK wrong expression (digest) → conflict", () => expect(status(CK, liveEff(CK.effectId, CK.properties, "ck2"))).toBe("CONFLICT"));
  it("CHECK wrong validation → conflict", () => expect(status(CK, liveEff(CK.effectId, { ...(CK.properties as object), validated: false }, "ck1"))).toBe("CONFLICT"));
});

describe("MANIFEST integrity", () => {
  const m = manifest([eff({ effectId: "a" }), eff({ effectId: "b" })]);
  it("valid manifest passes integrity", () => expect(() => assertManifestIntegrity(m)).not.toThrow());
  it("wrong manifest digest rejected (hand-edited manifest)", () =>
    expect(() => assertManifestIntegrity({ ...m, expectedManifestDigest: "deadbeef" })).toThrow(/digest mismatch/));
  it("effects digest is stable", () => expect(computeEffectsDigest(m.effects)).toBe(m.expectedManifestDigest));
});

describe("INGEST (JSON / CSV / malformed)", () => {
  const payload = { auditSchemaVersion: "r2.3", serverVersionNum: PG16, effects: [{ effectId: "a", properties: {} }] };
  it("accepts raw JSON", () => expect(parseLiveAudit(JSON.stringify(payload)).effects.length).toBe(1));
  it("accepts a { audit: {...} } wrapper", () => expect(parseLiveAudit(JSON.stringify({ audit: payload })).serverVersionNum).toBe(PG16));
  it("accepts the SQL Editor CSV export (one quoted JSON cell)", () => {
    const csv = 'audit\n"' + JSON.stringify(payload).replace(/"/g, '""') + '"';
    expect(parseLiveAudit(csv).effects.length).toBe(1);
  });
  it("accepts an escaped multiline function body inside the JSON", () => {
    const withBody = { ...payload, effects: [{ effectId: "function:public.f()", properties: { body: "line1\nline2\n  indented" } }] };
    expect(parseLiveAudit(JSON.stringify(withBody)).effects[0].effectId).toContain("function");
  });
  it("rejects an HTML/error page", () => expect(() => parseLiveAudit("<html>error</html>")).toThrow(/HTML/));
  it("rejects malformed/truncated JSON", () => expect(() => parseLiveAudit('{"effects":[{')).toThrow(/malformed|truncated/));
  it("rejects a CSV with multiple ambiguous payload rows", () => {
    const csv = 'audit\n"{}"\n"{}"';
    expect(() => parseLiveAudit(csv)).toThrow(/data rows/);
  });
  it("rejects empty input", () => expect(() => parseLiveAudit("   ")).toThrow(/empty/));
});
