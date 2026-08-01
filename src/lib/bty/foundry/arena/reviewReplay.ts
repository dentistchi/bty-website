/**
 * REVIEWER-ONLY REPLAY (Slice 3.2I-R5B1A.1-R2.25).
 *
 * THE QUESTION IT ASKS
 *
 * Given a frozen scenario that the reviewer once voted `accept` on while its own detail fields
 * derived defects — does a fresh review of the IDENTICAL subject produce an internally consistent
 * verdict?
 *
 * That is the only question. It never asks the model to rewrite or improve anything, and it cannot:
 * this module imports no generation function, and the only provider call it can make is the review
 * call injected as `review`. A generation call is not merely forbidden here, it is unreachable.
 *
 * WHAT A CONSISTENT ACCEPT DOES NOT MEAN
 *
 * It means the REVIEWER recovered. It says nothing about whether the scenario is good — the c18
 * evidence has the reviewer voting `accept` on a scenario that left a patient unverified against a
 * confirmed two-identifier boundary. Product quality stays human-only, and this module never emits
 * a quality verdict.
 *
 * Every dependency is injected, so the exact program the runner executes is provable against mocks.
 */

import { canRerunOverSubject, reviewSubjectSha256, scenarioDigest, type ReviewSubject } from "@/domain/foundry/arena-draft/reviewSubject";
import { isContradiction } from "@/domain/foundry/arena-draft/reviewRerun";

/** One historical reviewer-malformed attempt, frozen. */
export type ReplaySubject = {
  /** Provenance — where this frozen subject came from. */
  sourceRunId: string;
  sourcePassId: string;
  sourceCaseId: string;
  sourceAttemptIndex: number;
  sourceArtifactFile: string;
  sourceArtifactSha256: string;
  /** The frozen subject itself. */
  subject: ReviewSubject;
  /** The historical response that triggered the replay. Evidence only — never re-sent. */
  triggeringErrors: string[];
};

export const REPLAY_OUTCOMES = [
  "consistent_accept",
  "consistent_reject",
  "repeated_contradiction",
  "provider_failure",
  "schema_failure",
  "subject_digest_mismatch",
] as const;

export type ReplayOutcome = (typeof REPLAY_OUTCOMES)[number];

/** What a single review call can report back. Mirrors the service's review outcome kinds. */
export type ReplayReviewResult =
  | { kind: "ok"; parsed: unknown; overallVerdict: string; derivedDefects: string[]; finishReason: string | null }
  | { kind: "reject"; parsed: unknown; overallVerdict: string; derivedDefects: string[]; finishReason: string | null }
  | { kind: "contradiction"; parsed: unknown; overallVerdict: string | null; derivedDefects: string[]; errors: string[]; finishReason: string | null }
  | { kind: "malformed"; errors: string[]; finishReason: string | null }
  | { kind: "transport_failed"; sanitizedError: string };

export type ReplayDeps = {
  /**
   * The ONLY provider call available. It takes a frozen subject and returns a structured review.
   * There is deliberately no generation dependency in this type.
   */
  review: (subject: ReviewSubject) => Promise<ReplayReviewResult>;
  now: () => number;
  writeArtifact: (identity: ReplayArtifactIdentity, payload: string) => { path: string; sha256: string; bytes: number };
  log: (line: string) => void;
};

export type ReplayArtifactIdentity = {
  replayRunId: string;
  sourcePassId: string;
  sourceCaseId: string;
  sourceAttemptIndex: number;
  reviewSubjectSha256: string;
};

export type ReplayCaseResult = {
  outcome: ReplayOutcome;
  sourceRunId: string;
  sourcePassId: string;
  sourceCaseId: string;
  sourceAttemptIndex: number;
  sourceArtifactFile: string;
  sourceArtifactSha256: string;
  reviewSubjectSha256: string;
  replayRunId: string;
  /** The fresh reviewer response, in full. */
  reviewResponse: unknown;
  overallVerdict: string | null;
  derivedDefects: string[];
  consistency: "consistent" | "contradictory" | "not_evaluated";
  latencyMs: number;
  finishReason: string | null;
  sanitizedError: string | null;
  /** Never a product-quality claim. Present so a reader cannot mistake one for the other. */
  productQualityPass: null;
  productQualityAuthority: "human_only";
};

export type ReplaySummary = {
  replayRunId: string;
  expected: number;
  executed: number;
  outcomes: Record<ReplayOutcome, number>;
  artifacts: Array<{ path: string; sha256: string }>;
  /** How many generation calls this program made. Structurally always zero. */
  generationCallCount: 0;
  reviewCallCount: number;
};

/**
 * Replay ONE frozen subject.
 *
 * The digest gate runs first and fails closed: if the subject presented for review is not
 * byte-identical to the one recorded, no provider call is made at all. A verdict about a drifted
 * subject would be a verdict about a different thing.
 */
