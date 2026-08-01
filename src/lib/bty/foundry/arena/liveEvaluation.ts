/**
 * LIVE STABILITY ORCHESTRATOR (Slice 3.2I-R5B1A.1-R2.23D-R3).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D-R2 run cleared all 22 contract checks and both provider checks, then died at 5.01 s in
 * each pass. The killer was Vitest's default `testTimeout` of 5,000 ms — the live evaluation was
 * executed through `practice-generation.eval.test.ts`, so a unit-test framework held authority over
 * a run whose own stage budgets are 120 s per request across up to four requests.
 *
 * A long live evaluation must not borrow a test runner's clock. This module is the execution
 * authority instead: an explicit per-case deadline derived from the real maximum path, evidence
 * written per case the moment it terminates, and an abort policy that distinguishes a provider or
 * runtime failure (stop everything) from a content-quality failure (keep measuring variance).
 *
 * Every dependency is injected — the generator, the clock, the artifact writer — so the exact
 * program the runner executes is provable against a mock, including a case that takes longer than
 * five seconds.
 */

import { PRACTICE_SAMPLING } from "./arenaScenarioGenerationService";
import type { GenerationResult } from "./arenaScenarioGenerationService";
import type { EvalCase } from "./practice-generation.eval";
import { ArtifactWriteError, type CaseArtifactIdentity, type CaseWriteResult } from "./caseArtifact";

// ---------------------------------------------------------------------------
// Timeout authority
// ---------------------------------------------------------------------------

/**
 * CASE DEADLINE — derived, not chosen.
 *
 *   initial generation      120 s   (LLM_GEN_TIMEOUT_MS)
 * + initial semantic review 120 s   (LLM_REVIEW_TIMEOUT_MS)
 * + retry generation        120 s   (attempt 2 — MAX_GENERATION_ATTEMPTS = 2)
 * + retry semantic review   120 s
 * = 480 s maximum legitimate stage sequence
 * + 30 s serialization and artifact-write headroom
 * = 510 s
 *
 * Each stage keeps its own explicit timeout; this is the envelope around the whole sequence. It is
 * deliberately larger than the legitimate maximum and no larger — a deadline chosen simply for being
 * generous would hide a hung provider instead of reporting one.
 */
export const STAGE_TIMEOUT_MS = PRACTICE_SAMPLING.generation.timeoutMs;
export const REVIEW_TIMEOUT_MS = PRACTICE_SAMPLING.review.timeoutMs;
export const MAX_ATTEMPTS = PRACTICE_SAMPLING.retry.maxAttempts;
export const ARTIFACT_HEADROOM_MS = 30_000;
export const CASE_DEADLINE_MS = MAX_ATTEMPTS * (STAGE_TIMEOUT_MS + REVIEW_TIMEOUT_MS) + ARTIFACT_HEADROOM_MS;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * R2.25 — `reviewer` is a THIRD class, not a flavour of the other two.
 *
 * A reviewer terminal failure means the provider answered and the runtime worked, so it is not
 * infrastructure; and the scenario was never judged, so it is not a content finding either. It does
 * not abort the run — the remaining cases are still worth measuring — but it fails the hard gates.
 */
export type OutcomeClass = "content" | "infrastructure" | "reviewer";

/**
 * INFRASTRUCTURE means the provider or this process failed, so nothing further can be measured and
 * the run must stop. CONTENT means the model and reviewer both answered and the result was judged —
 * that is a product finding, and the remaining cases are still worth collecting.
 *
 * A timeout is never reported as `generation_rejected`: conflating "the provider never answered"
 * with "the answer was defective" is exactly the mislabelling this arc has spent slices removing.
 */
const INFRASTRUCTURE_REASONS = new Set([
  "generation_unavailable",
  "generation_failed",
  "structured_output_unavailable",
  "case_deadline_exceeded",
  "orchestrator_exception",
  "infrastructure_artifact_write_failure",
  "manifest_drift",
]);

/** Corpus-expected product states. A decline the corpus predicts is a CONTENT result. */
const CONTENT_REASONS = new Set([
  "generation_rejected",
  "fixed_answer_knowledge",
  "safety_boundary_unresolved",
  "boundary_confirmation_required",
  "no_safe_judgment_space",
  "practice_boundary_scope_required",
  "too_many_active_boundaries",
  "unknown_active_boundary",
  "missing_required_active_boundary",
  "active_boundary_set_changed",
  "boundary_scope_not_confirmed",
]);

export function classifyReason(reason: string): OutcomeClass {
  if (reason === "reviewer_terminal_failure") return "reviewer";
  if (INFRASTRUCTURE_REASONS.has(reason)) return "infrastructure";
  if (CONTENT_REASONS.has(reason)) return "content";
  // Unknown reasons fail toward INFRASTRUCTURE: stopping a run that may be broken is recoverable,
  // whereas continuing to spend live calls on a broken provider is not.
  return "infrastructure";
}

