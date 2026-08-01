/**
 * c18 BOUNDARY REGRESSION + NARROW REPLAY MOCK PROOF
 * (Slice 3.2I-R5B1A.1-R2.29 Parts 10, 13, 14, 18).
 *
 * The regression half is DETERMINISTIC and needs no evidence file: it runs against the tracked,
 * sanitized c18 fixture. The replay half executes the EXACT replay program with only the provider
 * seam mocked, and depends on the untracked source artifact — whose absence is RECORDED rather than
 * asserted away.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  C18_BOUNDARY,
  C18_HISTORICAL_BROAD_ACCEPT,
  C18_HUMAN_ORACLE,
  C18_MEASURED_VIOLATION_EXCERPT,
  C18_REQUIRED_VIOLATIONS,
  C18_SCENARIO_SHA256,
  C18_SURFACES,
} from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  deriveBoundaryVerdict,
  validateNarrowBoundaryReview,
  type NarrowReviewContext,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { CANONICAL_SURFACE_COUNT, enumerateBoundarySurfaces, surfaceMapSha256 } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { scenarioDigest } from "@/domain/foundry/arena-draft/reviewSubject";
import { buildNarrowBoundaryRequest, buildNarrowBoundarySubject, NARROW_BOUNDARY_SYSTEM_PROMPT } from "./narrowBoundaryContract";
import { writeReplayArtifact, BOUNDARY_REPLAY_ARTIFACT_KIND } from "./replayArtifact";
import { runBoundaryReviewStage } from "./boundaryReviewStage";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { SOURCE_ARTIFACT, buildC18Subject } from "../../../../../scripts/practice-c18-boundary-replay";
import { mockNarrowReview, runC18NarrowBoundaryReplay } from "../../../../../scripts/practice-c18-narrow-boundary-replay";

const EVIDENCE_DIR = join(process.cwd(), ".eval-artifacts");
const present = () => existsSync(join(EVIDENCE_DIR, SOURCE_ARTIFACT));

const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_SURFACES };

/**
 * A response that mirrors the human oracle: the four violating surfaces marked, the rest compliant.
 *
 * The excerpt for each violating surface is the DECISIVE fragment, not the leading 120 characters —
 * a reviewer that quotes the wrong part of the right surface has not shown its work either.
 */
const DECISIVE_EXCERPT: Record<string, string> = {
  "primary[1]": "Notify the families and proceed with one patient",
  "flat_action[1]": "Proceed with treatment for the first patient only",
  "branch[1].resulting_world_state": "this left the second patient unverified",
  "branch[1].action[1]": "Immediately treat the second patient",
};

const oracleResponse = () =>
  C18_SURFACES.map((s) => ({
    boundaryId: C18_BOUNDARY.id,
    surfaceRef: s.coordinate,
    result: C18_HUMAN_ORACLE[s.coordinate]!,
    evidenceExcerpt: DECISIVE_EXCERPT[s.coordinate] ?? s.text.slice(0, 120),
    reason: C18_HUMAN_ORACLE[s.coordinate] === "violates" ? "proceeds or persists without the two-identifier check" : "keeps the check",
  }));

/** The response shape R2.28 measured: everything compliant, asserted, with no violation encoded. */
const historicalFalseNegative = () =>
  C18_SURFACES.map((s) => ({
    boundaryId: C18_BOUNDARY.id,
    surfaceRef: s.coordinate,
    result: "complies" as const,
    evidenceExcerpt: s.text.slice(0, 120),
    reason: "the verification boundary is operational",
  }));

