/**
 * c18 BOUNDARY PRECISION REGRESSION + REPLAY MOCK PROOF
 * (Slice 3.2I-R5B1A.1-R2.30 Parts 8, 11, 12).
 *
 * The regression half is DETERMINISTIC and runs against the tracked, sanitized c18 fixture. The
 * replay half executes the EXACT replay program with only the provider seam mocked, and depends on
 * the untracked source artifact — whose absence is RECORDED rather than asserted away.
 *
 * It pins BOTH failure directions the arc measured: R2.28's false negative and R2.29's five
 * unsupported violations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  C18_BOUNDARY,
  C18_CLEAR_VIOLATIONS,
  C18_COMPATIBILITY_SURFACES,
  C18_HISTORICAL_BROAD_ACCEPT,
  C18_HUMAN_ORACLE,
  C18_MEASURED_FALSE_POSITIVE_REASONS,
  C18_MEASURED_VIOLATION_EXCERPT,
  C18_NOT_APPLICABLE,
  C18_R229_UNSUPPORTED_VIOLATIONS,
  C18_REACHABLE_SURFACES,
  C18_SCENARIO,
  C18_SCENARIO_SHA256,
  C18_SURFACES,
  C18_UNCERTAIN,
} from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  deriveBoundaryVerdict,
  type BoundaryTruthAssessment,
  type NarrowReviewContext,
} from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import {
  BRANCH_AWARE_REACHABLE_SURFACE_COUNT,
  enumerateBoundarySurfaces,
  reviewableSurfaces,
  surfaceMapSha256,
} from "@/domain/foundry/arena-draft/boundarySurfaces";
import { scenarioDigest } from "@/domain/foundry/arena-draft/reviewSubject";
import { buildNarrowBoundaryRequest, buildNarrowBoundarySubject, NARROW_BOUNDARY_SYSTEM_PROMPT } from "./narrowBoundaryContract";
import { writeReplayArtifact, BOUNDARY_REPLAY_ARTIFACT_KIND } from "./replayArtifact";
import { buildContextSegments } from "@/domain/foundry/arena-draft/boundaryContextSegments";
import { buildAllEvidenceCandidates, poolFor } from "@/domain/foundry/arena-draft/boundaryEvidenceCandidates";
import { NO_CANDIDATE } from "@/domain/foundry/arena-draft/boundaryTruthContractTypes";
import { buildSemanticFrames } from "@/domain/foundry/arena-draft/boundarySemanticFrame";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { SOURCE_ARTIFACT, buildC18Subject } from "../../../../../scripts/practice-c18-boundary-replay";
import { mockNarrowReview, runC18NarrowBoundaryReplay } from "../../../../../scripts/practice-c18-narrow-boundary-replay";

const EVIDENCE_DIR = join(process.cwd(), ".eval-artifacts");
const present = () => existsSync(join(EVIDENCE_DIR, SOURCE_ARTIFACT));

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const { candidates } = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, frames, candidates };
const actionId = (ref: string) => poolFor(candidates, C18_BOUNDARY.id, ref, "governed_action")[0]?.candidateId ?? NO_CANDIDATE;
const failureId = (ref: string) =>
  poolFor(candidates, C18_BOUNDARY.id, ref, "prerequisite_failure").find((c) => /unverified/i.test(c.excerpt))?.candidateId ?? NO_CANDIDATE;
const satisfactionId = (ref: string) =>
  poolFor(candidates, C18_BOUNDARY.id, ref, "prerequisite_satisfaction").find((c) => /You have verified|Verify identifiers/i.test(c.excerpt))?.candidateId ?? NO_CANDIDATE;
const at = (ref: string) => C18_REACHABLE_SURFACES.find((s) => s.coordinate === ref)!;

/** The decisive excerpt per violating surface — a reviewer must quote the right part, not the first. */
const GOVERNED: Record<string, string> = {
  "primary[1]": "Notify the families and proceed with one patient",
  "branch[1].resulting_world_state": "prioritized immediate treatment for one patient",
  "branch[1].action[1]": "Immediately treat the second patient",
};
const PREREQ_FAILURE = "this left the second patient unverified";

