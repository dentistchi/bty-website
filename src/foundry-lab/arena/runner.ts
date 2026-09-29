/**
 * BTY FOUNDRY LAB — benchmark runner (M0).
 *
 * NON-INTERACTIVE BY CONSTRUCTION. The runner reads no stdin and has no prompt, confirmation or
 * paste step anywhere, so an overnight run needs nobody. `human_relay_count` in every report is the
 * number of `human_input` events in the run's log — and nothing in the runner writes one.
 *
 * RESUMABLE. A run is its directory. `resumeRun` re-reads the immutable run manifest, refuses to
 * continue if the source SHA or benchmark hash moved (a result must be tied to the exact code and
 * cases that produced it), and executes only the slots with no finished gen file.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { runGeneration, type GenerateFn, type GenerationOutcome, type Pipeline } from "./adapter";
import { evaluate, EVALUATOR_VERSION, type Evaluation } from "./evaluate";
import { caseHash, type BenchmarkCase, type BenchmarkManifest } from "./manifest";
import { providerIdentity, type ProviderConfig, type ProviderIdentity } from "./provider";
import {
  allSlots,
  appendEvent,
  genFile,
  readEvents,
  readJson,
  runDir,
  slotDone,
  slotStarts,
  writeJsonAtomic,
  type Slot,
} from "./store";
import type { CriticResult } from "./critic";
import { promptLikelyTruncated, type LocalRuntime } from "./localRuntime";
import path from "node:path";

export const HARNESS_VERSION = "foundry_arena_harness_v1";
export const FOUNDER_REJECTION_REASONS = [
  "too_generic",
  "unrealistic",
  "too_academic",
  "not_actionable",
  "too_complicated",
  "wrong_progression",
  "other",
] as const;

export type RunManifest = {
  schema: "foundry_arena_run_v1";
  run_id: string;
  harness_version: string;
  evaluator_version: string;
  benchmark_id: string;
  benchmark_version: string;
  benchmark_hash: string;
  manifest_file: string;
  source_git_sha: string;
  source_dirty: boolean;
  provider: ProviderIdentity;
  /** What the local runtime said it would serve (context window). Null for mock/frontier. */
  local_runtime: LocalRuntime | null;
  pipeline: Pipeline;
  generations_per_case: number;
  case_ids: string[];
  critic_enabled: boolean;
  replay_of: string | null;
  created_at: string;
};

export type ModelCallSummary = {
  program_attempts: number;
  provider_calls: number;
  /** Provider calls beyond the first per program attempt — the service's own bounded retry. */
  service_retries: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  provider_duration_ms: number | null;
  call_outcomes: string[];
  finish_reasons: string[];
};