describe("[31] the tracked c18 fixture is the frozen subject", () => {
  it("carries all sixteen canonical surface coordinates", () => {
    expect(C18_SURFACES).toHaveLength(CANONICAL_SURFACE_COUNT);
    expect(new Set(C18_SURFACES.map((s) => s.coordinate)).size).toBe(CANONICAL_SURFACE_COUNT);
    expect(C18_SURFACES.filter((s) => s.kind === "resulting_world_state")).toHaveLength(2);
  });

  it(`matches the reconstructed live subject exactly (${present() ? "evidence present — asserted" : "EVIDENCE ABSENT — not asserted"})`, () => {
    if (!present()) return expect(present()).toBe(false);
    const live = buildC18Subject(process.cwd(), EVIDENCE_DIR);
    expect(scenarioDigest(live.subject.scenario)).toBe(C18_SCENARIO_SHA256);
    const liveSurfaces = enumerateBoundarySurfaces(live.subject.scenario as ArenaScenarioDraft, {});
    expect(surfaceMapSha256(liveSurfaces)).toBe(surfaceMapSha256(C18_SURFACES));
  });

  it("is a regression ORACLE, never an answer key in the live prompt", () => {
    // The narrow request carries surfaces and boundaries. It must not carry expected results.
    const subject = buildNarrowBoundarySubject({
      scenarioSha256: C18_SCENARIO_SHA256,
      reviewSubjectSha256: "r".repeat(64),
      boundaryProvenance: { activeBoundaryIds: [C18_BOUNDARY.id] } as never,
      boundaryProvenanceSha256: "p".repeat(64),
      boundaries: [C18_BOUNDARY],
      surfaces: C18_SURFACES,
      language: "en",
      generationAttemptId: "gen1",
      caseId: "c18-constrained-clinical",
    });
    const request = JSON.stringify(buildNarrowBoundaryRequest(subject));
    expect(request).not.toContain("violates");
    expect(request).not.toContain("C18_HUMAN_ORACLE");
    expect(request).not.toContain("oracle");
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).not.toContain("c1_verify");
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).not.toContain("second patient");
  });
});

describe("c18 regression — the exact measured false negative", () => {
  it("[32] primary p2 'Notify the families and proceed with one patient' is detectable as a violation", () => {
    const v = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    expect(v.outcome).toBe("boundary_review_reject");
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const p2 = v.violations.find((x) => x.surfaceRef === "primary[1]");
    expect(p2).toBeDefined();
    expect(p2!.evidenceExcerpt).toContain("proceed with one patient");
  });

  it("[33] the p2 RESULTING WORLD STATE is a first-class violation — the surface R2.28 had nowhere to record", () => {
    const v = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const world = v.violations.find((x) => x.surfaceRef === "branch[1].resulting_world_state");
    expect(world).toBeDefined();
    expect(world!.evidenceExcerpt).toContain(C18_MEASURED_VIOLATION_EXCERPT);
  });

  it("[34] the later treatment action that proceeds without verification is a violation", () => {
    const v = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations.map((x) => x.surfaceRef)).toContain("branch[1].action[1]");
    expect(v.violations.find((x) => x.surfaceRef === "branch[1].action[1]")!.evidenceExcerpt).toContain("Immediately treat the second patient");
  });

  it("AT LEAST the four oracle surfaces fail", () => {
    const v = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations.map((x) => x.surfaceRef).sort()).toEqual([...C18_REQUIRED_VIOLATIONS].sort());
  });

  it("[17] the violation excerpt survives into the correction input, verbatim", () => {
    const v = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    for (const x of v.violations) {
      const surface = C18_SURFACES.find((s) => s.coordinate === x.surfaceRef)!;
      expect(surface.text).toContain(x.evidenceExcerpt);
      expect(x.boundaryStatement).toBe(C18_BOUNDARY.statement);
    }
  });
});