export const EXIT_CODES = { ok: 0, contentFailure: 0, infrastructure: 4, artifactFailure: 5 } as const;

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type AttemptRecord = {
  outcome: string;
  code?: string;
  finishReason?: string;
  defectCodes?: string[];
  /** R2.27 — boundary provenance travels with every review-related attempt record. */
  boundaryProvenanceSha256?: string;
  boundaryProvenance?: unknown;
  reviewRequestBoundaries?: Array<{ id: string; statement: string }>;
  boundaryCoverage?: { ok: boolean; codes: string[]; boundaryIdsConsidered: string[]; assessmentIds: string[] };
};

export type CaseResult = {
  mode: "mock" | "live";
  runId: string;
  passId: string;
  caseId: string;
  head: string;
  manifestSha256: string;
  model: string;
  sampling: typeof PRACTICE_SAMPLING;
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  attempts: AttemptRecord[];
  ok: boolean;
  reason: string | null;
  classification: OutcomeClass;
  /**
   * R2.27 — the terminal artifact states which boundaries were in play, so a future replay never
   * has to guess. `null` means the run predates provenance, and is NOT "no boundaries".
   */
  boundaryMode: "none" | "bearing" | null;
  boundaryProvenanceSha256: string | null;
  boundaryProvenance: unknown | null;
  primaryCode: string | null;
  defectCodes: string[];
  draft: unknown | null;
  constraintEvidence: unknown | null;
  sanitizedError: string | null;
};

export type LiveDeps = {
  /** The canonical production service. Never a reimplementation. */
  generate: (input: EvalCase["input"]) => Promise<GenerationResult>;
  /** Injected so a case deadline is testable without waiting minutes. */
  now: () => number;
  /** Bounded wait used by the case deadline. */
  setTimer: (fn: () => void, ms: number) => { cancel: () => void };
  writeArtifact: (id: CaseArtifactIdentity, payload: string) => CaseWriteResult;
  observe: (fn: ((o: AttemptRecord) => void) | null, opts?: { captureContent?: boolean }) => void;
  log: (line: string) => void;
};

export type LiveConfig = {
  /** `mock` proves wiring only; it is recorded in every artifact path and payload. */
  mode: "mock" | "live";
  runId: string;
  head: string;
  manifestSha256: string;
  model: string;
  passes: string[];
  cases: EvalCase[];
  caseDeadlineMs?: number;
};

export type LiveRunSummary = {
  runId: string;
  completedCases: number;
  expectedCases: number;
  written: CaseWriteResult[];
  aborted: boolean;
  abortReason: string | null;
  abortClassification: OutcomeClass | null;
  exitCode: number;
};

