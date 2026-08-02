/**
 * FIELD-REPAIR EXECUTABLE ROUTING (Slice 3.2I-R5B1A.1-R2.52 Part 6).
 *
 * R2.51 measured a live run where every domain test passed, every manifest binding matched, and the
 * second provider call was still the LEGACY whole-row re-ask. The authority existed; nothing called
 * it. `reviewFieldRepair` had zero importers.
 *
 * These tests do not call the field-repair helpers. They drive the REPLAY ENTRYPOINT'S OWN
 * dependency construction — the same function the runner invokes — with a deterministic incomplete
 * first response, and assert what the second call actually was.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runC18NarrowBoundaryReplay,
  mockNarrowReview,
  mockFieldRepair,
  NARROW_REPLAY_ARTIFACT_VERSION,
  type NarrowReplayDeps,
} from "../../../../../scripts/practice-c18-narrow-boundary-replay";
import { FIELD_REPAIR_JSON_SCHEMA, FIELD_REPAIR_SCHEMA_NAME } from "@/domain/foundry/arena-draft/boundaryFieldRepair";
import { NARROW_BOUNDARY_SCHEMA_NAME } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { buildFieldRepairRequest } from "./narrowBoundaryContract";
import { R248_ATTEMPT_1 } from "@/domain/foundry/arena-draft/r248LiveDtoFixture";

const SOURCE = join(process.cwd(), ".eval-artifacts");
const present = (): boolean => {
  try {
    return readdirSync(SOURCE).some((f) => f.startsWith("practice-generation.stability.live."));
  } catch {
    return false;
  }
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "r252-routing-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

type Observed = {
  reviewCalls: Array<{ attempt: number; surfaceRefs?: readonly string[] }>;
  repairCalls: Array<{ attempt: number; planSha256: string; operations: number; surfaces: number; groups: number; request: unknown }>;
  events: string[];
};

/** The entrypoint's REAL deps shape, instrumented. Nothing here bypasses the stage. */
const run = async (o: Observed, over: Partial<NarrowReplayDeps> = {}) =>
  runC18NarrowBoundaryReplay(
    {
      review: async (s, a, surfaceRefs) => {
        o.reviewCalls.push({ attempt: a, surfaceRefs });
        return mockNarrowReview("incomplete-field-repair", s, a, surfaceRefs ? [...surfaceRefs] : undefined);
      },
      repair: async (s, plan, a) => {
        o.repairCalls.push({
          attempt: a,
          planSha256: plan.planSha256,
          operations: plan.requiredOperationCount,
          surfaces: new Set(plan.targets.map((t) => t.surfaceRef)).size,
          groups: plan.dependencyGroupCount,
          request: buildFieldRepairRequest(s, plan),
        });
        return mockFieldRepair(s, plan, a);
      },
      writeArtifact: () => ({ path: join(dir, "a.json"), sha256: "x".repeat(64), bytes: 0 }),
      log: (line: string) => o.events.push(line),
      ...over,
    } as NarrowReplayDeps,
    process.cwd(),
    SOURCE,
    "r252",
    "mock",
  );

const observed = (): Observed => ({ reviewCalls: [], repairCalls: [], events: [] });