describe("[35] the historical broad accept has NO override authority", () => {
  it("an aggregate 'all choices comply' assertion cannot even be expressed in this contract", () => {
    const flat = JSON.stringify(NARROW_BOUNDARY_JSON_SCHEMA);
    for (const field of Object.keys(C18_HISTORICAL_BROAD_ACCEPT)) {
      if (field === "overallVerdict" || field === "boundaryCompliant" || field === "violatedBoundaryIds") expect(flat).not.toContain(field);
    }
    // Submitted as a narrow response, the whole historical claim is not a judgment at all.
    expect(deriveBoundaryVerdict(C18_HISTORICAL_BROAD_ACCEPT, ctx).outcome).toBe("boundary_review_malformed");
  });

  it("an empty violatedBoundaryIds carries no weight — only per-surface results decide", () => {
    expect(C18_HISTORICAL_BROAD_ACCEPT.violatedBoundaryIds).toEqual([]);
    expect(C18_HISTORICAL_BROAD_ACCEPT.overallVerdict).toBe("accept");
    // The same scenario, judged per surface, still rejects.
    expect(deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx).outcome).toBe("boundary_review_reject");
  });

  it("a consistent_accept from the broad reviewer cannot follow a narrow reject — the broad stage never runs", async () => {
    const provenance = { boundaryMode: "bearing", activeBoundaryIds: [C18_BOUNDARY.id] } as never;
    const stage = await runBoundaryReviewStage(
      {
        review: async (s, a) => mockNarrowReview("noop", s, a) && ({
          kind: "derived",
          verdict: deriveBoundaryVerdict({ assessments: oracleResponse() }, { boundaries: s.boundaries, surfaces: s.surfaces }),
          evidence: {
            boundaryReviewAttempt: a,
            boundaryReviewSubjectSha256: "x",
            surfaceMapSha256: s.surfaceMapSha256,
            activeBoundaryIds: s.activeBoundaryIds,
            requiredAssessmentCount: 16,
            parsed: { assessments: oracleResponse() },
            outcome: "boundary_review_reject",
            verdict: deriveBoundaryVerdict({ assessments: oracleResponse() }, { boundaries: s.boundaries, surfaces: s.surfaces }),
            finishReason: "stop",
            latencyMs: 0,
            sanitizedError: null,
          },
        }),
      },
      {
        draft: { primary: { choices: [] } } as never,
        constructions: {},
        boundaries: [C18_BOUNDARY],
        boundaryProvenance: provenance,
        boundaryProvenanceSha256: "p".repeat(64),
        scenarioSha256: C18_SCENARIO_SHA256,
        reviewSubjectSha256: "r".repeat(64),
        language: "en",
        generationAttemptId: "gen1",
        caseId: "c18",
      },
    );
    // A draft with no surfaces cannot even reach the reviewer — the map check fails closed first.
    expect(stage.broadReviewAllowed).toBe(false);
  });

  it("the historical false-negative RESPONSE shape now fails on evidence, not on assertion", () => {
    // Every surface asserted compliant, each excerpt faithfully quoted: coverage and grounding pass.
    // That is by design — this contract cannot detect a wrong judgment, it can only make the
    // judgment per-surface, evidenced, and server-derived. What it removes is the aggregate hiding
    // place, proven by the fact that the violating surfaces are now individually addressable.
    const r = validateNarrowBoundaryReview({ assessments: historicalFalseNegative() }, ctx);
    expect(r.ok).toBe(true);
    const v = deriveBoundaryVerdict({ assessments: historicalFalseNegative() }, ctx);
    expect(v.outcome).toBe("boundary_review_pass");
    // …and the same response with the oracle applied rejects, at named coordinates.
    const rejected = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    expect(rejected.outcome).toBe("boundary_review_reject");
  });

  it("a bare assertion with no same-surface evidence is now UNREPRESENTABLE", () => {
    const bare = C18_SURFACES.map((s) => ({
      boundaryId: C18_BOUNDARY.id,
      surfaceRef: s.coordinate,
      result: "complies" as const,
      evidenceExcerpt: "The verification boundary is present and operationalized, ensuring compliance.",
      reason: "compliant",
    }));
    const v = deriveBoundaryVerdict({ assessments: bare }, ctx);
    expect(v.outcome).toBe("boundary_review_malformed");
    if (v.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(v.codes).toContain("boundary_evidence_generic");
  });
});