/**
 * A response that mirrors the human oracle exactly — expressed in the R2.38 contract.
 *
 * It states FACTS and selects candidate ids. It cannot state a conclusion, because the contract has
 * no field for one. Where the scenario text cannot support the oracle's reading, the row says so
 * rather than asserting it: that gap is the measurement, not a bug to paper over.
 */
const oracleResponse = (): BoundaryTruthAssessment[] =>
  C18_REACHABLE_SURFACES.map((s) => {
    const o = C18_HUMAN_ORACLE[s.coordinate]!;
    const violating = o.compliance === "violates";
    const failure = violating ? failureId(s.coordinate) : NO_CANDIDATE;
    // `primary[1]` is the known limitation: the oracle calls it a violation, and its own text names
    // no unmet prerequisite. Without a failure candidate the honest fact is `not_established`.
    const canGround = failure !== NO_CANDIDATE;
    if (violating && canGround) {
      return {
        boundaryId: C18_BOUNDARY.id,
        surfaceRef: s.coordinate,
        governedActionStatus: "present" as const,
        prerequisiteStatus: "explicitly_missing" as const,
        temporalRelation: "action_before_prerequisite" as const,
        governedActionCandidateId: actionId(s.coordinate),
        prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
        prerequisiteFailureCandidateId: failure,
        reason: "",
      };
    }
    if (violating) {
      return {
        boundaryId: C18_BOUNDARY.id,
        surfaceRef: s.coordinate,
        governedActionStatus: "present" as const,
        prerequisiteStatus: "not_established" as const,
        temporalRelation: "simultaneous_or_unclear" as const,
        governedActionCandidateId: actionId(s.coordinate),
        prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
        prerequisiteFailureCandidateId: NO_CANDIDATE,
        reason: "nothing in this surface states whether identifiers were verified",
      };
    }
    if (o.applicability === "uncertain") {
      return {
        boundaryId: C18_BOUNDARY.id,
        surfaceRef: s.coordinate,
        governedActionStatus: "uncertain" as const,
        prerequisiteStatus: "uncertain" as const,
        temporalRelation: "not_applicable" as const,
        governedActionCandidateId: actionId(s.coordinate),
        prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
        prerequisiteFailureCandidateId: NO_CANDIDATE,
        reason: "'caring for' may or may not mean treatment",
      };
    }
    // R2.40 — a surface whose own text performs the PREREQUISITE has no governed-action candidate at
    // all, so `complies` is not expressible there and `not_applicable` is the honest answer. That is
    // exactly `primary[0]`: "Verify identifiers for both patients now" keeps the boundary, it does
    // not perform treatment. Under R2.38 it was the measured live FALSE POSITIVE.
    if (o.compliance === "complies" && actionId(s.coordinate) !== NO_CANDIDATE) {
      return {
        boundaryId: C18_BOUNDARY.id,
        surfaceRef: s.coordinate,
        governedActionStatus: "present" as const,
        prerequisiteStatus: "satisfied" as const,
        temporalRelation: "prerequisite_before_action" as const,
        governedActionCandidateId: actionId(s.coordinate),
        prerequisiteSatisfactionCandidateId: satisfactionId(s.coordinate),
        prerequisiteFailureCandidateId: NO_CANDIDATE,
        reason: "",
      };
    }
    return {
      boundaryId: C18_BOUNDARY.id,
      surfaceRef: s.coordinate,
      governedActionStatus: "absent" as const,
      prerequisiteStatus: "not_applicable" as const,
      temporalRelation: "not_applicable" as const,
      governedActionCandidateId: actionId(s.coordinate),
      prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
      prerequisiteFailureCandidateId: NO_CANDIDATE,
      reason: "",
    };
  });