export type GenerationRecord = {
  schema: "foundry_arena_generation_v1";
  run_id: string;
  benchmark_version: string;
  benchmark_hash: string;
  case_id: string;
  case_hash: string;
  generation_index: number;
  source_git_sha: string;
  provider: ProviderIdentity;
  pipeline: Pipeline;
  status: "completed" | "harness_error";
  /** How many times the harness has started this slot (1 unless it was interrupted before). */
  attempt_count: number;
  started_at: string;
  finished_at: string;
  elapsed_ms: number;
  valid: boolean;
  first_pass_valid: boolean | null;
  service_repair: { attempted: boolean; succeeded: boolean | null };
  product_repair: { attempted: boolean; succeeded: boolean | null };
  failure_codes: string[];
  /** A provider call whose prompt filled the context window — the result may describe a clipped prompt. */
  context_truncation_suspected: boolean;
  model_calls: ModelCallSummary;
  outcome: GenerationOutcome | null;
  evaluation: Evaluation | null;
  critic: CriticResult | null;
  harness_error: string | null;
  founder_verdict: "pending" | "accept" | "reject";
  founder_rejection_reason: (typeof FOUNDER_REJECTION_REASONS)[number] | null;
  artifact_path: string;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const sumOrNull = (vals: (number | null)[]) => (vals.some((v) => v !== null) ? vals.reduce<number>((a, v) => a + (v ?? 0), 0) : null);

export function summarizeCalls(o: GenerationOutcome | null): ModelCallSummary {
  const calls = (o?.attempts ?? []).flatMap((a) => a.ledger_calls);
  return {
    program_attempts: o?.attempts.length ?? 0,
    provider_calls: calls.length,
    service_retries: (o?.attempts ?? []).reduce((n, a) => n + Math.max(0, a.ledger_calls.length - 1), 0),
    prompt_tokens: sumOrNull(calls.map((c) => num(c.prompt_tokens))),
    completion_tokens: sumOrNull(calls.map((c) => num(c.completion_tokens))),
    total_tokens: sumOrNull(calls.map((c) => num(c.total_tokens))),
    provider_duration_ms: sumOrNull(calls.map((c) => num(c.duration_ms))),
    call_outcomes: calls.map((c) => String(c.outcome ?? "unknown")),
    finish_reasons: calls.map((c) => String(c.finish_reason ?? "none")),
  };
}

/** First pass = the very first provider call of the first program attempt produced a valid program. */
export function firstPass(o: GenerationOutcome | null): boolean | null {
  const first = o?.attempts[0];
  if (!first) return null;
  return first.ok && first.ledger_calls.length <= 1;
}

export function currentSource(): { sha: string; dirty: boolean } {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  // Untracked lab output is never source; only tracked modifications make the tree dirty.
  const dirty = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=no"], { encoding: "utf8" }).trim().length > 0;
  return { sha, dirty };
}

export function newRunId(sha: string, model: string, now = new Date()): string {
  const ts = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const slug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "model";
  return `${ts}-${sha.slice(0, 8)}-${slug}-${randomBytes(2).toString("hex")}`;
}

export type RunOptions = {
  manifest: BenchmarkManifest;
  manifestFile: string;
  benchmarkHash: string;
  provider: ProviderConfig;
  pipeline: Pipeline;
  generations: number;
  caseIds?: string[];
  critic?: boolean;
  replayOf?: string | null;
  source: { sha: string; dirty: boolean };
  localRuntime?: LocalRuntime | null;
  generate?: GenerateFn;
  criticFn?: (c: BenchmarkCase, o: GenerationOutcome) => Promise<CriticResult>;
  log?: (line: string) => void;
  /** Stop after this many slots (for smoke checks and interruption tests). */
  maxSlots?: number;
};

export function createRun(opts: RunOptions): RunManifest {
  const caseIds = opts.caseIds?.length ? opts.caseIds : opts.manifest.cases.map((c) => c.case_id);
  const unknown = caseIds.filter((id) => !opts.manifest.cases.some((c) => c.case_id === id));
  if (unknown.length) throw new Error(`unknown case ids: ${unknown.join(", ")}`);
  if (!Number.isInteger(opts.generations) || opts.generations < 1 || opts.generations > 20) throw new Error("generations must be an integer 1..20");
  const run: RunManifest = {
    schema: "foundry_arena_run_v1",
    run_id: newRunId(opts.source.sha, opts.provider.model),
    harness_version: HARNESS_VERSION,
    evaluator_version: EVALUATOR_VERSION,
    benchmark_id: opts.manifest.benchmark_id,
    benchmark_version: opts.manifest.benchmark_version,
    benchmark_hash: opts.benchmarkHash,
    manifest_file: path.relative(process.cwd(), opts.manifestFile),
    source_git_sha: opts.source.sha,
    source_dirty: opts.source.dirty,
    provider: providerIdentity(opts.provider),
    local_runtime: opts.localRuntime ?? null,
    pipeline: opts.pipeline,
    generations_per_case: opts.generations,
    case_ids: caseIds,
    critic_enabled: !!opts.critic,
    replay_of: opts.replayOf ?? null,
    created_at: new Date().toISOString(),
  };
  writeJsonAtomic(path.join(runDir(run.run_id), "manifest.json"), run);
  appendEvent(run.run_id, { type: "run_started" });
  return run;
}

export function loadRun(runId: string): RunManifest {
  const run = readJson<RunManifest>(path.join(runDir(runId), "manifest.json"));
  if (!run) throw new Error(`run not found: ${runId}`);
  return run;
}

/** Refuse to mix results from different code, cases or models into one run. */
export function assertResumable(run: RunManifest, opts: Pick<RunOptions, "benchmarkHash" | "source" | "provider" | "localRuntime">): void {
  if (run.benchmark_hash !== opts.benchmarkHash) throw new Error("benchmark changed since the run started; start a new run");
  if (run.source_git_sha !== opts.source.sha) throw new Error(`source moved (${run.source_git_sha.slice(0, 8)} → ${opts.source.sha.slice(0, 8)}); start a new run`);
  if (run.source_dirty !== opts.source.dirty) throw new Error("source working-tree state changed since the run started; start a new run");
  if (run.provider.model !== opts.provider.model || run.provider.provider_mode !== opts.provider.mode) throw new Error("provider/model differs from the run; start a new run (or a replay)");
  if ((run.local_runtime?.num_ctx ?? null) !== (opts.localRuntime?.num_ctx ?? null)) throw new Error("local runtime context window changed since the run started; start a new run");
}

export function pendingSlots(run: RunManifest): Slot[] {
  return allSlots(run.case_ids, run.generations_per_case).filter((s) => !slotDone(run.run_id, s));
}

export async function executeRun(run: RunManifest, opts: RunOptions): Promise<{ executed: number; remaining: number }> {
  const log = opts.log ?? (() => {});
  const cases = new Map(opts.manifest.cases.map((c) => [c.case_id, c]));
  let executed = 0;
  for (const slot of pendingSlots(run)) {
    if (opts.maxSlots !== undefined && executed >= opts.maxSlots) break;
    const c = cases.get(slot.case_id)!;
    appendEvent(run.run_id, { type: "slot_started", ...slot });
    const attemptCount = slotStarts(readEvents(run.run_id), slot);
    const startedAt = new Date();
    let outcome: GenerationOutcome | null = null;
    let evaluation: Evaluation | null = null;
    let critic: CriticResult | null = null;
    let harnessError: string | null = null;
    try {
      outcome = await runGeneration(c, { pipeline: run.pipeline, sourceSha: run.source_git_sha, generate: opts.generate });
      evaluation = evaluate(c, outcome);
      if (run.critic_enabled && opts.criticFn && outcome.ok) critic = await opts.criticFn(c, outcome);
    } catch (e) {
      harnessError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    const finishedAt = new Date();
    const file = genFile(run.run_id, slot.case_id, slot.generation_index);
    const attempts = outcome?.attempts ?? [];
    const record: GenerationRecord = {
      schema: "foundry_arena_generation_v1",
      run_id: run.run_id,
      benchmark_version: run.benchmark_version,
      benchmark_hash: run.benchmark_hash,
      case_id: slot.case_id,
      case_hash: caseHash(c),
      generation_index: slot.generation_index,
      source_git_sha: run.source_git_sha,
      provider: run.provider,
      pipeline: run.pipeline,
      status: harnessError ? "harness_error" : "completed",
      attempt_count: attemptCount,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      elapsed_ms: finishedAt.getTime() - startedAt.getTime(),
      valid: !!outcome?.ok,
      first_pass_valid: firstPass(outcome),
      service_repair: (() => {
        const first = attempts[0];
        if (!first || first.ledger_calls.length < 2) return { attempted: false, succeeded: null };
        return { attempted: true, succeeded: first.ok };
      })(),
      product_repair: attempts.length > 1 ? { attempted: true, succeeded: attempts[1].ok } : { attempted: false, succeeded: null },
      failure_codes: outcome && !outcome.ok ? [outcome.final_refusal_code ?? outcome.final_error_code ?? "unknown"] : harnessError ? ["harness_error"] : [],
      context_truncation_suspected: attempts.some((a) => a.ledger_calls.some((c) => promptLikelyTruncated(c.prompt_tokens, run.local_runtime?.num_ctx ?? null))),
      model_calls: summarizeCalls(outcome),
      outcome,
      evaluation,
      critic,
      harness_error: harnessError,
      founder_verdict: "pending",
      founder_rejection_reason: null,
      artifact_path: path.relative(runDir(run.run_id), file),
    };
    if (harnessError) {
      // A harness fault is not a result: it is logged and the slot stays pending for the next resume.
      appendEvent(run.run_id, { type: "slot_error", ...slot, detail: harnessError.slice(0, 300) });
      log(`✗ ${slot.case_id} gen-${slot.generation_index} harness error: ${harnessError}`);
      executed++;
      continue;
    }
    writeJsonAtomic(file, record);
    appendEvent(run.run_id, { type: "slot_completed", ...slot, detail: record.valid ? "valid" : record.failure_codes.join(",") });
    log(`${record.valid ? "✓" : "·"} ${slot.case_id} gen-${slot.generation_index} ${record.valid ? "valid" : record.failure_codes.join(",")} ${record.elapsed_ms}ms`);
    executed++;
  }
  const remaining = pendingSlots(run).length;
  if (remaining === 0) appendEvent(run.run_id, { type: "run_completed" });
  return { executed, remaining };
}