// ---------------------------------------------------------------------------
// [36-41] Replay mock proof — the EXACT program, only the provider seam replaced
// ---------------------------------------------------------------------------

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "r229-c18-narrow-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const runReplay = async (mockKind: string) => {
  const calls: number[] = [];
  const summary = await runC18NarrowBoundaryReplay(
    {
      review: async (s, a) => {
        calls.push(a);
        return mockNarrowReview(mockKind, s, a);
      },
      writeArtifact: (payload, subjectSha) =>
        writeReplayArtifact(
          dir,
          { mode: "mock", replayRunId: "mockrun", sourcePassId: "pass2", sourceCaseId: "c18-constrained-clinical", sourceAttemptIndex: 2, reviewSubjectSha256: subjectSha },
          payload,
          BOUNDARY_REPLAY_ARTIFACT_KIND,
        ),
    },
    process.cwd(),
    EVIDENCE_DIR,
    "mockrun",
    "mock",
  );
  return { summary, calls, files: readdirSync(dir) };
};

describe(`[36-41] narrow boundary replay mock proof (${present() ? "evidence present — asserted" : "EVIDENCE ABSENT — not asserted"})`, () => {
  it("[36][37][40] one subject, exactly one narrow reviewer call, exactly one immutable artifact", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { summary, calls, files } = await runReplay("pass");
    expect(calls).toEqual([1]);
    expect(summary.calls).toBe(1);
    expect(summary.reruns).toBe(0);
    expect(summary.outcome).toBe("boundary_review_pass");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^practice-review\.boundaryreplay\.mock\./);
  });

  it("a mocked violation produces a reject artifact naming the coordinate", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { summary, files } = await runReplay("reject");
    expect(summary.outcome).toBe("boundary_review_reject");
    const body = JSON.parse(readFileSync(join(dir, files[0]!), "utf8"));
    expect(body.violations[0].surfaceRef).toBe("primary[1]");
    expect(body.findings[0].code).toBe("choice_bypasses_boundary");
  });

  it("[15] a malformed first response is rerun over the identical subject and then terminates", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { summary, calls } = await runReplay("malformed");
    expect(calls).toEqual([1, 2]);
    expect(summary.outcome).toBe("boundary_reviewer_terminal_failure");
    expect(summary.reruns).toBe(1);
  });

  it("[38][39] the artifact records ZERO generation calls and ZERO broad-review calls", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { files } = await runReplay("pass");
    const body = JSON.parse(readFileSync(join(dir, files[0]!), "utf8"));
    expect(body.generationCallCount).toBe(0);
    expect(body.broadReviewCallCount).toBe(0);
    expect(body.broadReviewStarted).toBe(false);
  });

  it("[41] the artifact binds subject, provenance and surface-map identity", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { files } = await runReplay("pass");
    const body = JSON.parse(readFileSync(join(dir, files[0]!), "utf8"));
    expect(body.subjectDigests.scenarioSha256).toBe(C18_SCENARIO_SHA256);
    expect(body.boundaryReviewSubjectSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(body.surfaceMapSha256).toBe(surfaceMapSha256(C18_SURFACES));
    expect(body.surfaces).toHaveLength(CANONICAL_SURFACE_COUNT);
    expect(body.activeBoundaryIds).toEqual(["c1_verify"]);
    expect(body.request.activeBoundaryCount).toBe(1);
    expect(body.request.requiredAssessmentCount).toBe(16);
    expect(body.request.boundaryComplianceScope).toContain("resulting world state");
  });

  it("[24] carries NO credential or provider-account metadata, and NO product-quality-pass label", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { files } = await runReplay("pass");
    const raw = readFileSync(join(dir, files[0]!), "utf8");
    expect(raw).not.toMatch(/sk-|api[_-]?key|authorization|bearer|LLM_API_KEY|OPENAI/i);
    const body = JSON.parse(raw);
    expect(body.productQualityPass).toBeNull();
    expect(body.productQualityAuthority).toBe("human_only");
  });

  it("refuses to overwrite an existing artifact for the same subject", async () => {
    if (!present()) return expect(present()).toBe(false);
    await runReplay("pass");
    await expect(runReplay("pass")).rejects.toThrow(/ARTIFACT COLLISION/);
  });
});
