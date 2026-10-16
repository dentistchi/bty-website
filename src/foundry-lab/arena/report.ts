/**
 * BTY FOUNDRY LAB — run report (M0). Computed ONLY from what is on disk: the run manifest, the gen
 * files and the event log. Nothing is estimated; a quantity nobody measured is `null` and printed
 * as "not observed".
 */
import path from "node:path";
import { LAYER_B_DIMENSIONS, type LayerBDimension } from "./evaluate";
import type { GenerationRecord, RunManifest } from "./runner";
import { allSlots, listGenFiles, readEvents, readJson, runDir, writeJsonAtomic, type RunEvent } from "./store";
import { writeFileSync } from "node:fs";

export type GateTally = { pass: number; fail: number; not_evaluated: number };

export type RunReport = {
  schema: "foundry_arena_report_v1";
  run_id: string;
  source_git_sha: string;
  source_dirty: boolean;
  benchmark_id: string;
  benchmark_version: string;
  benchmark_hash: string;
  harness_version: string;
  evaluator_version: string;
  provider: RunManifest["provider"];
  pipeline: RunManifest["pipeline"];
  replay_of: string | null;
  cases_planned: number;
  cases_attempted: number;
  cases_completed: number;
  generations_per_case: number;
  candidates_planned: number;
  candidates_completed: number;
  candidates_pending: number;
  valid: number;
  invalid: number;
  first_pass: { measured: number; valid: number };
  service_repair: { attempted: number; succeeded: number };
  product_repair: { attempted: number; succeeded: number };
  failure_codes: Record<string, number>;
  layer_a: Record<string, GateTally>;
  layer_b: Record<LayerBDimension, GateTally>;
  layer_b_all_pass: number;
  per_case: Array<{ case_id: string; completed: number; valid: number; failure_codes: string[] }>;
  elapsed_ms: { total: number; p50: number | null; p90: number | null; max: number | null };
  model: {
    provider_calls: number;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    total_tokens: number | null;
    provider_duration_ms: number | null;
    service_retries: number;
  };
  harness_errors: number;
  context_truncation_suspected: number;
  local_runtime: RunManifest["local_runtime"];
  resumes: number;
  human_relay_count: number;
  founder_review: { pending: number; accept: number; reject: number };
  generated_at: string;
};

const tally = (): GateTally => ({ pass: 0, fail: 0, not_evaluated: 0 });
const add = (t: GateTally, status: string) => {
  if (status === "PASS") t.pass++;
  else if (status === "FAIL") t.fail++;
  else t.not_evaluated++;
};
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
const sumNullable = (vals: (number | null)[]) => (vals.some((v) => v !== null) ? vals.reduce<number>((a, v) => a + (v ?? 0), 0) : null);

/** `human_input` events are the only thing that counts as relay. Resumes are not relay. */
export function humanRelayCount(events: readonly RunEvent[]): number {
  return events.filter((e) => e.type === "human_input").length;
}