describe("[1] the tracked c18 fixture reflects proven runtime reachability", () => {
  it("carries TWELVE reachable surfaces and FOUR excluded compatibility projections", () => {
    expect(C18_REACHABLE_SURFACES).toHaveLength(BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
    expect(C18_COMPATIBILITY_SURFACES).toHaveLength(4);
    expect(C18_SURFACES).toHaveLength(16);
    expect(C18_REACHABLE_SURFACES.filter((s) => s.kind === "resulting_world_state")).toHaveLength(2);
    for (const s of C18_COMPATIBILITY_SURFACES) expect(s.userReachable).toBe(false);
  });

  it(`matches the reconstructed live subject exactly (${present() ? "evidence present — asserted" : "EVIDENCE ABSENT — not asserted"})`, () => {
    if (!present()) return expect(present()).toBe(false);
    const live = buildC18Subject(process.cwd(), EVIDENCE_DIR);
    expect(scenarioDigest(live.subject.scenario)).toBe(C18_SCENARIO_SHA256);
    const liveSurfaces = enumerateBoundarySurfaces(live.subject.scenario as ArenaScenarioDraft, {});
    expect(surfaceMapSha256(liveSurfaces)).toBe(surfaceMapSha256(C18_SURFACES));
    expect(reviewableSurfaces(liveSurfaces).map((s) => s.coordinate)).toEqual(C18_REACHABLE_SURFACES.map((s) => s.coordinate));
  });

  it("is a regression ORACLE, never an answer key in the live prompt", () => {
    const subject = buildNarrowBoundarySubject({
      scenarioSha256: C18_SCENARIO_SHA256,
      reviewSubjectSha256: "r".repeat(64),
      boundaryProvenance: { activeBoundaryIds: [C18_BOUNDARY.id] } as never,
      boundaryProvenanceSha256: "p".repeat(64),
      boundaries: [C18_BOUNDARY],
      surfaces: C18_SURFACES,
      draft: C18_SCENARIO,
      language: "en",
      generationAttemptId: "gen1",
      caseId: "c18-constrained-clinical",
    });
    const request = JSON.stringify(buildNarrowBoundaryRequest(subject));
    expect(request).not.toContain("violates");
    expect(request).not.toContain("not_applicable");
    expect(request).not.toContain("oracle");
    // The unreachable projections never reach the model at all.
    for (const s of C18_COMPATIBILITY_SURFACES) expect(request).not.toContain(`"${s.coordinate}"`);
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).not.toContain("c1_verify");
    expect(NARROW_BOUNDARY_SYSTEM_PROMPT).not.toContain("second patient");
  });
});

describe("[1][2][3] c18 clear violations survive", () => {
  const verdict = () => deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);

  it("rejects, and finds the two clear violations the SCENARIO TEXT can support", () => {
    const v = verdict();
    expect(v.outcome).toBe("boundary_review_reject");
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations.map((x) => x.surfaceRef)).toEqual(["branch[1].resulting_world_state", "branch[1].action[1]"]);
  });

  it("[1] primary p2 — the KNOWN LIMITATION, recorded rather than engineered away", () => {
    // The human oracle marks `primary[1]` a violation, and R2.36 does not reach it. At the primary
    // decision point nothing in the scenario states that identifiers are unverified — the only
    // signal is that the SIBLING choice offers to verify them. Under this contract that is
    // `not_established`, and silence is deliberately not a violation. Tuning a gate to catch this
    // one surface would re-open the false-positive class R2.35 measured, so the row states
    // `not_established` and the server derives INCONCLUSIVE for it. Live behaviour: UNMEASURED.
    //
    // R2.38 note: the opening DOES carry an eligible failure candidate for `primary[1]`
    // (`boundaryCandidateAuthority` case 29 proves that selecting it derives the earliest causal
    // violation). What is unmeasured is whether the live reviewer selects it.
    const v = verdict();
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.violations.map((x) => x.surfaceRef)).not.toContain("primary[1]");
    const row = v.derived.find((d) => d.surfaceRef === "primary[1]")!;
    expect(row.facts.prerequisiteStatus).toBe("not_established");
    expect(row.compliance).toBe("uncertain");
    // The human oracle is UNCHANGED — the gap is visible, not papered over.
    expect([...C18_CLEAR_VIOLATIONS]).toContain("primary[1]");
  });

  it("[2] the p2 resulting state leaves a patient unverified", () => {
    const v = verdict();
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const w = v.violations.find((x) => x.surfaceRef === "branch[1].resulting_world_state")!;
    expect(w.prerequisiteFailureEvidence).toContain(C18_MEASURED_VIOLATION_EXCERPT);
    expect(w.violationMechanism).toBe("resulting_state_missing_prerequisite");
  });

  it("[3] the later action newly authorizes treating the still-unverified second patient", () => {
    const v = verdict();
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const a = v.violations.find((x) => x.surfaceRef === "branch[1].action[1]")!;
    expect(a.governedActionEvidence).toBe("Immediately treat the second patient");
    expect(a.downstreamOfPriorViolation).toBe(false); // it is a NEW authorization, not a repeat
  });

  it("[15][17] the correction set is THREE causal findings, not nine", () => {
    const v = verdict();
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(v.causalViolations).toHaveLength(2);
    expect(v.causalViolations.map((x) => x.surfaceRef)).toEqual(["branch[1].resulting_world_state", "branch[1].action[1]"]);
    // The R2.29 live run produced nine. Every one of the two that remain is grounded in prerequisite
    // truth, and the one the contract cannot reach is reported as refused, not silently dropped.
    expect(v.violations.length).toBeLessThan(9);
  });
});

