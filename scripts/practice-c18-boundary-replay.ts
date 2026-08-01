#!/usr/bin/env npx tsx
/**
 * CORRECTED-BOUNDARY REVIEWER REPLAY (Slice 3.2I-R5B1A.1-R2.27).
 *
 * ONE frozen c18 subject, ONE reviewer call, ZERO generation calls — this time with the confirmed
 * two-identifier boundary actually present. It asks the question R2.26 proved was never asked.
 *
 * A consistent accept here means the REVIEWER accepted with the rule in front of it. That is a
 * reviewer measurement, never a product-quality pass.
 *
 *   BTY_C18_REPLAY_MOCK=1 npx tsx scripts/practice-c18-boundary-replay.ts \
 *     --replay-run-id <id> --artifact-dir <dir> [--mock-outcome accept|reject|contradiction|...]
 */
import { join } from "node:path";
import { runReviewReplay, replayTerminalLabel, type ReplayDeps, type ReplayReviewResult, type ReplaySubject } from "@/lib/bty/foundry/arena/reviewReplay";
import { writeReplayArtifact } from "@/lib/bty/foundry/arena/replayArtifact";
import { buildReviewSubjectContract } from "@/lib/bty/foundry/arena/reviewSubjectContract";
import { assertReviewBoundaryAuthority, boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { canonicalJson, scenarioDigest, subjectDigests, type ReviewSubject } from "@/domain/foundry/arena-draft/reviewSubject";
import { PRACTICE_SAMPLING } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";
import {
  RECONSTRUCTION_DISCLAIMER,
  extractFromArtifactCorrectionPacket,
  extractFromCorpus,
  reconstructHistoricalProvenance,
} from "@/lib/bty/foundry/arena/historicalBoundaryReconstruction";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MOCK_ENV = "BTY_C18_REPLAY_MOCK";
export const CORPUS = "src/lib/bty/foundry/arena/practice-generation.eval.ts";
export const CASE_ID = "c18-constrained-clinical";
export const SOURCE_ARTIFACT = "practice-generation.stability.live.20260801T024949Z.pass2.c18-constrained-clinical.341c20e95a5e.d816a3dc62df.json";
export const SOURCE_ARTIFACT_SHA256 = "7f5292f32f05c5051700c4ac5fd4d556c1e905b8b9d069536f9412cdae8d79cb";
export const SOURCE_ATTEMPT_INDEX = 2;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

/** Build the ONE reconstructed subject, or refuse. Exported so the runner and tests share it. */
export function buildC18Subject(repoRoot: string, evidenceDir: string): ReplaySubject {
  const provenance = reconstructHistoricalProvenance({
    sources: [
      extractFromCorpus(join(repoRoot, CORPUS), CASE_ID),
      extractFromArtifactCorrectionPacket(join(evidenceDir, SOURCE_ARTIFACT)),
    ],
    sourceReference: `${SOURCE_ARTIFACT}#attempt${SOURCE_ATTEMPT_INDEX}`,
  });

  const raw = readFileSync(join(evidenceDir, SOURCE_ARTIFACT), "utf8");
  const artifactSha = createHash("sha256").update(raw).digest("hex");
  if (artifactSha !== SOURCE_ARTIFACT_SHA256) throw new Error(`source artifact digest mismatch: ${artifactSha}`);
  const body = JSON.parse(raw) as { attempts: Array<{ scenario?: unknown }> };
  const scenario = body.attempts[SOURCE_ATTEMPT_INDEX]?.scenario;
  if (scenario === undefined) throw new Error("no captured scenario at the source attempt");

  const subject: ReviewSubject = {
    scenario,
    scenarioSha256: scenarioDigest(scenario),
    generationAttemptId: `pass2/${CASE_ID}#${SOURCE_ATTEMPT_INDEX}`,
    caseId: CASE_ID,
    boundaryProvenance: provenance,
    confirmedBoundaries: provenance.confirmedBoundaries.map((b) => ({ id: b.id, statement: b.statement })),
    activeBoundaryIds: provenance.activeBoundaryIds,
    language: "ko",
    generationModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
    generationSampling: PRACTICE_SAMPLING.generation,
    generationFinishReason: null,
    canonicalValidatorResult: null,
    deterministicGateResult: null,
    reviewContractSha256: buildReviewSubjectContract().sha256,
  };

  // FAIL CLOSED before anything else: a boundary-bearing subject with no rules never gets reviewed.
  const authority = assertReviewBoundaryAuthority(provenance, boundaryProvenanceSha256(provenance));
  if (!authority.ok) throw new Error(`boundary authority refused the subject: ${authority.codes.join(",")}`);

  return {
    sourceRunId: "20260801T024949Z",
    sourcePassId: "pass2",
    sourceCaseId: CASE_ID,
    sourceAttemptIndex: SOURCE_ATTEMPT_INDEX,
    sourceArtifactFile: SOURCE_ARTIFACT,
    sourceArtifactSha256: SOURCE_ARTIFACT_SHA256,
    subject,
    triggeringErrors: ["review_verdict_contradicts_details"],
  };
}

function mockReview(kind: string): ReplayReviewResult {
  switch (kind) {
    case "reject":
      return { kind: "reject", parsed: { overallVerdict: "reject", boundaryIdsConsidered: ["c1_verify"] }, overallVerdict: "reject", derivedDefects: ["choice_bypasses_boundary"], finishReason: "stop" };
    case "contradiction":
      return { kind: "contradiction", parsed: { overallVerdict: "accept", boundaryIdsConsidered: ["c1_verify"] }, overallVerdict: "accept", derivedDefects: ["confirmed_boundary_absent"], errors: ["review_verdict_contradicts_details"], finishReason: "stop" };
    case "provider_failure":
      return { kind: "transport_failed", sanitizedError: "mock_transport_failure" };
    case "schema_failure":
      return { kind: "malformed", errors: ["review_truncated"], finishReason: "length" };
    default:
      return { kind: "ok", parsed: { overallVerdict: "accept", boundaryIdsConsidered: ["c1_verify"] }, overallVerdict: "accept", derivedDefects: [], finishReason: "stop" };
  }
}

async function main(): Promise<void> {
  const useMock = process.env[MOCK_ENV] === "1";
  const replayRunId = arg("replay-run-id");
  const dir = arg("artifact-dir");
  const evidenceDir = arg("evidence-dir", join(process.cwd(), ".eval-artifacts"));
  const subject = buildC18Subject(process.cwd(), evidenceDir);
  const digests = subjectDigests(subject.subject);

  process.stdout.write(`${RECONSTRUCTION_DISCLAIMER}\n`);
  process.stdout.write(`ACTIVE BOUNDARY: ${subject.subject.activeBoundaryIds.join(",")}\n`);
  process.stdout.write(`BOUNDARY TEXT:   ${subject.subject.confirmedBoundaries.map((b) => b.statement).join(" | ")}\n`);
  process.stdout.write(`${canonicalJson(digests)}\n`);

  const deps: ReplayDeps = {
    review: async (s) => {
      if (useMock) return mockReview(arg("mock-outcome", "accept"));
      const { reviewFrozenSubject } = await import("@/lib/bty/foundry/arena/reviewFrozenSubject");
      return reviewFrozenSubject(s);
    },
    now: () => Date.now(),
    writeArtifact: (id, payload) => {
      // The artifact carries the boundary evidence, never just the outcome label.
      const enriched = JSON.stringify(
        { ...JSON.parse(payload), boundaryProvenance: subject.subject.boundaryProvenance, activeBoundaryIds: subject.subject.activeBoundaryIds, subjectDigests: digests, reconstructionDisclaimer: RECONSTRUCTION_DISCLAIMER },
        null,
        2,
      );
      return writeReplayArtifact(dir, { mode: useMock ? "mock" : "live", replayRunId, sourcePassId: id.sourcePassId, sourceCaseId: id.sourceCaseId, sourceAttemptIndex: id.sourceAttemptIndex, reviewSubjectSha256: id.reviewSubjectSha256 }, enriched);
    },
    log: (line) => process.stdout.write(`${line}\n`),
  };

  const summary = await runReviewReplay(deps, replayRunId, [subject]);
  if (useMock) process.stdout.write("C18 BOUNDARY REPLAY MOCK · LIVE PROVIDER NOT CALLED\n");
  process.stdout.write(`${replayTerminalLabel(summary).join("\n")}\n`);
  if (summary.outcomes.provider_failure > 0 || summary.outcomes.schema_failure > 0 || summary.outcomes.subject_digest_mismatch > 0) process.exitCode = 4;
}

// Run ONLY when invoked directly. The runner builder imports `buildC18Subject` from this module,
// and an unguarded main() would fire during that import and fail on the missing CLI arguments.
const invokedDirectly = (process.argv[1] ?? "").endsWith("practice-c18-boundary-replay.ts");
if (invokedDirectly) {
  void main().catch((error: unknown) => {
    process.stderr.write(`C18 BOUNDARY REPLAY FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
    process.exitCode = 1;
  });
}
