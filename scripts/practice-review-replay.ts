#!/usr/bin/env npx tsx
/**
 * REVIEWER-ONLY REPLAY (Slice 3.2I-R5B1A.1-R2.25).
 *
 * Reviews four FROZEN historical scenarios once each and writes one immutable artifact per subject.
 * It asks only: does a fresh review of the identical subject reach an internally consistent verdict?
 *
 * It never generates a scenario. `runReviewReplay` receives a `review` dependency and nothing else,
 * and this file imports no generation function — a generation call is unreachable, not merely
 * forbidden.
 *
 *   BTY_REVIEW_REPLAY_MOCK=1 npx tsx scripts/practice-review-replay.ts --replay-run-id <id> \
 *     --artifact-dir <dir> [--mock-plan accept,reject,contradiction,provider_failure]
 *
 * Mock mode is available to the test harness only; the live path requires a credential.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  runReviewReplay,
  replayTerminalLabel,
  type ReplayDeps,
  type ReplayReviewResult,
  type ReplaySubject,
} from "@/lib/bty/foundry/arena/reviewReplay";
import { writeReplayArtifact } from "@/lib/bty/foundry/arena/replayArtifact";
import { buildReviewSubjectContract } from "@/lib/bty/foundry/arena/reviewSubjectContract";
import { canonicalJson, scenarioDigest, type ReviewSubject } from "@/domain/foundry/arena-draft/reviewSubject";
import { noBoundaryProvenance, type BoundaryReviewProvenance } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { PRACTICE_SAMPLING } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";

const MOCK_ENV = "BTY_REVIEW_REPLAY_MOCK";
const FIXTURE = "src/lib/bty/foundry/arena/fixtures/r225-reviewer-contradiction-subjects.json";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

type FixtureSubject = {
  sourceRunId: string;
  sourcePassId: string;
  sourceCaseId: string;
  sourceAttemptIndex: number;
  sourceArtifactFile: string;
  sourceArtifactSha256: string;
  liveScenarioSha256: string;
  redactedScenarioStructure: unknown;
  triggeringErrors: string[];
  /** R2.27 — declared per subject. `bearing` without persisted rules is refused, never reviewed. */
  boundaryMode?: "none" | "bearing";
  boundaryProvenanceAvailable?: boolean;
};

/**
 * Build the frozen subjects.
 *
 * In LIVE mode the real scenario is read from the untracked immutable artifact and verified against
 * the fixture's `liveScenarioSha256` — the repository carries digests and structure, never the
 * learner-facing prose. In MOCK mode the redacted structure is used, which is enough to prove the
 * program, and is labelled as such in every artifact by `mode`.
 */
function buildSubjects(useMock: boolean, evidenceDir: string): ReplaySubject[] {
  const doc = JSON.parse(readFileSync(join(process.cwd(), FIXTURE), "utf8")) as { subjects: FixtureSubject[]; head: string; contractManifestSha256: string };
  const contract = buildReviewSubjectContract();

  return doc.subjects.map((f) => {
    let scenario: unknown = f.redactedScenarioStructure;
    if (!useMock) {
      const raw = readFileSync(join(evidenceDir, f.sourceArtifactFile), "utf8");
      const artifactSha = createHash("sha256").update(raw).digest("hex");
      if (artifactSha !== f.sourceArtifactSha256) {
        throw new Error(`source artifact digest mismatch for ${f.sourceArtifactFile}`);
      }
      const body = JSON.parse(raw) as { attempts: Array<{ scenario?: unknown }> };
      scenario = body.attempts[f.sourceAttemptIndex]?.scenario;
      if (scenario === undefined) throw new Error(`no captured scenario at ${f.sourcePassId}/${f.sourceCaseId}#${f.sourceAttemptIndex}`);
      if (scenarioDigest(scenario) !== f.liveScenarioSha256) {
        throw new Error(`frozen scenario digest mismatch for ${f.sourcePassId}/${f.sourceCaseId}#${f.sourceAttemptIndex}`);
      }
    }
    // R2.27 — a subject declared boundary-bearing whose rules were never persisted gets NO
    // provenance, and the replay authority refuses it before any provider call.
    const provenance: BoundaryReviewProvenance | null =
      f.boundaryMode === "bearing" && f.boundaryProvenanceAvailable !== true
        ? null
        : noBoundaryProvenance(`fixture:${f.sourceCaseId}`, createHash("sha256").update(f.liveScenarioSha256).digest("hex"));

    const subject: ReviewSubject = {
      scenario,
      scenarioSha256: scenarioDigest(scenario),
      boundaryProvenance: provenance,
      generationAttemptId: `${f.sourcePassId}/${f.sourceCaseId}#${f.sourceAttemptIndex}`,
      caseId: f.sourceCaseId,
      confirmedBoundaries: [],
      activeBoundaryIds: [],
      language: "ko",
      generationModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
      generationSampling: PRACTICE_SAMPLING.generation,
      generationFinishReason: null,
      canonicalValidatorResult: null,
      deterministicGateResult: null,
      reviewContractSha256: contract.sha256,
    };
    return {
      sourceRunId: f.sourceRunId,
      sourcePassId: f.sourcePassId,
      sourceCaseId: f.sourceCaseId,
      sourceAttemptIndex: f.sourceAttemptIndex,
      sourceArtifactFile: f.sourceArtifactFile,
      sourceArtifactSha256: f.sourceArtifactSha256,
      subject,
      triggeringErrors: f.triggeringErrors,
    };
  });
}