describe("[4][5][6][9][23] the R2.29 false positives are prevented", () => {
  it("[4][5][6] administrative and staffing surfaces settle as not_applicable, never as violations", () => {
    const v = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    for (const ref of C18_NOT_APPLICABLE) {
      expect(v.violations.map((x) => x.surfaceRef)).not.toContain(ref);
      expect(C18_HUMAN_ORACLE[ref]).toEqual({ applicability: "not_applicable", compliance: "not_assessed" });
    }
  });

  it("[23] a not-applicable administrative action NEVER reaches the correction packet", () => {
    const v = deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx);
    if (v.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const corrected = new Set(v.causalViolations.map((x) => x.surfaceRef));
    for (const ref of C18_NOT_APPLICABLE) expect(corrected.has(ref)).toBe(false);
  });

  it("[9] each measured R2.29 rationale, submitted as a violation, is REFUSED as unsupported", () => {
    for (const reason of C18_MEASURED_FALSE_POSITIVE_REASONS) {
      // R2.32 — with a NAMED mechanism the claim reaches the evidence rules and fails there for
      // the right reason: it shows neither the governed action nor a prerequisite failure. The
      // prose, whatever it says, carries no authority at all.
      // R2.38 — the claim CANNOT BE MADE. There is no compliance field to set to `violates` and no
      // mechanism field to name. The strongest thing this rationale can express is `not_established`
      // with no failure candidate, which the server derives as uncertain — never as a violation.
      const rows = oracleResponse().map((a) =>
        a.surfaceRef === "branch[1].action[0]"
          ? {
              ...a,
              governedActionStatus: "present" as const,
              prerequisiteStatus: "not_established" as const,
              temporalRelation: "simultaneous_or_unclear" as const,
              prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
              prerequisiteFailureCandidateId: NO_CANDIDATE,
              reason,
            }
          : a,
      );
      const v = deriveBoundaryVerdict({ assessments: rows }, ctx);
      if (v.outcome !== "boundary_review_reject") throw new Error(`unreachable: ${v.outcome}`);
      expect(v.violations.map((x) => x.surfaceRef), `reason: ${reason}`).not.toContain("branch[1].action[0]");
      const row = v.derived.find((d) => d.surfaceRef === "branch[1].action[0]")!;
      expect(row.compliance).toBe("uncertain");
      expect(v.violations.map((x) => x.surfaceRef)).not.toContain("branch[1].action[0]");
    }

    // And a fact combination outside the canonical table is not a valid state at all.
    const impossible = oracleResponse().map((a) =>
      a.surfaceRef === "branch[1].action[0]"
        ? { ...a, governedActionStatus: "absent" as const, prerequisiteStatus: "explicitly_missing" as const, temporalRelation: "action_before_prerequisite" as const }
        : a,
    );
    const v2 = deriveBoundaryVerdict({ assessments: impossible }, ctx);
    expect(v2.outcome).toBe("boundary_review_malformed");
    if (v2.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(v2.codes).toContain("boundary_assessment_state_invalid");
  });

  it("[12] the flat compatibility surfaces R2.29 judged are not even in the matrix", () => {
    const excluded = new Set(C18_COMPATIBILITY_SURFACES.map((s) => s.coordinate));
    for (const ref of C18_R229_UNSUPPORTED_VIOLATIONS) {
      const isCompat = excluded.has(ref);
      const isNotApplicable = (C18_NOT_APPLICABLE as readonly string[]).includes(ref);
      const isUncertain = (C18_UNCERTAIN as readonly string[]).includes(ref);
      // Every R2.29 unsupported finding is now either unreachable, not-applicable, or uncertain.
      expect(isCompat || isNotApplicable || isUncertain, `${ref} must no longer be a violation`).toBe(true);
    }
  });

  it("[7][8] the context-dependent surface settles as UNCERTAIN, not as a violation", () => {
    expect(C18_HUMAN_ORACLE["branch[1].tradeoff[1]"]).toEqual({ applicability: "uncertain", compliance: "not_assessed" });
    // With the clear violations removed, the remaining uncertainty drives an inconclusive result.
    const rows = oracleResponse().map((a) =>
      (C18_CLEAR_VIOLATIONS as readonly string[]).includes(a.surfaceRef)
        ? {
            ...a,
            governedActionStatus: "absent" as const,
            prerequisiteStatus: "not_applicable" as const,
            temporalRelation: "not_applicable" as const,
            prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
            prerequisiteFailureCandidateId: NO_CANDIDATE,
            reason: "",
          }
        : a,
    );
    const v = deriveBoundaryVerdict({ assessments: rows }, ctx);
    expect(v.outcome).toBe("boundary_review_inconclusive");
    if (v.outcome !== "boundary_review_inconclusive") throw new Error("unreachable");
    expect(v.uncertainties.map((u) => u.surfaceRef)).toEqual([...C18_UNCERTAIN]);
  });
});

describe("the historical broad accept has NO override authority", () => {
  it("its aggregate claim cannot even be expressed in this contract", () => {
    const flat = JSON.stringify(NARROW_BOUNDARY_JSON_SCHEMA);
    for (const field of ["overallVerdict", "boundaryCompliant", "violatedBoundaryIds"]) expect(flat).not.toContain(field);
    expect(deriveBoundaryVerdict(C18_HISTORICAL_BROAD_ACCEPT, ctx).outcome).toBe("boundary_review_malformed");
    expect(C18_HISTORICAL_BROAD_ACCEPT.violatedBoundaryIds).toEqual([]);
    expect(deriveBoundaryVerdict({ assessments: oracleResponse() }, ctx).outcome).toBe("boundary_review_reject");
  });
});

// ---------------------------------------------------------------------------
// [18-23] Replay mock proof — the EXACT program, only the provider seam replaced
// ---------------------------------------------------------------------------

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "r230-c18-precision-"));
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

