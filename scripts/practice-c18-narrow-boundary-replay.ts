#!/usr/bin/env npx tsx
/**
 * NARROW BOUNDARY-ONLY c18 REPLAY (Slice 3.2I-R5B1A.1-R2.29).
 *
 * ONE reconstructed c18 subject, ONE narrow boundary-review call in the normal path, ZERO generation
 * calls and ZERO broad semantic-review calls. It asks the question R2.28 proved the broad reviewer
 * could not answer structurally: does EVERY decision surface — including both resulting world states
 * — comply with `c1_verify`?
 *
 * The verdict is derived by the SERVER from per-surface evidence. A pass here is a reviewer
 * measurement, never a product-quality pass.
 *
 * PREPARED, NOT EXECUTED in R2.29.
 *
 *   BTY_C18_NARROW_MOCK=1 npx tsx scripts/practice-c18-narrow-boundary-replay.ts \
 *     --replay-run-id <id> --artifact-dir <dir> [--mock-outcome pass|reject|...]
 */
import { join } from "node:path";
import { writeReplayArtifact, BOUNDARY_REPLAY_ARTIFACT_KIND } from "@/lib/bty/foundry/arena/replayArtifact";
import { runBoundaryReviewStage, type BoundaryStageResult } from "@/lib/bty/foundry/arena/boundaryReviewStage";
import { buildNarrowBoundaryRequest, narrowBoundarySubjectSha256, type NarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import type { NarrowBoundaryCallResult } from "@/lib/bty/foundry/arena/narrowBoundaryReviewer";
import { boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { canonicalJson, subjectDigests } from "@/domain/foundry/arena-draft/reviewSubject";
import { deriveBoundaryVerdict } from "@/domain/foundry/arena-draft/narrowBoundaryReview";
import { enumerateBoundarySurfaces } from "@/domain/foundry/arena-draft/boundarySurfaces";
import { RECONSTRUCTION_DISCLAIMER } from "@/lib/bty/foundry/arena/historicalBoundaryReconstruction";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { buildC18Subject, CASE_ID, SOURCE_ARTIFACT, SOURCE_ARTIFACT_SHA256, SOURCE_ATTEMPT_INDEX } from "./practice-c18-boundary-replay";

const MOCK_ENV = "BTY_C18_NARROW_MOCK";
export const NARROW_REPLAY_ARTIFACT_VERSION = "practice-narrow-boundary-replay/1";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

export type NarrowReplayDeps = {
  review: (subject: NarrowBoundarySubject, attempt: number) => Promise<NarrowBoundaryCallResult>;
  writeArtifact: (payload: string, subjectSha: string) => { path: string; sha256: string; bytes: number };
  log?: (line: string) => void;
};

export type NarrowReplaySummary = {
  outcome: BoundaryStageResult["outcome"];
  calls: number;
  reruns: number;
  artifactPath: string | null;
  artifactSha256: string | null;
  boundaryReviewSubjectSha256: string | null;
};

/**
 * Run the boundary-only replay over the ONE reconstructed c18 subject.
 *
 * Exported so the mock proof executes the EXACT program a live run would, with only the provider
 * seam replaced — a mock that runs different code proves nothing about the live path.
 */
export async function runC18NarrowBoundaryReplay(
  deps: NarrowReplayDeps,
  repoRoot: string,
  evidenceDir: string,
  replayRunId: string,
  mode: "mock" | "live",
): Promise<NarrowReplaySummary> {
  const log = deps.log ?? (() => undefined);
  const broad = buildC18Subject(repoRoot, evidenceDir);
  const subject = broad.subject;
  const provenance = subject.boundaryProvenance!;
  const provenanceSha = boundaryProvenanceSha256(provenance);
  const digests = subjectDigests(subject);

  const stage = await runBoundaryReviewStage(
    { review: deps.review, log: (outcome, code, extra) => log(`${outcome}${code ? ` code=${code}` : ""} ${canonicalJson(extra)}`) },
    {
      draft: subject.scenario as ArenaScenarioDraft,
      // The reconstructed subject carries no generator construction records, and none are invented.
      constructions: {},
      boundaries: subject.confirmedBoundaries,
      boundaryProvenance: provenance,
      boundaryProvenanceSha256: provenanceSha,
      scenarioSha256: subject.scenarioSha256,
      reviewSubjectSha256: digests.reviewSubjectSha256,
      language: subject.language,
      generationAttemptId: subject.generationAttemptId,
      caseId: CASE_ID,
    },
  );

  // The artifact carries the complete evidence chain, never just the outcome label.
  const payload = JSON.stringify(
    {
      artifactVersion: NARROW_REPLAY_ARTIFACT_VERSION,
      mode,
      replayRunId,
      sourceRunId: broad.sourceRunId,
      sourcePassId: broad.sourcePassId,
      sourceCaseId: broad.sourceCaseId,
      sourceAttemptIndex: SOURCE_ATTEMPT_INDEX,
      sourceArtifactFile: SOURCE_ARTIFACT,
      sourceArtifactSha256: SOURCE_ARTIFACT_SHA256,
      reconstructionDisclaimer: RECONSTRUCTION_DISCLAIMER,
      productQualityPass: null,
      productQualityAuthority: "human_only",
      subjectDigests: digests,
      boundaryProvenance: provenance,
      activeBoundaryIds: subject.activeBoundaryIds,
      boundaryReviewSubjectSha256: stage.boundaryReviewSubjectSha256,
      surfaceMapSha256: stage.surfaceMapSha256,
      surfaces: stage.subject?.surfaces ?? [],
      request: stage.subject ? buildNarrowBoundaryRequest(stage.subject) : null,
      boundaryReviewOutcome: stage.outcome,
      boundaryReviewCalls: stage.calls,
      boundaryReviewReruns: stage.reruns,
      boundaryReviewEvidence: stage.evidences,
      violations: stage.violations,
      uncertainties: stage.uncertainties,
      findings: stage.findings,
      authorityCodes: stage.codes,
      broadReviewStarted: false,
      broadReviewAllowed: stage.broadReviewAllowed,
      generationCallCount: 0,
      broadReviewCallCount: 0,
    },
    null,
    2,
  );
  const written = deps.writeArtifact(payload, stage.boundaryReviewSubjectSha256 ?? digests.reviewSubjectSha256);

  return {
    outcome: stage.outcome,
    calls: stage.calls,
    reruns: stage.reruns,
    artifactPath: written.path,
    artifactSha256: written.sha256,
    boundaryReviewSubjectSha256: stage.boundaryReviewSubjectSha256,
  };
}

/** Deterministic mock responses. Never a network call; used only by the mock proof and `--mock`. */
export function mockNarrowReview(kind: string, subject: NarrowBoundarySubject, attempt: number): NarrowBoundaryCallResult {
  const surfaces = subject.surfaces;
  const b = subject.boundaries[0]!;
  const complies = surfaces.map((s) => ({
    boundaryId: b.id,
    surfaceRef: s.coordinate,
    result: "complies" as const,
    evidenceExcerpt: s.text.slice(0, 100),
    reason: "keeps the rule",
  }));
  const withViolation = (ref: string) =>
    complies.map((a) => (a.surfaceRef === ref ? { ...a, result: "violates" as const, reason: "proceeds without the check" } : a));

  let parsed: unknown;
  switch (kind) {
    case "reject":
      parsed = { assessments: withViolation("primary[1]") };
      break;
    case "malformed":
      parsed = { assessments: complies.slice(1) };
      break;
    default:
      parsed = { assessments: complies };
  }
  const verdict = deriveBoundaryVerdict(parsed, { boundaries: subject.boundaries, surfaces });
  return {
    kind: "derived",
    verdict,
    evidence: {
      boundaryReviewAttempt: attempt,
      boundaryReviewSubjectSha256: narrowBoundarySubjectSha256(subject),
      surfaceMapSha256: subject.surfaceMapSha256,
      activeBoundaryIds: subject.activeBoundaryIds,
      requiredAssessmentCount: subject.boundaries.length * surfaces.length,
      parsed,
      outcome: verdict.outcome,
      verdict,
      finishReason: "stop",
      latencyMs: 0,
      sanitizedError: null,
    },
  };
}

async function main(): Promise<void> {
  const useMock = process.env[MOCK_ENV] === "1";
  const replayRunId = arg("replay-run-id");
  const dir = arg("artifact-dir");
  const evidenceDir = arg("evidence-dir", join(process.cwd(), ".eval-artifacts"));
  const mode: "mock" | "live" = useMock ? "mock" : "live";

  const broad = buildC18Subject(process.cwd(), evidenceDir);
  const surfaces = enumerateBoundarySurfaces(broad.subject.scenario as ArenaScenarioDraft, {});
  process.stdout.write(`${RECONSTRUCTION_DISCLAIMER}\n`);
  process.stdout.write(`ACTIVE BOUNDARY: ${broad.subject.activeBoundaryIds.join(",")}\n`);
  process.stdout.write(`BOUNDARY TEXT:   ${broad.subject.confirmedBoundaries.map((b) => b.statement).join(" | ")}\n`);
  process.stdout.write(`DECISION SURFACES (${surfaces.length}):\n${surfaces.map((s) => `  ${s.coordinate}`).join("\n")}\n`);

  const summary = await runC18NarrowBoundaryReplay(
    {
      review: async (s, a) => {
        if (useMock) return mockNarrowReview(arg("mock-outcome", "pass"), s, a);
        const { reviewBoundarySurfaces } = await import("@/lib/bty/foundry/arena/narrowBoundaryReviewer");
        return reviewBoundarySurfaces(s, a);
      },
      writeArtifact: (payload, subjectSha) =>
        writeReplayArtifact(
          dir,
          { mode, replayRunId, sourcePassId: "pass2", sourceCaseId: CASE_ID, sourceAttemptIndex: SOURCE_ATTEMPT_INDEX, reviewSubjectSha256: subjectSha },
          payload,
          BOUNDARY_REPLAY_ARTIFACT_KIND,
        ),
      log: (line) => process.stdout.write(`${line}\n`),
    },
    process.cwd(),
    evidenceDir,
    replayRunId,
    mode,
  );

  if (useMock) process.stdout.write("C18 NARROW BOUNDARY REPLAY MOCK · LIVE PROVIDER NOT CALLED\n");
  process.stdout.write(`OUTCOME: ${summary.outcome}\nCALLS: ${summary.calls}\nRERUNS: ${summary.reruns}\n`);
  process.stdout.write(`ARTIFACT: ${summary.artifactPath} ${summary.artifactSha256}\n`);
  process.stdout.write("A PASS IS A REVIEWER MEASUREMENT · NEVER A PRODUCT-QUALITY PASS\n");
  if (summary.outcome === "boundary_reviewer_terminal_failure" || summary.outcome === "boundary_review_authority_failure") process.exitCode = 4;
}

const invokedDirectly = (process.argv[1] ?? "").endsWith("practice-c18-narrow-boundary-replay.ts");
if (invokedDirectly) {
  void main().catch((error: unknown) => {
    process.stderr.write(`C18 NARROW BOUNDARY REPLAY FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
    process.exitCode = 1;
  });
}