/** Deterministic mock transport. Never a network call. */
function mockReview(plan: string[], i: { n: number }): ReplayReviewResult {
  const step = plan[i.n % plan.length];
  i.n += 1;
  switch (step) {
    case "reject":
      return { kind: "reject", parsed: { overallVerdict: "reject" }, overallVerdict: "reject", derivedDefects: ["vague_reassurance"], finishReason: "stop" };
    case "contradiction":
      return { kind: "contradiction", parsed: { overallVerdict: "accept" }, overallVerdict: "accept", derivedDefects: ["unsafe_delay"], errors: ["review_verdict_contradicts_details"], finishReason: "stop" };
    case "provider_failure":
      return { kind: "transport_failed", sanitizedError: "mock_transport_failure" };
    case "schema_failure":
      return { kind: "malformed", errors: ["review_truncated"], finishReason: "length" };
    default:
      return { kind: "ok", parsed: { overallVerdict: "accept" }, overallVerdict: "accept", derivedDefects: [], finishReason: "stop" };
  }
}

async function main(): Promise<void> {
  const useMock = process.env[MOCK_ENV] === "1";
  const replayRunId = arg("replay-run-id");
  const dir = arg("artifact-dir");
  const evidenceDir = arg("evidence-dir", join(process.cwd(), ".eval-artifacts"));
  const plan = arg("mock-plan", "accept,reject,contradiction,provider_failure").split(",").map((s) => s.trim());
  const counter = { n: 0 };

  const subjects = buildSubjects(useMock, evidenceDir);

  const deps: ReplayDeps = {
    review: async (subject) => {
      if (useMock) return mockReview(plan, counter);
      // LIVE: one structured review call over the frozen subject. Deliberately not implemented as a
      // generation call — this program has no generation dependency to reach.
      const { reviewFrozenSubject } = await import("@/lib/bty/foundry/arena/reviewFrozenSubject");
      return reviewFrozenSubject(subject);
    },
    now: () => Date.now(),
    writeArtifact: (id, payload) =>
      writeReplayArtifact(dir, { mode: useMock ? "mock" : "live", replayRunId, sourcePassId: id.sourcePassId, sourceCaseId: id.sourceCaseId, sourceAttemptIndex: id.sourceAttemptIndex, reviewSubjectSha256: id.reviewSubjectSha256 }, payload),
    log: (line) => process.stdout.write(`${line}\n`),
  };

  const summary = await runReviewReplay(deps, replayRunId, subjects);
  if (useMock) process.stdout.write("REVIEWER REPLAY MOCK · LIVE PROVIDER NOT CALLED\n");
  process.stdout.write(`${replayTerminalLabel(summary).join("\n")}\n`);
  process.stdout.write(`${canonicalJson({ outcomes: summary.outcomes, artifacts: summary.artifacts.length, generationCallCount: summary.generationCallCount, reviewCallCount: summary.reviewCallCount })}\n`);
  if (summary.outcomes.subject_digest_mismatch > 0 || summary.outcomes.provider_failure > 0 || summary.outcomes.schema_failure > 0) process.exitCode = 4;
}

void main().catch((error: unknown) => {
  process.stderr.write(`REVIEWER REPLAY FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
  process.exitCode = 1;
});
