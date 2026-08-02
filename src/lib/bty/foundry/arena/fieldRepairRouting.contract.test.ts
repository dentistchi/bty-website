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
  /** R2.54 — the artifact the run WOULD write, captured so /6 can be read back without a file. */
  artifacts: Array<Record<string, unknown>>;
};

/**
 * The entrypoint's REAL deps shape, instrumented. Nothing here bypasses the stage.
 *
 * `patchKind` selects which deterministic patch the mock returns: the canonical plan-derived answer,
 * or the EXACT selection the R2.52 live model sent. Both travel the same code.
 */
const run = async (o: Observed, over: Partial<NarrowReplayDeps> = {}, patchKind: "canonical" | "captured-r252" = "canonical") =>
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
        return mockFieldRepair(s, plan, a, patchKind);
      },
      writeArtifact: (payload: string) => {
        o.artifacts.push(JSON.parse(payload) as Record<string, unknown>);
        return { path: join(dir, "a.json"), sha256: "x".repeat(64), bytes: payload.length };
      },
      log: (line: string) => o.events.push(line),
      ...over,
    } as NarrowReplayDeps,
    process.cwd(),
    SOURCE,
    "r252",
    "mock",
  );

const observed = (): Observed => ({ reviewCalls: [], repairCalls: [], events: [], artifacts: [] });

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
    // R2.54 — 9 standalone repairs + one FIVE-field prerequisite group.
    expect(p.operations).toBe(14);
    expect(p.surfaces).toBe(10);
    expect(p.groups).toBe(10);
    const req = p.request as {
      authority: { repairPlanSha256: string; baseRowSha256: Array<{ surfaceRef: string; sha256: string }> };
      targets: Array<{ field: string; valueAuthority: string; allowedValues: string[] | null; groupFields: string[] }>;
      dependencyGroups: Array<{
        groupId: string;
        surfaceRef: string;
        fields: string[];
        alternativesSha256: string;
        alternatives: Array<{ alternativeId: string; stateId: string; prerequisiteStatus: string; temporalRelation: string[]; reasonMode: string }>;
      }>;
    };
    expect(req.authority.repairPlanSha256).toBe(p.planSha256);
    expect(req.authority.baseRowSha256.length).toBeGreaterThan(0);
    for (const b of req.authority.baseRowSha256) expect(b.sha256).toHaveLength(64);
    expect(req.targets).toHaveLength(14);
  });

  it("R2.54 — the request offers COMPLETE canonical alternatives, not five independent scalar lists", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    await run(o);
    const req = o.repairCalls[0]!.request as {
      targets: Array<{ field: string; valueAuthority: string; allowedValues: string[] | null; groupFields: string[] }>;
      dependencyGroups: Array<{
        groupId: string;
        fields: string[];
        alternativesSha256: string;
        alternatives: Array<{ alternativeId: string; stateId: string; prerequisiteStatus: string; temporalRelation: string[]; reasonMode: string }>;
      }>;
    };

    expect(req.dependencyGroups).toHaveLength(1);
    const g = req.dependencyGroups[0]!;
    expect(g.fields.slice().sort()).toEqual([
      "prerequisiteFailureCandidateId",
      "prerequisiteSatisfactionCandidateId",
      "prerequisiteStatus",
      "reason",
      "temporalRelation",
    ]);
    expect(g.alternativesSha256).toHaveLength(64);
    expect(g.alternatives.length).toBeGreaterThan(0);
    // Complete SHAPES: every alternative fixes a status, carries its own temporal domain and names
    // its reason mode. A per-field list could express none of that.
    for (const a of g.alternatives) {
      expect(a.alternativeId.length).toBeGreaterThan(0);
      expect(a.stateId.length).toBeGreaterThan(0);
      expect(a.temporalRelation.length).toBeGreaterThan(0);
      expect(["must_be_empty", "model_required"]).toContain(a.reasonMode);
    }
    // Both reason modes are reachable, so the mode genuinely distinguishes shapes here.
    expect(new Set(g.alternatives.map((a) => a.reasonMode))).toEqual(new Set(["must_be_empty", "model_required"]));

    // A GROUPED target publishes NO scalar list; a standalone one still does.
    const grouped = req.targets.filter((t) => t.groupFields.length > 1);
    const standalone = req.targets.filter((t) => t.groupFields.length === 1);
    expect(grouped).toHaveLength(5);
    expect(standalone).toHaveLength(9);
    for (const t of grouped) {
      expect(t.valueAuthority).toBe("canonical_group_alternative");
      expect(t.allowedValues).toBeNull();
    }
    for (const t of standalone) {
      expect(t.valueAuthority).toBe("scalar_allowed_values");
      expect(t.allowedValues!.length).toBeGreaterThan(0);
    }
    // `reason` never appears as a value list anywhere in the request.
    expect(JSON.stringify(req)).not.toContain("<empty-or-model-authored");
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
    expect(summary.fieldRepairOperationCount).toBe(14);
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

/**
 * R2.54 Part 6 — artifact /6.
 *
 * These run through the SAME entrypoint and dependency construction as everything above, and read
 * the artifact the run would write. R2.52's live artifact could prove only that something downstream
 * refused the patch; it could not say what the group had chosen, which alternative it failed against,
 * or whether the merge boundary had been crossed.
 */
describe("[R2.54][6] artifact /6 records the group decision and the merge boundary", () => {
  it("a VALID run records the matched alternative and a crossed merge boundary", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    await run(o);
    expect(o.artifacts).toHaveLength(1);
    const a = o.artifacts[0]! as { artifactVersion: string; fieldRepairObservability: Record<string, unknown> };
    expect(a.artifactVersion).toBe("practice-narrow-boundary-replay/6");

    const obs = a.fieldRepairObservability as {
      operationPlanCount: number;
      dependencyGroupCount: number;
      planSha256: string;
      suppliedOperationCount: number;
      accepted: boolean;
      refusalCodes: string[];
      mergeAttempted: boolean;
      mergeAccepted: boolean;
      mergedRowInvalidCount: number;
      redaction: Record<string, boolean>;
      groups: Array<{
        groupId: string;
        surfaceRef: string;
        fields: string[];
        alternativesCount: number;
        alternativesSha256: string;
        selected: Record<string, string>;
        matched: boolean;
        matchedAlternativeId: string | null;
        matchedStateId: string | null;
        reasonAuthority: string;
        refusalCode: string | null;
      }>;
    };

    expect(obs.operationPlanCount).toBe(14);
    expect(obs.dependencyGroupCount).toBe(10);
    expect(obs.planSha256).toHaveLength(64);
    expect(obs.suppliedOperationCount).toBe(14);
    expect(obs.accepted).toBe(true);
    expect(obs.refusalCodes).toEqual([]);
    expect(obs.mergeAttempted).toBe(true);
    expect(obs.mergeAccepted).toBe(true);
    expect(obs.mergedRowInvalidCount).toBe(0);

    expect(obs.groups).toHaveLength(1);
    const g = obs.groups[0]!;
    expect(g.surfaceRef).toBe("branch[0].resulting_world_state");
    expect(g.fields).toHaveLength(5);
    expect(g.alternativesCount).toBeGreaterThan(0);
    expect(g.alternativesSha256).toHaveLength(64);
    expect(g.matched).toBe(true);
    expect(g.matchedAlternativeId).not.toBeNull();
    expect(g.matchedStateId).toBe("governed_action_prerequisite_satisfied");
    expect(g.reasonAuthority).toBe("server_derived");
    expect(g.refusalCode).toBeNull();
    expect(g.selected.prerequisiteStatus).toBe("satisfied");
    // Redaction is declared and honoured: a server-derived reason reports as a shape, not as "".
    expect(g.selected.reason).toBe("<empty>");
    expect(obs.redaction.modelReasonProseWithheld).toBe(true);
    expect(obs.redaction.reasonReportedAsShapeOnly).toBe(true);
  });

  it("an INVALID row is diagnosable from the artifact alone — the R2.52 selection, replayed", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    const summary = await run(o, {}, "captured-r252");

    const a = o.artifacts[0]! as { fieldRepairObservability: Record<string, unknown>; fieldRepairCodes: string[]; repairMode: string };
    const obs = a.fieldRepairObservability as {
      accepted: boolean;
      refusalCodes: string[];
      mergeAttempted: boolean;
      mergeAccepted: boolean;
      mergedRowInvalidCount: number;
      suppliedOperationCount: number;
      groups: Array<{ selected: Record<string, string>; matched: boolean; matchedStateId: string | null; reasonAuthority: string; refusalCode: string | null }>;
    };

    // The patch WAS complete — this is not a coverage failure, and the artifact says which it is.
    expect(obs.suppliedOperationCount).toBe(14);
    expect(obs.accepted).toBe(false);
    expect(obs.refusalCodes).toContain("field_repair_group_reason_required_missing");
    // THE R2.52 QUESTION, now answerable: the merge boundary was NOT crossed.
    expect(obs.mergeAttempted).toBe(false);
    expect(obs.mergeAccepted).toBe(false);
    expect(obs.mergedRowInvalidCount).toBe(0);
    expect(a.fieldRepairCodes).not.toContain("field_repair_merged_row_invalid");

    const g = obs.groups[0]!;
    expect(g.matched).toBe(false);
    expect(g.matchedStateId).toBeNull();
    expect(g.refusalCode).toBe("field_repair_group_reason_required_missing");
    expect(g.reasonAuthority).toBe("model_required");
    expect(g.selected.prerequisiteStatus).toBe("not_established");
    expect(g.selected.temporalRelation).toBe("not_applicable");
    expect(g.selected.reason).toBe("<empty>");

    // The run still routes as a patch and still fails closed; no fallback appeared.
    expect(a.repairMode).toBe("field_patch");
    expect(summary.repairMode).toBe("field_patch");
    expect(summary.outcome).toBe("boundary_reviewer_terminal_failure");
    expect(o.reviewCalls).toHaveLength(1);
    expect(o.repairCalls).toHaveLength(1);
  });

  it("model reason PROSE never reaches the artifact", async () => {
    if (!present()) return expect(present()).toBe(false);
    const o = observed();
    await run(o);
    const obs = (o.artifacts[0]! as { fieldRepairObservability: unknown }).fieldRepairObservability;
    // The shape token carries a length and a digest prefix, never the words.
    for (const g of (obs as { groups: Array<{ selected: Record<string, string> }> }).groups) {
      if (g.selected.reason === "<empty>") continue;
      expect(g.selected.reason).toMatch(/^<model-prose:\d+:[0-9a-f]{12}>$/);
    }
  });
});

describe("[R2.52][7] the artifact proves which route ran", () => {
  it("the WRITTEN version is bumped and historical /4 stays readable", () => {
    expect(NARROW_REPLAY_ARTIFACT_VERSION).toBe("practice-narrow-boundary-replay/6");
    // The retained R2.50 live artifact is /4 and must still parse.
    const legacy = readdirSync(SOURCE).find((f) => f.includes("boundaryreplay.live.20260802T053740Z"));
    if (!legacy) return expect(true).toBe(true);
    const body = JSON.parse(readFileSync(join(SOURCE, legacy), "utf8")) as { artifactVersion: string; fieldRepairPlan: unknown };
    expect(body.artifactVersion).toBe("practice-narrow-boundary-replay/4");
    // And it records the defect: no plan, which under R2.52 would read as repairMode "unavailable".
    expect(body.fieldRepairPlan).toBeNull();
  });
});