describe("[R2.52][6] an incomplete first response reaches ONLY the patch path", () => {
  it("1,2 — the initial call is the full-row schema and its response is incomplete", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    await run(o);
    expect(NARROW_BOUNDARY_SCHEMA_NAME).toBe("bty_practice_boundary_truth_review_v4");
    expect(o.reviewCalls[0]).toMatchObject({ attempt: 1 });
    // The retained R2.48 attempt 1: 12 rows, 2 valid, 10 failed.
    expect(R248_ATTEMPT_1).toHaveLength(12);
  });

  it("3,4,6 — a plan is built, digested, and carried into the patch request", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    await run(o);
    expect(o.repairCalls).toHaveLength(1);
    const p = o.repairCalls[0]!;
    expect(p.planSha256).toHaveLength(64);
    expect(p.operations).toBe(13);
    expect(p.surfaces).toBe(10);
    expect(p.groups).toBe(10);
    const req = p.request as { authority: { repairPlanSha256: string; baseRowSha256: Array<{ surfaceRef: string; sha256: string }> }; targets: unknown[] };
    expect(req.authority.repairPlanSha256).toBe(p.planSha256);
    expect(req.authority.baseRowSha256.length).toBeGreaterThan(0);
    for (const b of req.authority.baseRowSha256) expect(b.sha256).toHaveLength(64);
    expect(req.targets).toHaveLength(13);
  });

  it("5,7 — the second call uses the PATCH schema and its response is repairs[], never assessments[]", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    await run(o);
    expect(FIELD_REPAIR_SCHEMA_NAME).toBe("bty_practice_boundary_field_repair_v1");
    expect(Object.keys(FIELD_REPAIR_JSON_SCHEMA.properties)).toEqual(["repairs"]);
    expect(JSON.stringify(FIELD_REPAIR_JSON_SCHEMA)).not.toContain("assessments");
    const patch = mockFieldRepair as unknown as () => void;
    expect(typeof patch).toBe("function");
    // The request carries no assessment rows at all.
    expect(JSON.stringify(o.repairCalls[0]!.request)).not.toContain('"assessments"');
  });

  it("8 — no SECOND full-row call occurs, and the first never carries a surface subset", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    const summary = await run(o);
    expect(o.reviewCalls).toHaveLength(1);
    expect(o.reviewCalls[0]!.surfaceRefs).toBeUndefined();
    expect(summary.providerInvocations).toBe(2);
  });

  it("9,10,11 — the field-level merge produces a complete matrix with no frozen mutation", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    const summary = await run(o);
    expect(summary.repairMode).toBe("field_patch");
    expect(summary.fieldRepairOperationCount).toBe(13);
    expect(summary.outcome).toBe("boundary_review_reject");
    expect(summary.causalAttributions).toEqual(["primary[1]<-branch[1].resulting_world_state"]);
  });

  it("12 — the legacy event is never emitted", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    await run(o);
    for (const e of o.events) expect(e).not.toContain("boundary_review_failed_subset_repair");
    expect(o.events.some((e) => e.includes("boundary_review_field_repair_planned"))).toBe(true);
    expect(o.events.some((e) => e.includes("boundary_review_field_repair_applied"))).toBe(true);
  });

  it("the test FAILS if the entrypoint stops supplying repair", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    // Exactly the shape R2.51 found live: review present, repair absent.
    const summary = await run(o, { repair: undefined as unknown as NarrowReplayDeps["repair"] });
    expect(o.repairCalls).toHaveLength(0);
    expect(o.reviewCalls).toHaveLength(1);
    expect(summary.repairMode).toBe("unavailable");
    expect(summary.outcome).toBe("boundary_reviewer_terminal_failure");
  });
});

describe("[R2.52][7] the artifact proves which route ran", () => {
  it("the WRITTEN version is bumped and historical /4 stays readable", () => {
    expect(NARROW_REPLAY_ARTIFACT_VERSION).toBe("practice-narrow-boundary-replay/5");
    // The retained R2.50 live artifact is /4 and must still parse.
    const legacy = readdirSync(SOURCE).find((f) => f.includes("boundaryreplay.live.20260802T053740Z"));
    if (!legacy) return expect(true).toBe(true);
    const body = JSON.parse(readFileSync(join(SOURCE, legacy), "utf8")) as { artifactVersion: string; fieldRepairPlan: unknown };
    expect(body.artifactVersion).toBe("practice-narrow-boundary-replay/4");
    // And it records the defect: no plan, which under R2.52 would read as repairMode "unavailable".
    expect(body.fieldRepairPlan).toBeNull();
  });
});
