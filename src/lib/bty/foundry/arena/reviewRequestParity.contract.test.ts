/**
 * PRODUCTION / REPLAY REQUEST PARITY (Slice 3.2I-R5B1A.1-R2.29 Part 15).
 *
 * R2.28 measured the replay reviewer request missing `activeBoundaryCount` and
 * `boundaryComplianceScope` — the latter being the ONLY string in the whole contract that names a
 * resulting world state as a compliance surface. The replay therefore asked a weaker question than
 * production, and its accept could not be attributed to the production contract.
 *
 * Parity is now structural: one builder, two callers. These tests pin that it stays that way.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { broadBoundaryComplianceScope, buildBroadReviewRequest, serializeBroadReviewRequest } from "./reviewRequestProjection";
import { buildNarrowBoundaryRequest, buildNarrowBoundarySubject, boundaryComplianceScopeText } from "./narrowBoundaryContract";
import { enumerateBoundarySurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { draftFixture } from "@/domain/foundry/arena-draft/boundarySurfaces.test";

const BOUNDARY = { id: "c1_verify", statement: "Two identifiers must be verified before treatment" };
const draft = draftFixture();
const SRC = join(process.cwd(), "src/lib/bty/foundry/arena");

describe("broad review request parity", () => {
  it("production and replay build the BYTE-IDENTICAL request for the same subject", () => {
    // Production passes captured constructions; the replay has none and passes `{}`.
    const production = serializeBroadReviewRequest(buildBroadReviewRequest(draft, [BOUNDARY], {}));
    const replay = serializeBroadReviewRequest(buildBroadReviewRequest(draft, [BOUNDARY]));
    expect(replay).toBe(production);
  });

  it("the replay request now carries activeBoundaryCount and boundaryComplianceScope", () => {
    const r = buildBroadReviewRequest(draft, [BOUNDARY]);
    expect(r.activeBoundaryCount).toBe(1);
    expect(r.boundaryComplianceScope).toContain("every resulting world state");
    expect(r.boundaryComplianceScope).toContain("EVERY boundary listed in `constraints`");
  });

  it("states a DIFFERENT thing for an empty active set — the c01 shape is not silence", () => {
    expect(broadBoundaryComplianceScope(0)).toBe("No confirmed boundary applies to this case.");
    expect(buildBroadReviewRequest(draft, []).activeBoundaryCount).toBe(0);
  });

  it("both callers use the SHARED builder — neither constructs its own payload", () => {
    const service = readFileSync(join(SRC, "arenaScenarioGenerationService.ts"), "utf8");
    const replay = readFileSync(join(SRC, "reviewFrozenSubject.ts"), "utf8");
    for (const [name, src] of [["production", service], ["replay", replay]] as const) {
      expect(src, `${name} must call the shared builder`).toContain("buildBroadReviewRequest(");
      expect(src, `${name} must use the shared serializer`).toContain("serializeBroadReviewRequest(");
      // The literal scope sentence must exist in exactly one place: the projection module.
      expect(src, `${name} must not inline the scope sentence`).not.toContain("must comply with EVERY boundary listed");
    }
  });

  it("carries the exact active boundary ids and statements", () => {
    const r = buildBroadReviewRequest(draft, [BOUNDARY]);
    expect(r.constraints).toEqual([BOUNDARY]);
  });
});

describe("narrow boundary request", () => {
  const subject = buildNarrowBoundarySubject({
    scenarioSha256: "s".repeat(64),
    reviewSubjectSha256: "r".repeat(64),
    boundaryProvenance: { activeBoundaryIds: [BOUNDARY.id] } as never,
    boundaryProvenanceSha256: "p".repeat(64),
    boundaries: [BOUNDARY],
    surfaces: enumerateBoundarySurfaces(draft),
    draft,
    language: "en",
    generationAttemptId: "gen1",
    caseId: "c18",
  });

  it("carries the active boundary count, the exact ids/text and the required assessment count", () => {
    const r = buildNarrowBoundaryRequest(subject);
    expect(r.activeBoundaryCount).toBe(1);
    // R2.36 — the boundary arrives DECOMPOSED. The exact statement is still carried verbatim; the
    // prerequisite and the governed action are named separately so "the prerequisite" is a clause
    // the server and the model both point at, not a whole sentence each reads its own way.
    expect(r.constraints).toEqual([
      {
        ...BOUNDARY,
        ruleKind: "prerequisite_before_action",
        prerequisite: "Two identifiers must be verified",
        governedAction: "treatment",
        temporalRequirement: "prerequisite_before_action",
      },
    ]);
    // R2.30 — only the TWELVE learner-reachable surfaces enter the matrix.
    expect(r.decisionSurfaceCount).toBe(12);
    expect(r.requiredAssessmentCount).toBe(12);
    expect(r.excludedCompatibilitySurfaceCount).toBe(4);
  });

  it("states the decision-surface scope AND the resulting-world-state scope explicitly", () => {
    const scope = buildNarrowBoundaryRequest(subject).boundaryComplianceScope;
    expect(scope).toContain("12 listed decision surfaces");
    expect(scope).toContain("including every resulting world state");
    expect(scope).toContain("Return exactly 12 assessments");
    // R2.30 — the scope states applicability-before-compliance, and that silence is not a violation.
    expect(scope).toContain("APPLICABILITY first");
    expect(scope).toContain("silent about the rule is not thereby a violation");
    expect(boundaryComplianceScopeText(3, 12)).toContain("Return exactly 36 assessments");
    expect(boundaryComplianceScopeText(0, 12)).toBe("No confirmed boundary applies to this case.");
  });

  it("carries subject, provenance and surface-map authority so a drifted answer is detectable", () => {
    const a = buildNarrowBoundaryRequest(subject).authority;
    expect(a.scenarioSha256).toBe("s".repeat(64));
    expect(a.reviewSubjectSha256).toBe("r".repeat(64));
    expect(a.boundaryProvenanceSha256).toBe("p".repeat(64));
    expect(a.surfaceMapSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.boundaryReviewSubjectSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("lists every surface with its coordinate, kind and text — and both world states", () => {
    const r = buildNarrowBoundaryRequest(subject);
    expect(r.surfaces).toHaveLength(12);
    expect(r.surfaces.filter((s) => s.kind === "resulting_world_state").map((s) => s.surfaceRef)).toEqual([
      "branch[0].resulting_world_state",
      "branch[1].resulting_world_state",
    ]);
    for (const s of r.surfaces) expect(s.text.length).toBeGreaterThan(0);
    // No compatibility projection is ever named to the model.
    for (const s of r.surfaces) expect(s.surfaceRef).not.toMatch(/^flat_/);
  });

  it("is deterministic — the same subject yields a byte-identical request", () => {
    expect(JSON.stringify(buildNarrowBoundaryRequest(subject))).toBe(JSON.stringify(buildNarrowBoundaryRequest(subject)));
  });
});