export function computeReport(run: RunManifest, records: GenerationRecord[], events: RunEvent[]): RunReport {
  const planned = allSlots(run.case_ids, run.generations_per_case).length;
  const failureCodes: Record<string, number> = {};
  const layerA: Record<string, GateTally> = {};
  const layerB = Object.fromEntries(LAYER_B_DIMENSIONS.map((d) => [d, tally()])) as Record<LayerBDimension, GateTally>;
  let layerBAllPass = 0;
  for (const r of records) {
    for (const code of r.failure_codes) failureCodes[code] = (failureCodes[code] ?? 0) + 1;
    if (r.evaluation) {
      for (const [k, g] of Object.entries(r.evaluation.layer_a)) add((layerA[k] ??= tally()), g.status);
      for (const d of LAYER_B_DIMENSIONS) add(layerB[d], r.evaluation.layer_b[d].status);
      if (r.evaluation.layer_b_summary.all_pass === true) layerBAllPass++;
    }
  }
  const byCase = new Map<string, GenerationRecord[]>();
  for (const r of records) byCase.set(r.case_id, [...(byCase.get(r.case_id) ?? []), r]);
  const elapsed = records.map((r) => r.elapsed_ms).sort((a, b) => a - b);
  const firstPassMeasured = records.filter((r) => r.first_pass_valid !== null);
  return {
    schema: "foundry_arena_report_v1",
    run_id: run.run_id,
    source_git_sha: run.source_git_sha,
    source_dirty: run.source_dirty,
    benchmark_id: run.benchmark_id,
    benchmark_version: run.benchmark_version,
    benchmark_hash: run.benchmark_hash,
    harness_version: run.harness_version,
    evaluator_version: run.evaluator_version,
    provider: run.provider,
    pipeline: run.pipeline,
    replay_of: run.replay_of,
    cases_planned: run.case_ids.length,
    cases_attempted: new Set(events.filter((e) => e.type === "slot_started").map((e) => e.case_id)).size,
    cases_completed: run.case_ids.filter((id) => (byCase.get(id)?.length ?? 0) === run.generations_per_case).length,
    generations_per_case: run.generations_per_case,
    candidates_planned: planned,
    candidates_completed: records.length,
    candidates_pending: planned - records.length,
    valid: records.filter((r) => r.valid).length,
    invalid: records.filter((r) => !r.valid).length,
    first_pass: { measured: firstPassMeasured.length, valid: firstPassMeasured.filter((r) => r.first_pass_valid).length },
    service_repair: { attempted: records.filter((r) => r.service_repair.attempted).length, succeeded: records.filter((r) => r.service_repair.succeeded === true).length },
    product_repair: { attempted: records.filter((r) => r.product_repair.attempted).length, succeeded: records.filter((r) => r.product_repair.succeeded === true).length },
    failure_codes: Object.fromEntries(Object.entries(failureCodes).sort((a, b) => b[1] - a[1])),
    layer_a: layerA,
    layer_b: layerB,
    layer_b_all_pass: layerBAllPass,
    per_case: run.case_ids.map((id) => {
      const rs = byCase.get(id) ?? [];
      return { case_id: id, completed: rs.length, valid: rs.filter((r) => r.valid).length, failure_codes: rs.flatMap((r) => r.failure_codes) };
    }),
    elapsed_ms: { total: elapsed.reduce((a, b) => a + b, 0), p50: percentile(elapsed, 50), p90: percentile(elapsed, 90), max: elapsed.length ? elapsed[elapsed.length - 1] : null },
    model: {
      provider_calls: records.reduce((n, r) => n + r.model_calls.provider_calls, 0),
      prompt_tokens: sumNullable(records.map((r) => r.model_calls.prompt_tokens)),
      completion_tokens: sumNullable(records.map((r) => r.model_calls.completion_tokens)),
      total_tokens: sumNullable(records.map((r) => r.model_calls.total_tokens)),
      provider_duration_ms: sumNullable(records.map((r) => r.model_calls.provider_duration_ms)),
      service_retries: records.reduce((n, r) => n + r.model_calls.service_retries, 0),
    },
    harness_errors: events.filter((e) => e.type === "slot_error").length,
    context_truncation_suspected: records.filter((r) => r.context_truncation_suspected).length,
    local_runtime: run.local_runtime ?? null,
    resumes: events.filter((e) => e.type === "run_resumed").length,
    human_relay_count: humanRelayCount(events),
    founder_review: {
      pending: records.filter((r) => r.founder_verdict === "pending").length,
      accept: records.filter((r) => r.founder_verdict === "accept").length,
      reject: records.filter((r) => r.founder_verdict === "reject").length,
    },
    generated_at: new Date().toISOString(),
  };
}

