import { describe, it, expect } from "vitest";
import {
  compareMigrationAudit, parseLiveAudit, assertPacketHandshake, assertManifestIntegrity,
  computeEffectsDigest, AuditPacketError,
  type ExpectedEffect, type ExpectedManifest, type LiveAudit,
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

describe("PACKET handshake + integrity", () => {
  const m = manifest([eff({ effectId: "a" }), eff({ effectId: "b" })]);
  it("old audit version rejected", () => {
    expect(() => assertPacketHandshake(m, { auditSchemaVersion: "r2.2", serverVersionNum: PG16, effects: [{ effectId: "a" }, { effectId: "b" }] })).toThrow(AuditPacketError);
  });
  it("wrong manifest digest rejected (hand-edited manifest)", () => {
    expect(() => assertManifestIntegrity({ ...m, expectedManifestDigest: "deadbeef" })).toThrow(/digest mismatch/);
  });
  it("valid manifest passes integrity", () => expect(() => assertManifestIntegrity(m)).not.toThrow());
  it("missing metadata rejected", () => {
    expect(() => assertPacketHandshake(m, { serverVersionNum: PG16, effects: [] } as unknown as LiveAudit)).toThrow(/auditSchemaVersion/);
  });
  it("duplicate effectId rejected", () => {
    expect(() => assertPacketHandshake(m, { auditSchemaVersion: "r2.3", serverVersionNum: PG16, effects: [{ effectId: "a" }, { effectId: "a" }] })).toThrow(/duplicate/);
  });
  it("unknown effectId rejected", () => {
    expect(() => assertPacketHandshake(m, { auditSchemaVersion: "r2.3", serverVersionNum: PG16, effects: [{ effectId: "a" }, { effectId: "b" }, { effectId: "zzz" }] })).toThrow(/unknown/);
  });
  it("truncated result rejected", () => {
    expect(() => assertPacketHandshake(m, { auditSchemaVersion: "r2.3", serverVersionNum: PG16, effects: [] })).toThrow(/truncated/);
  });
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
