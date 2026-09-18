/**
 * FROZEN-SUBJECT REVIEWER REPLAY — PHASE 1 HARNESS TESTS.
 *
 * Authorized by `[GOV-ARENA-REVIEWER-REPLAY-1]` Phase 1.
 *
 * THIS FILE MAKES NO PROVIDER CALL AND NO GENERATION CALL. The shared LLM seam is mocked with a
 * `create` that throws, so any live path would fail loudly rather than silently succeed, and every
 * reviewer dependency is injected as a canned function.
 *
 * Phase 1 proves the SEAM, not a reviewer verdict: that a retained Run-4/Run-5 artifact can be
 * loaded, hash-verified and projected into the EXISTING narrow and broad reviewer requests without
 * running Plan or Render, and that the narrow projection still cannot see the forced
 * `boundaryCompliance` claim while the broad projection still can.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { vi, describe, it, expect } from "vitest";

// --- mock the shared LLM seam: any live provider path must throw, never succeed -------------
const mockCreate = vi.fn(() => {
  throw new Error("PHASE 1 VIOLATION: a live provider call was attempted");
});
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  tryGetLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  isLocalLlm: () => false,
}));

// Imports below must come AFTER `vi.mock` so the mocked client seam is what the SUT sees.
import { scenarioDigest } from "@/domain/foundry/arena-draft/reviewSubject";
import { validateSemanticReview } from "@/domain/foundry/arena-draft/semanticReview";
import { enumerateChoices } from "@/domain/foundry/arena-draft/choiceConstruction";
import { acceptReview } from "@/domain/foundry/arena-draft/providerDto.fixture";
import {
  REPLAY_OUTPUT_ROOT,
  loadFrozenSubject,
  deriveReplayAuthority,
  buildReplayNarrowSubject,
  buildReplayBroadRequest,
  runFrozenReviewerReplay,
  type ReplayDeps,
} from "../../../../../scripts/practice-frozen-reviewer-replay";

const ROOT = process.cwd();
const RUN4 =
  ".eval-artifacts/reviewer-observer-live-04/c18-constrained-clinical/retention-v1/practice-retention.reviewer-observer-live-04-c18.c18-constrained-clinical.plan_render_v1.1.json";
const RUN5 =
  ".eval-artifacts/reviewer-observer-live-05/c18-constrained-clinical/retention-v1/practice-retention.reviewer-observer-live-05-c18.c18-constrained-clinical.plan_render_v1.1.json";
const RUN4_SHA = "e52cc7896da89bcdb745bc4f2c4c7acae652810e359e72a7897102f7cf25644b";
const RUN5_SHA = "46d6882b78f7064de68310b8312fd4b0f9ab5c6f603150ed682a4f8f383b4fd8";
const RUN4_SCENARIO_DIGEST = "c917a9d33b581154768e19269c91a1553dd23da07c92b58b7d705cfed30e1390";
const CONFIRMED_ID = "c1_verify";

/** PRE-implementation body hash of `reviewConstraintCompliance`, excluding its declaration line. */
const BODY_SHA_PRE = "69e3f57375c9893f229887fbfe248e8b7e2f267416dca2e7debce12af348a052";

/** Canned deps: no provider, no network. Records exactly what the harness handed each reviewer. */
function cannedDeps(): { deps: ReplayDeps; seen: Record<string, unknown[]> } {
  const seen: Record<string, unknown[]> = { narrow: [], repair: [], broad: [] };
  const deps: ReplayDeps = {
    narrowReview: async (subject, attempt, surfaceRefs) => {
      seen.narrow.push({ subject, attempt, surfaceRefs });
      return {
        kind: "transport_failed",
        evidence: {
          boundaryReviewAttempt: attempt,
          boundaryReviewSubjectSha256: subject.reviewSubjectSha256,
          surfaceMapSha256: "",
          activeBoundaryIds: [...subject.activeBoundaryIds],
          requiredAssessmentCount: 0,
          parsed: null,
          outcome: "boundary_review_inconclusive",
          verdict: {
            outcome: "boundary_review_inconclusive",
            uncertainties: [],
            assessedPairs: 0,
            explanations: [],
            derived: [],
          },
          finishReason: null,
          latencyMs: 0,
          sanitizedError: "canned",
          transport: { outcome: "canned" },
          providerFailureCode: null,
        },
      } as never;
    },
    narrowRepair: async (subject, plan, attempt) => {
      seen.repair.push({ subject, plan, attempt });
      return { kind: "transport_failed", evidence: {} } as never;
    },
    broadReview: async (args) => {
      seen.broad.push(args);
      return { kind: "canned", parsed: null } as never;
    },
  };
  return { deps, seen };
}

