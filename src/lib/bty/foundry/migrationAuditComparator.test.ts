import { describe, it, expect } from "vitest";
import { compareMigrationAudit, type ExpectedEffect, type ExpectedManifest, type LiveAudit } from "./migrationAuditComparator";

/**
 * Comparator fixture matrix (Slice 3.2I-R5B1A.1-R2.2, Part 8). Proves the offline comparator's
 * per-effect status + per-migration verdict logic. No DB — pure fixtures. Migration-wide success
 * NEVER derives from object-name existence: every material effect must match.
 */

const PG16 = 160014;
function exp(over: Partial<ExpectedEffect>): ExpectedEffect {
  return {
    effectId: "column:public.t.c", objectType: "column", objectIdentity: "public.t.c",
    properties: { data_type: "text", is_nullable: "YES", column_default: null },
    definitionDigest: null, comparisonMode: "structured", autoComparable: true, manualReason: null,
    migrationVersion: "20260728000000", finalAuthorityMigration: "20260728000000", ...over,
  };
}
function manifest(effects: ExpectedEffect[], pg = PG16): ExpectedManifest {
  return { postgresServerVersionNum: pg, effects };
}
function live(effects: LiveAudit["effects"], pg = PG16): LiveAudit {
  return { serverVersionNum: pg, effects };
}

