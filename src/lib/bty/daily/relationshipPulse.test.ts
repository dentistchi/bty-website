import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasAnyEvidenceInWindow,
  projectRelationshipPulse,
  EVIDENCE_SOURCES,
} from "./relationshipPulse";

/**
 * Count stub: fixed row count per table via head+count. Optionally records which tables
 * were queried (to assert le_verification_log is never touched).
 */
function sbCounts(
  countsByTable: Record<string, number>,
  queried?: string[],
): SupabaseClient {
  return {
    from(table: string) {
      queried?.push(table);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        lt: () => builder,
        then: (resolve: (r: { count: number; error: null }) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve({ count: countsByTable[table] ?? 0, error: null }).then(resolve, reject),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

/** Error stub: every source query returns an error (exercises fail-quiet). */
function sbError(): SupabaseClient {
  return {
    from() {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        lt: () => builder,
        then: (resolve: (r: { count: null; error: { message: string } }) => unknown) =>
          Promise.resolve({ count: null, error: { message: "boom" } }).then(resolve),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const SINCE = "2026-06-18T00:00:00.000Z";

describe("hasAnyEvidenceInWindow — 3-domain (Scope Lock §3, Flag 1 = b)", () => {
  it("self-only evidence (center_letters) → true", async () => {
    expect(await hasAnyEvidenceInWindow(sbCounts({ center_letters: 1 }), "u1", SINCE)).toBe(true);
  });

  it("others-only evidence (arena_runs) → true", async () => {
    expect(await hasAnyEvidenceInWindow(sbCounts({ arena_runs: 1 }), "u1", SINCE)).toBe(true);
  });

  it("ground-only evidence (dojo_submissions) → true", async () => {
    expect(await hasAnyEvidenceInWindow(sbCounts({ dojo_submissions: 1 }), "u1", SINCE)).toBe(true);
  });

  it("no evidence in any domain → false", async () => {
    expect(await hasAnyEvidenceInWindow(sbCounts({}), "u1", SINCE)).toBe(false);
  });
});

describe("relationship pulse — forward-only dedupe & le_verification_log exclusion (§7)", () => {
  it("le_verification_log is never queried by the pulse projection", async () => {
    const queried: string[] = [];
    await projectRelationshipPulse(sbCounts({}, queried), "u1");
    expect(queried).not.toContain("le_verification_log");
    expect(EVIDENCE_SOURCES.map((s) => s.table)).not.toContain("le_verification_log");
  });

  it("le_verification_log is never queried by the evidence helper", async () => {
    const queried: string[] = [];
    await hasAnyEvidenceInWindow(sbCounts({}, queried), "u1", SINCE);
    expect(queried).not.toContain("le_verification_log");
  });

  it("a single action contract counts once (others → living), no double-count", async () => {
    const pulse = await projectRelationshipPulse(sbCounts({ bty_action_contracts: 1 }), "u1");
    expect(pulse.domains.others.band).toBe("living"); // count 1 → living, not inflated
    expect(pulse.hasAnyEvidence).toBe(true);
  });

  it("forbidden dangling names are absent from the source set (§8)", () => {
    const tables = EVIDENCE_SOURCES.map((s) => s.table);
    for (const dangling of ["center_recovery", "artifacts", "train", "training_sessions", "training_progress"]) {
      expect(tables).not.toContain(dangling);
    }
  });
});

describe("relationship pulse — no raw score/count/label exposure (§6, §10)", () => {
  it("payload exposes only band / copyKey / hasAnyEvidence / overall", async () => {
    const pulse = await projectRelationshipPulse(sbCounts({ center_letters: 9, arena_runs: 3 }), "u1");

    expect(Object.keys(pulse).sort()).toEqual(["domains", "hasAnyEvidence", "overall"]);
    for (const domain of ["self", "others", "ground"] as const) {
      expect(Object.keys(pulse.domains[domain]).sort()).toEqual(["band", "copyKey"]);
      expect(typeof pulse.domains[domain].band).toBe("string");
      expect(pulse.domains[domain].copyKey).toMatch(/^today\.pulse\.(self|others|ground)\.(quiet|living|connected|deepening)$/);
    }

    // No raw count / score / internal pattern label may appear anywhere in the payload.
    const serialized = JSON.stringify(pulse);
    expect(serialized).not.toMatch(/count/i);
    expect(serialized).not.toMatch(/score/i);
    expect(serialized).not.toMatch(/pattern_family/i);
    // The raw counts (9, 3) must not leak as numbers.
    expect(serialized).not.toMatch(/\b9\b/);
    expect(serialized).not.toMatch(/\b3\b/);
  });

  it("empty domains yield quiet + neutral copyKey (No Data → No Interpretation)", async () => {
    const pulse = await projectRelationshipPulse(sbCounts({}), "u1");
    expect(pulse.overall).toBe("quiet");
    expect(pulse.hasAnyEvidence).toBe(false);
    expect(pulse.domains.self.band).toBe("quiet");
    expect(pulse.domains.others.band).toBe("quiet");
    expect(pulse.domains.ground.band).toBe("quiet");
  });
});

describe("relationship pulse — fail-quiet", () => {
  it("degrades to an all-quiet pulse when every source errors (no throw)", async () => {
    const pulse = await projectRelationshipPulse(sbError(), "u1");
    expect(pulse.overall).toBe("quiet");
    expect(pulse.hasAnyEvidence).toBe(false);
  });
});