const n = (v: number | null) => (v === null ? "not observed" : v.toLocaleString("en-US"));
const secs = (ms: number | null) => (ms === null ? "not observed" : `${(ms / 1000).toFixed(1)}s`);
const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${a}/${b} (${Math.round((a / b) * 100)}%)`);

export function renderMarkdown(r: RunReport): string {
  const clusters = Object.entries(r.failure_codes).slice(0, 5);
  const gateRow = (name: string, t: GateTally) => `| ${name} | ${t.pass} | ${t.fail} | ${t.not_evaluated} |`;
  return [
    "# BTY FOUNDRY — ARENA BASELINE",
    "",
    `- Source SHA: \`${r.source_git_sha}\`${r.source_dirty ? " (**dirty tree**)" : ""}`,
    `- Benchmark: ${r.benchmark_id} v${r.benchmark_version} (\`${r.benchmark_hash.slice(0, 12)}\`)`,
    `- Model: ${r.provider.model} — ${r.provider.provider_mode}, endpoint ${r.provider.base_url_class}${r.local_runtime ? ` · ${r.local_runtime.kind} ${r.local_runtime.version ?? ""} num_ctx ${r.local_runtime.num_ctx ?? "unknown"}` : ""}`,
    `- Pipeline: ${r.pipeline} · harness ${r.harness_version} · evaluator ${r.evaluator_version}`,
    r.replay_of ? `- Replay of: ${r.replay_of}` : "",
    "",
    `Cases: ${r.cases_planned} planned · ${r.cases_completed} completed`,
    `Candidates: ${r.candidates_planned} planned · ${r.candidates_completed} completed · ${r.candidates_pending} pending`,
    `Valid: ${r.valid} · Rejected: ${r.invalid}`,
    `First pass valid: ${pct(r.first_pass.valid, r.first_pass.measured)}`,
    `Service repair (bounded retry): ${r.service_repair.succeeded}/${r.service_repair.attempted} succeeded`,
    r.pipeline === "simple" ? `Product repair (Simple Mode): ${r.product_repair.succeeded}/${r.product_repair.attempted} succeeded` : "",
    "",
    "## Top failure clusters",
    ...(clusters.length ? clusters.map(([code, count], i) => `${i + 1}. \`${code}\` — ${count}`) : ["None observed."]),
    "",
    "## Deterministic gates — Layer A (existing Arena authority)",
    "| gate | pass | fail | not evaluated |",
    "|---|---|---|---|",
    ...Object.entries(r.layer_a).map(([k, t]) => gateRow(k === "journey_approvable" ? `${k} (informational)` : k, t)),
    "",
    "## Product-quality vector — Layer B",
    "| dimension | pass | fail | not evaluated |",
    "|---|---|---|---|",
    ...LAYER_B_DIMENSIONS.map((d) => gateRow(d, r.layer_b[d])),
    `All Layer B dimensions passed: ${r.layer_b_all_pass} of ${r.valid} valid candidates`,
    "",
    "## Model",
    `- calls: ${r.model.provider_calls} (service retries: ${r.model.service_retries})`,
    `- tokens: prompt ${n(r.model.prompt_tokens)} · completion ${n(r.model.completion_tokens)} · total ${n(r.model.total_tokens)}`,
    `- provider time: ${secs(r.model.provider_duration_ms)}`,
    `- elapsed per candidate: p50 ${secs(r.elapsed_ms.p50)} · p90 ${secs(r.elapsed_ms.p90)} · max ${secs(r.elapsed_ms.max)} · total ${secs(r.elapsed_ms.total)}`,
    "",
    `Harness errors: ${r.harness_errors} · Resumes: ${r.resumes} · Context truncation suspected: ${r.context_truncation_suspected}`,
    `Human relay: ${r.human_relay_count}`,
    "",
    `Founder review: ${r.founder_review.pending} pending · ${r.founder_review.accept} accepted · ${r.founder_review.reject} rejected`,
    "",
    "No production changes made: the generator ran against an in-memory ledger; no database, deployment or message was touched.",
    "",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}

export function loadRecords(runId: string): GenerationRecord[] {
  return listGenFiles(runId).flatMap((f) => {
    const r = readJson<GenerationRecord>(f);
    return r ? [r] : [];
  });
}

export function writeReport(run: RunManifest): RunReport {
  const report = computeReport(run, loadRecords(run.run_id), readEvents(run.run_id));
  writeJsonAtomic(path.join(runDir(run.run_id), "report.json"), report);
  writeFileSync(path.join(runDir(run.run_id), "report.md"), renderMarkdown(report));
  writeJsonAtomic(path.join(runDir(run.run_id), "state.json"), {
    run_id: run.run_id,
    candidates_planned: report.candidates_planned,
    candidates_completed: report.candidates_completed,
    candidates_pending: report.candidates_pending,
    valid: report.valid,
    invalid: report.invalid,
    harness_errors: report.harness_errors,
    updated_at: report.generated_at,
  });
  return report;
}