describe("migration audit comparator — effect-by-effect + migration verdicts", () => {
  it("1. exact match → candidate A", () => {
    const e = exp({});
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: e.properties }]));
    expect(r.effects[0].status).toBe("EXACT_MATCH");
    expect(r.migrations[0].verdict).toBe("A");
    expect(r.migrations[0].repairEligible).toBe(true);
  });

  it("2. missing table → D", () => {
    const e = exp({ effectId: "table:public.foundry_x", objectType: "table" });
    const r = compareMigrationAudit(manifest([e]), live([])); // object absent live
    expect(r.effects[0].status).toBe("MISSING_OBJECT");
    expect(r.migrations[0].verdict).toBe("D");
  });

  it("3. column wrong type → D", () => {
    const e = exp({});
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { data_type: "integer", is_nullable: "YES", column_default: null } }]));
    expect(r.effects[0].status).toBe("CONFLICT");
    expect(r.migrations[0].verdict).toBe("D");
  });

  it("4. wrong nullability → D", () => {
    const e = exp({});
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { data_type: "text", is_nullable: "NO", column_default: null } }]));
    expect(r.effects[0].status).toBe("CONFLICT");
  });

  it("5. wrong default → D", () => {
    const e = exp({});
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { data_type: "text", is_nullable: "YES", column_default: "'x'::text" } }]));
    expect(r.effects[0].status).toBe("CONFLICT");
  });

  it("6. function body differs (props same, digest differ) → D", () => {
    const e = exp({ effectId: "function:public.f()", objectType: "function", comparisonMode: "structured+body_digest",
      properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"] }, definitionDigest: "aaa" });
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: e.properties, definitionDigest: "bbb" }]));
    expect(r.effects[0].status).toBe("CONFLICT");
    expect(r.migrations[0].verdict).toBe("D");
  });

  it("7. SECURITY DEFINER differs → D", () => {
    const e = exp({ effectId: "function:public.f()", objectType: "function", comparisonMode: "structured+body_digest",
      properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"] }, definitionDigest: "aaa" });
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { security_definer: false, proconfig: ["search_path=pg_catalog, public"] }, definitionDigest: "aaa" }]));
    expect(r.effects[0].status).toBe("CONFLICT"); // structured props differ before digest
  });

  it("8. search_path (proconfig) differs → D", () => {
    const e = exp({ effectId: "function:public.f()", objectType: "function", comparisonMode: "structured+body_digest",
      properties: { security_definer: true, proconfig: ["search_path=pg_catalog, public"] }, definitionDigest: "aaa" });
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { security_definer: true, proconfig: ["search_path=public"] }, definitionDigest: "aaa" }]));
    expect(r.effects[0].status).toBe("CONFLICT");
  });

  it("9. index key order differs → D", () => {
    const e = exp({ effectId: "index:public.i", objectType: "index", comparisonMode: "structured+digest",
      properties: { is_unique: true, keys: "a,b", predicate: null }, definitionDigest: "aaa" });
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { is_unique: true, keys: "b,a", predicate: null }, definitionDigest: "aaa" }]));
    expect(r.effects[0].status).toBe("CONFLICT");
  });

  it("10. index predicate differs → D", () => {
    const e = exp({ effectId: "index:public.i", objectType: "index", comparisonMode: "structured+digest",
      properties: { is_unique: true, keys: "a", predicate: "(x IS NOT NULL)" }, definitionDigest: "aaa" });
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { is_unique: true, keys: "a", predicate: "(y IS NOT NULL)" }, definitionDigest: "aaa" }]));
    expect(r.effects[0].status).toBe("CONFLICT");
  });

  it("11. RLS differs → D", () => {
    const e = exp({ effectId: "rls:public.t", objectType: "rls", properties: { rls_enabled: true, policy_count: 0 } });
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { rls_enabled: false, policy_count: 0 } }]));
    expect(r.effects[0].status).toBe("CONFLICT");
  });

  it("12. evidence row missing → E", () => {
    const e = exp({});
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, evidenceStatus: "MISSING" }]));
    expect(r.effects[0].status).toBe("EVIDENCE_ABSENT");
    expect(r.migrations[0].verdict).toBe("E");
  });

  it("13. PostgreSQL-version-dependent digest unresolved → E", () => {
    const e = exp({ effectId: "function:public.f()", objectType: "function", comparisonMode: "structured+body_digest",
      properties: { security_definer: true }, definitionDigest: "aaa" });
    // Live is PG15; digest formatting may differ across majors → MANUAL → migration E.
    const r = compareMigrationAudit(manifest([e], PG16), live([{ effectId: e.effectId, properties: { security_definer: true }, definitionDigest: "zzz" }], 150010));
    expect(r.effects[0].status).toBe("MANUAL");
    expect(r.migrations[0].verdict).toBe("E");
    expect(r.postgresMajorMatch).toBe(false);
  });

  it("14. 20260728 matches but 20260729 body differs → 728=A, 729=D (provenance-grouped)", () => {
    const e28 = exp({ effectId: "table:public.foundry_participant_followups", objectType: "table",
      properties: ["id", "status"], migrationVersion: "20260728000000", finalAuthorityMigration: "20260728000000" });
    const e29 = exp({ effectId: "function:public.bty_foundry_submit_followup(uuid,uuid,text)", objectType: "function",
      comparisonMode: "structured+body_digest", properties: { security_definer: true }, definitionDigest: "fixed",
      migrationVersion: "20260728000000", finalAuthorityMigration: "20260729000000" });
    const r = compareMigrationAudit(manifest([e28, e29]), live([
      { effectId: e28.effectId, properties: ["id", "status"] },
      { effectId: e29.effectId, properties: { security_definer: true }, definitionDigest: "OLD_BUGGY" },
    ]));
    const m28 = r.migrations.find((m) => m.migration === "20260728000000")!;
    const m29 = r.migrations.find((m) => m.migration === "20260729000000")!;
    expect(m28.verdict).toBe("A"); // 728 follows the provenance graph (submit excluded — its authority is 729)
    expect(m29.verdict).toBe("D"); // 729 not repair-eligible
    expect(m29.repairEligible).toBe(false);
  });

  it("15. one migration all-exact (A) while another remains E → only the exact one is a candidate", () => {
    const eA = exp({ effectId: "column:public.a.c", finalAuthorityMigration: "20260727000000",
      properties: { data_type: "boolean", is_nullable: "NO", column_default: "false" } });
    const eE = exp({ effectId: "column:public.b.c", finalAuthorityMigration: "20260726000000" });
    const r = compareMigrationAudit(manifest([eA, eE]), live([
      { effectId: eA.effectId, properties: eA.properties },
      { effectId: eE.effectId, evidenceStatus: "MISSING" },
    ]));
    const mA = r.migrations.find((m) => m.migration === "20260727000000")!;
    const mE = r.migrations.find((m) => m.migration === "20260726000000")!;
    expect(mA.verdict).toBe("A");
    expect(mA.repairEligible).toBe(true);
    expect(mE.verdict).toBe("E");
    expect(mE.repairEligible).toBe(false);
  });

  it("never emits B or C (catalog diff cannot justify them)", () => {
    const e = exp({});
    const r = compareMigrationAudit(manifest([e]), live([{ effectId: e.effectId, properties: { data_type: "integer", is_nullable: "YES", column_default: null } }]));
    for (const m of r.migrations) expect(["A", "D", "E"]).toContain(m.verdict);
  });
});