describe("frozen reviewer replay — phase 1 seam", () => {
  it("A. loads the exact Run-4 frozen subject and reproduces its scenario digest", () => {
    const s = loadFrozenSubject(RUN4, RUN4_SHA);
    expect(s.artifactSha256).toBe(RUN4_SHA);
    expect(s.scenarioSha256).toBe(RUN4_SCENARIO_DIGEST);
    expect(scenarioDigest(s.draft)).toBe(RUN4_SCENARIO_DIGEST);
    expect(s.fixtureId).toBe("c18-constrained-clinical");
    expect(Object.keys(s.constructions)).toHaveLength(14);
  });

  it("B. never invokes Plan, Render or any generation function", async () => {
    const { deps } = cannedDeps();
    await runFrozenReviewerReplay({ subject: loadFrozenSubject(RUN4, RUN4_SHA), deps });
    expect(mockCreate).not.toHaveBeenCalled();

    // Structural: the harness source must not reference a generation entrypoint at all.
    const src = readFileSync(resolve(ROOT, "scripts/practice-frozen-reviewer-replay.ts"), "utf8");
    expect(src).not.toContain("generateArenaScenarioDraft");
    expect(src).not.toContain("generatePlan");
    expect(src).not.toContain("generateWithLlm");
  });

  it("C. the narrow reviewer subject carries acceptedCost and never boundaryCompliance", () => {
    const s = loadFrozenSubject(RUN4, RUN4_SHA);
    const a = deriveReplayAuthority(s.fixtureId);
    const subject = buildReplayNarrowSubject(s, a);
    const serialized = JSON.stringify(subject);
    expect(serialized).not.toContain("boundaryCompliance");
    expect(serialized).toContain("acceptedCost");
  });

  it("D. the broad reviewer request carries the complete frozen construction, claim included", () => {
    const s = loadFrozenSubject(RUN4, RUN4_SHA);
    const a = deriveReplayAuthority(s.fixtureId);
    const req = buildReplayBroadRequest(s, a);
    expect(req.visibleChoices).toHaveLength(14);
    for (const c of req.visibleChoices) {
      const k = c.construction as { boundaryCompliance?: string[] };
      expect(k.boundaryCompliance).toEqual([CONFIRMED_ID]);
    }
  });

  it("E. narrow and broad consume one replay-local identity from a single frozen load", async () => {
    const s = loadFrozenSubject(RUN4, RUN4_SHA);
    const { deps, seen } = cannedDeps();
    const r = await runFrozenReviewerReplay({ subject: s, deps });
    expect(r.subjectIdentity.artifactSha256).toBe(RUN4_SHA);
    expect(r.subjectIdentity.scenarioSha256).toBe(RUN4_SCENARIO_DIGEST);
    const narrowSubject = (seen.narrow[0] as { subject: { scenarioSha256: string } }).subject;
    expect(narrowSubject.scenarioSha256).toBe(r.subjectIdentity.scenarioSha256);
    if (seen.broad.length > 0) {
      const b = seen.broad[0] as { subject: { sha256: string } };
      expect(b.subject.sha256).toBe(r.subjectIdentity.replaySubjectSha256);
    }
  });

  it("F. canned reviewer output preserves every evidence field the existing parsers produce", () => {
    const s = loadFrozenSubject(RUN4, RUN4_SHA);
    const choices = enumerateChoices(s.draft);

    // Start from the TRACKED accept fixture so the review is valid by construction, then make the
    // reviewer DISPUTE one construction and flag it — the observation path this replay exists for.
    const base = acceptReview(s.draft, {}, [CONFIRMED_ID]) as unknown as Record<string, unknown>;
    const phaseChoices = (base.phaseChoices as Array<Record<string, unknown>>).map((p, i) =>
      i === 1
        ? { ...p, constructionAgrees: false, constructionDispute: "the action breaks the rule it claims to obey", defectCodes: ["commitment_flag_mismatch"] }
        : p,
    );
    const canned = { ...base, phaseChoices };

    const parsed = validateSemanticReview(canned, {
      primaryCount: s.draft.primary.choices.length,
      branchCount: Object.keys(s.draft.branches ?? {}).length,
      constraintIds: [CONFIRMED_ID],
      choices,
    });
    expect(parsed.ok).toBe(true);
    const v = parsed.value as unknown as Record<string, unknown>;
    for (const k of ["boundaryCompliant", "boundaryAssessments", "overallVerdict", "defectCodes", "phaseChoices"]) {
      expect(v[k]).toBeDefined();
    }
    const pcs = v.phaseChoices as Array<{ constructionAgrees?: boolean; constructionDispute?: string; defectCodes: string[] }>;
    expect(pcs).toHaveLength(choices.length);
    expect(pcs.some((p) => p.constructionAgrees === false)).toBe(true);
    expect(pcs.some((p) => (p.constructionDispute ?? "").length > 0)).toBe(true);
    expect(pcs.some((p) => p.defectCodes.includes("commitment_flag_mismatch"))).toBe(true);
  });

  it("G. replay accounting is inert: no sequence allocation, no DB recorder, no submission accounting", async () => {
    const { deps } = cannedDeps();
    const r = await runFrozenReviewerReplay({ subject: loadFrozenSubject(RUN4, RUN4_SHA), deps });
    expect(r.accountingMode).toBe("inert");
    const src = readFileSync(resolve(ROOT, "scripts/practice-frozen-reviewer-replay.ts"), "utf8");
    expect(src).not.toContain("generationCallSequence");
    expect(src).not.toContain("GenerationAccounting");
    expect(src).not.toContain("recorder");
  });

  it("H. a wrong artifact sha refuses before any reviewer is invoked", async () => {
    const wrong = "0".repeat(64);
    expect(() => loadFrozenSubject(RUN4, wrong)).toThrow(/sha/i);
    const { seen } = cannedDeps();
    expect(seen.narrow).toHaveLength(0);
    expect(seen.broad).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("I. production broadReviewAllowed is computed and broad rows are markable OFF_PIPELINE", async () => {
    for (const [path, sha] of [[RUN4, RUN4_SHA], [RUN5, RUN5_SHA]] as const) {
      const { deps } = cannedDeps();
      const r = await runFrozenReviewerReplay({ subject: loadFrozenSubject(path, sha), deps });
      expect(typeof r.broadReviewAllowed).toBe("boolean");
      expect(r.rows.every((row) => row.mode === "REPLAY")).toBe(true);
      const broadRows = r.rows.filter((row) => row.stage === "broad");
      if (!r.broadReviewAllowed) {
        expect(broadRows.every((row) => row.pipeline === "OFF_PIPELINE")).toBe(true);
      }
    }
  });

  it("J. reviewConstraintCompliance body is byte-identical; only its export token may change", () => {
    const svc = readFileSync(
      resolve(ROOT, "src/lib/bty/foundry/arena/arenaScenarioGenerationService.ts"),
      "utf8",
    ).split("\n");
    const decl = svc.findIndex((l) => /^(export )?async function reviewConstraintCompliance\(/.test(l));
    expect(decl).toBeGreaterThan(-1);
    const end = svc.findIndex((l, i) => i > decl && l === "}");
    const body = svc.slice(decl + 1, end + 1).join("\n") + "\n";
    expect(createHash("sha256").update(body).digest("hex")).toBe(BODY_SHA_PRE);
    expect(svc[decl]).toMatch(/^(export )?async function reviewConstraintCompliance\($/);
  });

  it("K. output is confined to the replay root and phase 1 writes nothing", async () => {
    expect(REPLAY_OUTPUT_ROOT).toBe(".eval-artifacts/reviewer-replay-01");
    const { deps } = cannedDeps();
    await runFrozenReviewerReplay({ subject: loadFrozenSubject(RUN4, RUN4_SHA), deps });
    expect(existsSync(resolve(ROOT, REPLAY_OUTPUT_ROOT))).toBe(false);
  });
});