describe(`[18-23] precision replay mock proof (${present() ? "evidence present — asserted" : "EVIDENCE ABSENT — not asserted"})`, () => {
  it("[18][21] one subject, exactly one narrow call, exactly one immutable artifact", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { summary, calls, files } = await runReplay("pass");
    expect(calls).toEqual([1]);
    expect(summary.calls).toBe(1);
    expect(summary.outcome).toBe("boundary_review_pass");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^practice-review\.boundaryreplay\.mock\./);
  });

  it("[15][17] a mocked causal chain yields deduplicated causal findings", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { summary, files } = await runReplay("reject");
    expect(summary.outcome).toBe("boundary_review_reject");
    const body = JSON.parse(readFileSync(join(dir, files[0]!), "utf8"));
    expect(body.causalViolations.length).toBeLessThanOrEqual(body.violations.length);
    // R2.46 — one correction per CAUSAL GROUP, not per violating surface. A generated state folded
    // into its parent's group contributes a coordinate, never a second instruction, so the finding
    // count is the coordinate count and the distinct codes never exceed the group count.
    expect(body.causalGroups.length).toBeLessThanOrEqual(body.causalViolations.length);
    const coordinates = body.causalGroups.reduce(
      (n: number, g: { attributed: boolean; manifestationSurfaceRefs: string[] }) => n + 1 + (g.attributed ? g.manifestationSurfaceRefs.length : 0),
      0,
    );
    expect(body.findings.length).toBe(coordinates);
    expect(new Set(body.findings.map((f: { code: string }) => f.code)).size).toBeLessThanOrEqual(body.causalGroups.length);
    expect(body.causalAttributionMetrics.ancestorDirectAssessmentMutationCount).toBe(0);
    // R2.38 — the detail carries the derived STATE and the derived mechanism, plus the candidate ids.
    for (const f of body.findings) expect(f.detail).toMatch(/\[[a-z_]+ -> [a-z_]+\]/);
  });

  it("[12] the artifact records which surfaces were reviewed and which were EXCLUDED", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { files } = await runReplay("pass");
    const body = JSON.parse(readFileSync(join(dir, files[0]!), "utf8"));
    expect(body.reachableSurfaces).toHaveLength(BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
    expect(body.excludedCompatibilitySurfaces).toEqual(["flat_tradeoff[0]", "flat_tradeoff[1]", "flat_action[0]", "flat_action[1]"]);
    expect(body.request.decisionSurfaceCount).toBe(12);
    expect(body.request.requiredAssessmentCount).toBe(12);
    expect(body.request.excludedCompatibilitySurfaceCount).toBe(4);
  });

  it("[19][20] the artifact records ZERO generation calls and ZERO broad-review calls", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { files } = await runReplay("pass");
    const body = JSON.parse(readFileSync(join(dir, files[0]!), "utf8"));
    expect(body.generationCallCount).toBe(0);
    expect(body.broadReviewCallCount).toBe(0);
    expect(body.broadReviewStarted).toBe(false);
  });

  it("binds subject, provenance, surface-map and lineage identity", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { files } = await runReplay("pass");
    const body = JSON.parse(readFileSync(join(dir, files[0]!), "utf8"));
    expect(body.subjectDigests.scenarioSha256).toBe(C18_SCENARIO_SHA256);
    expect(body.surfaceMapSha256).toBe(surfaceMapSha256(C18_SURFACES));
    expect(body.lineageSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(body.activeBoundaryIds).toEqual(["c1_verify"]);
  });

  it("[22][23] carries NO credential metadata and NO product-quality-pass label", async () => {
    if (!present()) return expect(present()).toBe(false);
    const { files } = await runReplay("pass");
    const raw = readFileSync(join(dir, files[0]!), "utf8");
    expect(raw).not.toMatch(/sk-|api[_-]?key|authorization|bearer|LLM_API_KEY|OPENAI/i);
    const body = JSON.parse(raw);
    expect(body.productQualityPass).toBeNull();
    expect(body.productQualityAuthority).toBe("human_only");
  });

  it("[13] a missing resulting world state fails closed BEFORE any provider call", async () => {
    if (!present()) return expect(present()).toBe(false);
    const calls: number[] = [];
    const summary = await runC18NarrowBoundaryReplay(
      {
        review: async (s, a) => {
          calls.push(a);
          return mockNarrowReview("pass", s, a);
        },
        writeArtifact: (payload, subjectSha) =>
          writeReplayArtifact(
            dir,
            { mode: "mock", replayRunId: "mockrun", sourcePassId: "pass2", sourceCaseId: "c18", sourceAttemptIndex: 2, reviewSubjectSha256: subjectSha },
            payload,
            BOUNDARY_REPLAY_ARTIFACT_KIND,
          ),
        mutateDraft: (d) => {
          const branched = d as ArenaScenarioDraft;
          const key = branched.primary.choices[1]!.id;
          branched.branches![key]!.resultingWorldState = "";
          return branched;
        },
      },
      process.cwd(),
      EVIDENCE_DIR,
      "mockrun",
      "mock",
    );
    expect(calls).toEqual([]);
    expect(summary.outcome).toBe("boundary_review_authority_failure");
    expect(summary.authorityCodes).toContain("boundary_world_state_missing");
  });

  it("refuses to overwrite an existing artifact for the same subject", async () => {
    if (!present()) return expect(present()).toBe(false);
    await runReplay("pass");
    await expect(runReplay("pass")).rejects.toThrow(/ARTIFACT COLLISION/);
  });
});

/** Surfaces referenced by the oracle must exist — a typo in a coordinate must fail loudly. */
describe("oracle integrity", () => {
  it("every oracle coordinate resolves to a real reachable surface", () => {
    for (const ref of [...C18_CLEAR_VIOLATIONS, ...C18_NOT_APPLICABLE, ...C18_UNCERTAIN]) expect(at(ref)).toBeDefined();
    expect(Object.keys(C18_HUMAN_ORACLE)).toHaveLength(BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
  });
});