export async function replayOne(deps: ReplayDeps, replayRunId: string, s: ReplaySubject): Promise<ReplayCaseResult> {
  const startedAt = deps.now();
  const recordedSha = reviewSubjectSha256(s.subject);
  const base = {
    sourceRunId: s.sourceRunId,
    sourcePassId: s.sourcePassId,
    sourceCaseId: s.sourceCaseId,
    sourceAttemptIndex: s.sourceAttemptIndex,
    sourceArtifactFile: s.sourceArtifactFile,
    sourceArtifactSha256: s.sourceArtifactSha256,
    reviewSubjectSha256: recordedSha,
    replayRunId,
    productQualityPass: null as null,
    productQualityAuthority: "human_only" as const,
  };

  // Recompute the subject from its own content. A fixture whose scenario was edited after its digest
  // was recorded must be refused, not reviewed.
  const recomputed: ReviewSubject = { ...s.subject, scenarioSha256: scenarioDigest(s.subject.scenario) };
  const gate = canRerunOverSubject(s.subject, recomputed);
  if (!gate.ok) {
    const r: ReplayCaseResult = {
      ...base,
      outcome: "subject_digest_mismatch",
      reviewResponse: null,
      overallVerdict: null,
      derivedDefects: [],
      consistency: "not_evaluated",
      latencyMs: deps.now() - startedAt,
      finishReason: null,
      sanitizedError: gate.drift.join(","),
    };
    return r;
  }

  let res: ReplayReviewResult;
  try {
    res = await deps.review(s.subject);
  } catch {
    res = { kind: "transport_failed", sanitizedError: "review_call_threw" };
  }

  const latencyMs = deps.now() - startedAt;
  switch (res.kind) {
    case "ok":
      return { ...base, outcome: "consistent_accept", reviewResponse: res.parsed, overallVerdict: res.overallVerdict, derivedDefects: res.derivedDefects, consistency: "consistent", latencyMs, finishReason: res.finishReason, sanitizedError: null };
    case "reject":
      return { ...base, outcome: "consistent_reject", reviewResponse: res.parsed, overallVerdict: res.overallVerdict, derivedDefects: res.derivedDefects, consistency: "consistent", latencyMs, finishReason: res.finishReason, sanitizedError: null };
    case "contradiction":
      return { ...base, outcome: "repeated_contradiction", reviewResponse: res.parsed, overallVerdict: res.overallVerdict, derivedDefects: res.derivedDefects, consistency: "contradictory", latencyMs, finishReason: res.finishReason, sanitizedError: res.errors.join(",") };
    case "malformed":
      return { ...base, outcome: isContradiction(res.errors) ? "repeated_contradiction" : "schema_failure", reviewResponse: null, overallVerdict: null, derivedDefects: [], consistency: "not_evaluated", latencyMs, finishReason: res.finishReason, sanitizedError: res.errors.join(",") };
    case "transport_failed":
      return { ...base, outcome: "provider_failure", reviewResponse: null, overallVerdict: null, derivedDefects: [], consistency: "not_evaluated", latencyMs, finishReason: null, sanitizedError: res.sanitizedError };
  }
}

/**
 * Replay every frozen subject, writing one immutable artifact per subject the moment it terminates.
 *
 * Exactly one review call per subject: this is a measurement of whether a SECOND look is consistent,
 * not another retry loop.
 */
export async function runReviewReplay(deps: ReplayDeps, replayRunId: string, subjects: ReplaySubject[]): Promise<ReplaySummary> {
  const outcomes = Object.fromEntries(REPLAY_OUTCOMES.map((o) => [o, 0])) as Record<ReplayOutcome, number>;
  const artifacts: ReplaySummary["artifacts"] = [];
  let reviewCallCount = 0;

  for (const s of subjects) {
    const result = await replayOne(deps, replayRunId, s);
    if (result.outcome !== "subject_digest_mismatch") reviewCallCount += 1;
    outcomes[result.outcome] += 1;
    const written = deps.writeArtifact(
      {
        replayRunId,
        sourcePassId: s.sourcePassId,
        sourceCaseId: s.sourceCaseId,
        sourceAttemptIndex: s.sourceAttemptIndex,
        reviewSubjectSha256: result.reviewSubjectSha256,
      },
      JSON.stringify(result, null, 2),
    );
    artifacts.push({ path: written.path, sha256: written.sha256 });
    deps.log(`REPLAY ARTIFACT WRITTEN · ${result.sourcePassId}/${result.sourceCaseId}#${result.sourceAttemptIndex} · ${result.outcome} · ${written.path} · sha256=${written.sha256}`);
  }

  return { replayRunId, expected: subjects.length, executed: subjects.length, outcomes, artifacts, generationCallCount: 0, reviewCallCount };
}

/**
 * The replay's terminal lines. A consistent accept is a REVIEWER recovery and is labelled as one —
 * there is no code path here that can print a product-quality pass.
 */
export function replayTerminalLabel(s: ReplaySummary): string[] {
  return [
    `REVIEWER REPLAY COMPLETE · ${s.executed}/${s.expected} SUBJECTS`,
    `consistent_accept ${s.outcomes.consistent_accept} · consistent_reject ${s.outcomes.consistent_reject} · repeated_contradiction ${s.outcomes.repeated_contradiction}`,
    `provider_failure ${s.outcomes.provider_failure} · schema_failure ${s.outcomes.schema_failure} · subject_digest_mismatch ${s.outcomes.subject_digest_mismatch}`,
    "REVIEWER RECOVERY MEASURED · PRODUCT QUALITY NOT MEASURED",
    `GENERATION CALLS: ${s.generationCallCount}`,
  ];
}