/** Race a promise against the case deadline. The stage's own timeout still applies underneath. */
function withDeadline<T>(p: Promise<T>, ms: number, deps: LiveDeps): Promise<{ kind: "value"; value: T } | { kind: "deadline" }> {
  return new Promise((resolve) => {
    const timer = deps.setTimer(() => resolve({ kind: "deadline" }), ms);
    p.then(
      (value) => {
        timer.cancel();
        resolve({ kind: "value", value });
      },
      (error: unknown) => {
        timer.cancel();
        // A thrown orchestrator error is not a deadline; surface it as its own infrastructure case.
        resolve({ kind: "value", value: { ok: false, reason: "orchestrator_exception", __error: error } as unknown as T });
      },
    );
  });
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Run ONE case to a terminal result and write its evidence before returning.
 *
 * The artifact is written here, not by the caller, so no aggregate step stands between a completed
 * case and its durable record. That ordering is the whole point: R2.23D-R2 lost everything because
 * the only write happened after every case had finished.
 */
export async function runLiveCase(deps: LiveDeps, config: LiveConfig, passId: string, evalCase: EvalCase): Promise<{ result: CaseResult; written: CaseWriteResult }> {
  const deadlineMs = config.caseDeadlineMs ?? CASE_DEADLINE_MS;
  const attempts: AttemptRecord[] = [];
  deps.observe((o) => attempts.push(o), { captureContent: true });

  const startedAt = deps.now();
  const raced = await withDeadline(deps.generate(evalCase.input), deadlineMs, deps);
  const endedAt = deps.now();
  deps.observe(null);

  let ok = false;
  let reason: string | null = null;
  let draft: unknown = null;
  let constraintEvidence: unknown = null;
  let sanitizedError: string | null = null;

  if (raced.kind === "deadline") {
    reason = "case_deadline_exceeded";
    sanitizedError = `case exceeded its ${deadlineMs} ms deadline`;
  } else {
    const r = raced.value as GenerationResult & { __error?: unknown };
    if (r.ok) {
      ok = true;
      draft = r.value.draft;
      constraintEvidence = r.value.constraintEvidence;
    } else {
      reason = r.reason;
      if (r.__error !== undefined) {
        // Sanitized: an SDK error can carry request headers, so only its name survives.
        sanitizedError = r.__error instanceof Error ? r.__error.name : "UnknownError";
      }
    }
  }

  const last = attempts[attempts.length - 1];
  // Provenance is recorded once, from the frozen-subject observation, and carried to the terminal.
  const frozenObs = attempts.find((a) => a.outcome === "review_subject_frozen");
  const prov = (frozenObs?.boundaryProvenance ?? null) as { boundaryMode?: "none" | "bearing" } | null;
  const result: CaseResult = {
    mode: config.mode,
    boundaryMode: prov?.boundaryMode ?? null,
    boundaryProvenanceSha256: frozenObs?.boundaryProvenanceSha256 ?? null,
    boundaryProvenance: prov,
    runId: config.runId,
    passId,
    caseId: evalCase.id,
    head: config.head,
    manifestSha256: config.manifestSha256,
    model: config.model,
    sampling: PRACTICE_SAMPLING,
    startedAt: iso(startedAt),
    endedAt: iso(endedAt),
    latencyMs: endedAt - startedAt,
    attempts,
    ok,
    reason,
    classification: ok ? "content" : classifyReason(reason ?? "orchestrator_exception"),
    primaryCode: ok ? null : (last?.code ?? null),
    defectCodes: last?.defectCodes ?? [],
    draft,
    constraintEvidence,
    sanitizedError,
  };

  const identity: CaseArtifactIdentity = {
    mode: config.mode,
    runId: config.runId,
    passId,
    caseId: evalCase.id,
    head: config.head,
    manifestSha256: config.manifestSha256,
  };
  // Throws ArtifactWriteError on collision or verification failure — the caller must NOT claim
  // evidence was preserved when this fails.
  const written = deps.writeArtifact(identity, JSON.stringify(result, null, 2));
  deps.log(`IMMUTABLE CASE ARTIFACT WRITTEN · mode=${config.mode} · ${written.path} · sha256=${written.sha256}`);
  return { result, written };
}

/**
 * Run every pass and case, aborting the whole run on the first INFRASTRUCTURE result.
 *
 * A content failure does not stop the run: measuring how often the contract rejects defective
 * content across six executions is the point of the canary. A provider or runtime failure does stop
 * it, because every remaining call would spend money to measure nothing.
 */
export async function runLiveStability(deps: LiveDeps, config: LiveConfig): Promise<LiveRunSummary> {
  const written: CaseWriteResult[] = [];
  const expectedCases = config.passes.length * config.cases.length;
  let completed = 0;

  for (const passId of config.passes) {
    for (const evalCase of config.cases) {
      let outcome: Awaited<ReturnType<typeof runLiveCase>>;
      try {
        outcome = await runLiveCase(deps, config, passId, evalCase);
      } catch (e) {
        if (e instanceof ArtifactWriteError) {
          // No evidence exists for this case, and none is claimed.
          deps.log(`ARTIFACT WRITE FAILED · ${evalCase.id} · ${passId} · no evidence was preserved for this case`);
          return {
            runId: config.runId,
            completedCases: completed,
            expectedCases,
            written,
            aborted: true,
            abortReason: "infrastructure_artifact_write_failure",
            abortClassification: "infrastructure",
            exitCode: EXIT_CODES.artifactFailure,
          };
        }
        throw e;
      }

      written.push(outcome.written);
      completed += 1;

      if (outcome.result.classification === "infrastructure") {
        deps.log(`INFRASTRUCTURE FAILURE · ${evalCase.id} · ${passId} · ${outcome.result.reason} · remaining cases and passes are ABORTED`);
        return {
          runId: config.runId,
          completedCases: completed,
          expectedCases,
          written,
          aborted: true,
          abortReason: outcome.result.reason,
          abortClassification: "infrastructure",
          exitCode: EXIT_CODES.infrastructure,
        };
      }
      if (!outcome.result.ok) {
        // A content rejection is a finding, not a reason to stop measuring variance.
        deps.log(`CONTENT RESULT · ${evalCase.id} · ${passId} · ${outcome.result.reason} · continuing`);
      }
    }
  }

  return {
    runId: config.runId,
    completedCases: completed,
    expectedCases,
    written,
    aborted: false,
    abortReason: null,
    abortClassification: null,
    exitCode: EXIT_CODES.ok,
  };
}
