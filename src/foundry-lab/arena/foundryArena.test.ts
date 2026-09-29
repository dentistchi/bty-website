/**
 * BTY FOUNDRY LAB — Arena baseline harness (M0) — focused tests. No network, no database, no model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  benchmarkHash,
  buildLock,
  caseHash,
  loadManifest,
  validateManifest,
  type BenchmarkManifest,
} from "./manifest";
import { applyProviderEnv, classifyBaseUrl, PaidProviderNotAllowed, providerIdentity, redact } from "./provider";
import { runGeneration, type GenerationOutcome } from "./adapter";
import { evaluate, LAYER_B_DIMENSIONS } from "./evaluate";
import { mockGenerate } from "./mockGenerate";
import { assertResumable, createRun, executeRun, loadRun, pendingSlots, type GenerationRecord, type RunOptions } from "./runner";
import { appendEvent, genFile, readEvents, readJson, runDir, writeJsonAtomic } from "./store";
import { computeReport, humanRelayCount, loadRecords, percentile, renderMarkdown, writeReport } from "./report";
import { parseArgs, providerFrom } from "./cli";

const { manifest, hash } = loadManifest();
const SHA = "64169c6c033b5cba0ad32435861088411071e992";
let home = "";
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  home = mkdtempSync(path.join(tmpdir(), "foundry-test-"));
  process.env.FOUNDRY_HOME = home;
  savedEnv = { ...process.env };
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  process.env = savedEnv;
  vi.unstubAllGlobals();
});

const baseOpts = (over: Partial<RunOptions> = {}): RunOptions => ({
  manifest,
  manifestFile: path.join(process.cwd(), "src/foundry-lab/arena/benchmark/arena-training-v1.json"),
  benchmarkHash: hash,
  provider: { mode: "mock", model: "mock", baseUrl: null },
  pipeline: "generator",
  generations: 2,
  caseIds: ["arena-training-001", "arena-training-002", "arena-training-003"],
  source: { sha: SHA, dirty: false },
  generate: mockGenerate,
  ...over,
});

describe("benchmark manifest", () => {
  it("the shipped manifest is valid against its lock and the product's own builder gates", () => {
    expect(validateManifest(manifest, buildLock(manifest))).toEqual([]);
    expect(manifest.cases).toHaveLength(20);
    expect(new Set(manifest.cases.map((c) => c.locale))).toEqual(new Set(["en", "ko"]));
  });

  it("stable IDs: exactly arena-training-001 … 020, in order, frozen by the lock file", () => {
    const ids = manifest.cases.map((c) => c.case_id);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => `arena-training-${String(i + 1).padStart(3, "0")}`));
    const lock = JSON.parse(readFileSync("src/foundry-lab/arena/benchmark/arena-training-v1.lock.json", "utf8"));
    expect(Object.keys(lock.cases)).toEqual(ids);
    for (const c of manifest.cases) expect(lock.cases[c.case_id]).toBe(caseHash(c));
  });

  it("no case names a model (model choice is runtime configuration)", () => {
    const text = JSON.stringify(manifest).toLowerCase();
    for (const m of ["gpt-", "gemma", "llama", "qwen", "claude", "gpt-oss", "model"]) expect(text, m).not.toContain(`"${m}`);
    for (const c of manifest.cases) expect(Object.keys(c).sort()).toEqual(["answers", "case_id", "category", "locale"]);
  });

  it("editing a case without a new version, removing one, or duplicating an id is refused", () => {
    const lock = buildLock(manifest);
    const edited = structuredClone(manifest) as BenchmarkManifest;
    edited.cases[0].answers.observableBehavior = "Something else entirely.";
    expect(validateManifest(edited, lock)).toContain("case_changed_without_new_version:arena-training-001");
    const removed = { ...manifest, cases: manifest.cases.slice(1) };
    expect(validateManifest(removed, lock)).toContain("locked_case_removed:arena-training-001");
    const dup = { ...manifest, cases: [...manifest.cases, manifest.cases[0]] };
    expect(validateManifest(dup)).toContain("case_id_duplicate:arena-training-001");
    const incomplete = structuredClone(manifest) as BenchmarkManifest;
    delete (incomplete.cases[1].answers as Record<string, unknown>).observableBehavior;
    expect(validateManifest(incomplete).some((e) => e.startsWith("program_context_incomplete:arena-training-002"))).toBe(true);
    expect(validateManifest({ ...manifest, benchmark_version: "v1" })).toContain("benchmark_version_invalid");
  });

  it("the benchmark hash is order-independent and moves with any case content", () => {
    const reversed = { ...manifest, cases: [...manifest.cases].reverse() };
    expect(benchmarkHash(reversed)).toBe(hash);
    const edited = structuredClone(manifest) as BenchmarkManifest;
    edited.cases[5].answers.title = "x";
    expect(benchmarkHash(edited)).not.toBe(hash);
  });
});

describe("provider identity, safety and redaction", () => {
  it("classifies endpoints without keeping more than the host", () => {
    expect(classifyBaseUrl("http://127.0.0.1:11434/v1")).toBe("loopback");
    expect(classifyBaseUrl("http://100.101.2.3:11434/v1")).toBe("private_network");
    expect(classifyBaseUrl("https://api.openai.com/v1")).toBe("public");
    expect(classifyBaseUrl(undefined)).toBe("absent");
    expect(providerIdentity({ mode: "local", baseUrl: "http://127.0.0.1:11434/v1", model: "m" })).toEqual({
      provider_mode: "local", base_url_class: "loopback", base_url_host: "127.0.0.1", model: "m",
    });
  });

  it("local mode strips every provider key so none is sent to the local server, and refuses a public URL", () => {
    const env: NodeJS.ProcessEnv = { OPENAI_API_KEY: "sk-test-abcdefghijklmnopqrstu", LLM_API_KEY: "x" };
    applyProviderEnv({ mode: "local", baseUrl: "http://127.0.0.1:11434/v1", model: "gemma4:31b" }, {}, env);
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.LLM_API_KEY).toBeUndefined();
    expect(env.LLM_BASE_URL).toBe("http://127.0.0.1:11434/v1");
    expect(env.LLM_MODEL).toBe("gemma4:31b");
    expect(() => applyProviderEnv({ mode: "local", baseUrl: "https://api.openai.com/v1", model: "m" }, {}, {})).toThrow(/loopback or private/);
  });

  it("a paid provider is refused unless explicitly allowed", () => {
    expect(() => applyProviderEnv({ mode: "frontier", baseUrl: null, model: "gpt-4o-mini" }, {}, {})).toThrow(PaidProviderNotAllowed);
    const env: NodeJS.ProcessEnv = { LLM_BASE_URL: "http://127.0.0.1:1/v1" };
    applyProviderEnv({ mode: "frontier", baseUrl: null, model: "gpt-4o-mini" }, { allowPaid: true }, env);
    expect(env.LLM_BASE_URL).toBeUndefined();
  });

  it("redaction removes credential keys and masks credential-shaped values, and keeps token COUNTS", () => {
    const out = redact({
      api_key: "a", Authorization: "Bearer abcdefghijkl", nested: { service_role_key: "k", note: "used sk-abcdefghijklmnopqrstuvwxyz here" },
      prompt_tokens: 4782, total_tokens: 5177,
    });
    expect(out).toEqual({ nested: { note: "used [REDACTED] here" }, prompt_tokens: 4782, total_tokens: 5177 });
  });

  it("CLI defaults: local Ollama endpoint; the model is runtime config", () => {
    delete process.env.FOUNDRY_LLM_MODEL;
    delete process.env.FOUNDRY_LLM_BASE_URL;
    expect(providerFrom({})).toEqual({ mode: "local", model: "gemma4:31b", baseUrl: "http://127.0.0.1:11434/v1" });
    expect(providerFrom({ model: "gpt-oss:120b" }).model).toBe("gpt-oss:120b");
    expect(parseArgs(["replay", "run-1", "--model", "x", "--critic"])).toEqual({ command: "replay", positional: ["run-1"], flags: { model: "x", critic: true } });
  });
});

describe("the seam: the REAL generator runs unchanged against the in-memory ledger", () => {
  it("records the production ledger rows (calls, tokens, outcome) with no database and the local placeholder key", async () => {
    applyProviderEnv({ mode: "local", baseUrl: "http://127.0.0.1:11434/v1", model: "stub-model" });
    const seen: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ choices: [{ message: { content: "this is not a program" }, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 } }), { status: 200 });
    }));
    const o = await runGeneration(manifest.cases[3], { pipeline: "generator", sourceSha: SHA });
    expect(o.ok).toBe(false);
    expect(o.final_error_code).toBe("invalid_output");
    // The service's own bounded retry: exactly MAX_ATTEMPTS = 2 provider calls, both recorded.
    expect(o.attempts[0].ledger_calls.map((c) => c.call_kind)).toEqual(["authorship", "authorship_retry"]);
    expect(o.attempts[0].ledger_calls[0].prompt_tokens).toBe(11);
    expect(o.attempts[0].ledger_attempt?.deploy_version).toBe(SHA);
    expect(o.attempts[0].ledger_attempt?.outcome).toBeDefined();
    expect(seen).toHaveLength(2);
    expect(seen[0].url).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(seen[0].auth).toBe("Bearer ollama");
    expect(seen[0].body.model).toBe("stub-model");
    expect((seen[0].body.response_format as { type: string }).type).toBe("json_schema");
  });
});

describe("evaluation", () => {
  it("is deterministic, and a refused generation is never evaluated as a pass or a fail on Layer B", async () => {
    const c = manifest.cases[1];
    const o = await runGeneration(c, { pipeline: "generator", sourceSha: SHA, generate: mockGenerate });
    expect(evaluate(c, o)).toEqual(evaluate(c, structuredClone(o)));
    const refused: GenerationOutcome = { ...o, ok: false, proposal: null, final_error_code: "invalid_output", final_refusal_code: "non_observable_standard" };
    const e = evaluate(c, refused);
    expect(e.layer_a.program_validation).toEqual({ status: "FAIL", source: "existing:validateProgramProposal", detail: "non_observable_standard" });
    for (const d of LAYER_B_DIMENSIONS) expect(e.layer_b[d].status).toBe("NOT_EVALUATED");
    expect(e.layer_b_summary).toEqual({ evaluated: 0, passed: 0, failed: [], all_pass: null });
  });

  it("every Layer B dimension names its source; mapped ones point at existing authority", async () => {
    const c = manifest.cases[1];
    const e = evaluate(c, await runGeneration(c, { pipeline: "generator", sourceSha: SHA, generate: mockGenerate }));
    for (const d of LAYER_B_DIMENSIONS) expect(e.layer_b[d].source).toMatch(/^(existing|foundry):/);
    expect(e.layer_b.structure.source).toBe("existing:missingProgramKinds");
    expect(e.layer_b_summary.evaluated).toBe(LAYER_B_DIMENSIONS.filter((d) => e.layer_b[d].status !== "NOT_EVALUATED").length);
  });
});

describe("durable state, resume and interruption", () => {
  it("a run persists every candidate with its identity, and founder fields start pending", async () => {
    const run = createRun(baseOpts());
    await executeRun(run, baseOpts());
    const r = readJson<GenerationRecord>(genFile(run.run_id, "arena-training-002", 2))!;
    expect(r).toMatchObject({
      run_id: run.run_id, case_id: "arena-training-002", generation_index: 2, source_git_sha: SHA,
      benchmark_version: "1.0.0", benchmark_hash: hash, status: "completed", attempt_count: 1,
      founder_verdict: "pending", founder_rejection_reason: null, provider: { provider_mode: "mock", model: "mock" },
    });
    expect(r.case_hash).toBe(caseHash(manifest.cases[1]));
    expect(loadRun(run.run_id).case_ids).toEqual(["arena-training-001", "arena-training-002", "arena-training-003"]);
  });

  it("an interrupted run resumes: only missing slots execute, and a slot started-but-unfinished runs again", async () => {
    const run = createRun(baseOpts());
    const first = await executeRun(run, baseOpts({ maxSlots: 2 }));
    expect(first).toEqual({ executed: 2, remaining: 4 });
    // Simulate a crash mid-slot: started in the log, no gen file.
    appendEvent(run.run_id, { type: "slot_started", case_id: "arena-training-002", generation_index: 1 });
    expect(pendingSlots(run).map((s) => `${s.case_id}#${s.generation_index}`)).toEqual([
      "arena-training-002#1", "arena-training-002#2", "arena-training-003#1", "arena-training-003#2",
    ]);
    appendEvent(run.run_id, { type: "run_resumed" });
    const second = await executeRun(loadRun(run.run_id), baseOpts());
    expect(second).toEqual({ executed: 4, remaining: 0 });
    expect(readJson<GenerationRecord>(genFile(run.run_id, "arena-training-002", 1))!.attempt_count).toBe(2);
    expect(readJson<GenerationRecord>(genFile(run.run_id, "arena-training-001", 1))!.attempt_count).toBe(1);
    expect(loadRecords(run.run_id)).toHaveLength(6);
  });

  it("a harness fault leaves the slot pending (never a fake result) and the next resume completes it", async () => {
    let calls = 0;
    const flaky: RunOptions["generate"] = async (a, b) => {
      calls++;
      if (calls === 3) throw new Error("simulated crash");
      return mockGenerate(a, b);
    };
    const run = createRun(baseOpts());
    const r1 = await executeRun(run, baseOpts({ generate: flaky }));
    expect(r1.remaining).toBe(1);
    expect(readEvents(run.run_id).filter((e) => e.type === "slot_error")).toHaveLength(1);
    const r2 = await executeRun(run, baseOpts());
    expect(r2).toEqual({ executed: 1, remaining: 0 });
  });

  it("resume refuses a different source SHA, benchmark, dirtiness or model", () => {
    const run = createRun(baseOpts());
    const ok = { benchmarkHash: hash, source: { sha: SHA, dirty: false }, provider: { mode: "mock" as const, model: "mock", baseUrl: null } };
    expect(() => assertResumable(run, ok)).not.toThrow();
    expect(() => assertResumable(run, { ...ok, source: { sha: "f".repeat(40), dirty: false } })).toThrow(/source moved/);
    expect(() => assertResumable(run, { ...ok, benchmarkHash: "x" })).toThrow(/benchmark changed/);
    expect(() => assertResumable(run, { ...ok, source: { sha: SHA, dirty: true } })).toThrow(/working-tree/);
    expect(() => assertResumable(run, { ...ok, provider: { mode: "local", model: "other", baseUrl: "http://127.0.0.1:1/v1" } })).toThrow(/provider/);
  });

  it("serialization: atomic JSON round-trips and a torn final event line is tolerated", () => {
    const f = path.join(home, "x", "y.json");
    writeJsonAtomic(f, { a: 1, nested: { b: [1, 2] } });
    expect(readJson(f)).toEqual({ a: 1, nested: { b: [1, 2] } });
    appendEvent("r1", { type: "run_started" });
    appendFileSync(path.join(runDir("r1"), "events.jsonl"), '{"at":"2026-09-29","type":"slot_st');
    expect(readEvents("r1").map((e) => e.type)).toEqual(["run_started"]);
  });
});

describe("report", () => {
  it("counts only what was observed, including first pass, repairs, failure clusters and percentiles", async () => {
    const opts = baseOpts({ pipeline: "simple", caseIds: manifest.cases.map((c) => c.case_id), generations: 1 });
    const run = createRun(opts);
    await executeRun(run, opts);
    const records = loadRecords(run.run_id);
    const r = computeReport(run, records, readEvents(run.run_id));
    expect(r.candidates_planned).toBe(20);
    expect(r.candidates_completed).toBe(20);
    expect(r.valid + r.invalid).toBe(20);
    expect(r.valid).toBe(records.filter((x) => x.valid).length);
    expect(r.first_pass.measured).toBe(20);
    expect(r.first_pass.valid).toBe(records.filter((x) => x.first_pass_valid).length);
    expect(r.product_repair.attempted).toBe(records.filter((x) => x.product_repair.attempted).length);
    expect(r.model.prompt_tokens).toBe(records.reduce((n, x) => n + (x.model_calls.prompt_tokens ?? 0), 0));
    expect(Object.values(r.failure_codes).reduce((a, b) => a + b, 0)).toBe(r.invalid);
    for (const d of LAYER_B_DIMENSIONS) {
      const t = r.layer_b[d];
      expect(t.pass + t.fail + t.not_evaluated).toBe(20);
    }
    expect(r.founder_review).toEqual({ pending: 20, accept: 0, reject: 0 });
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 50)).toBeNull();
  });

  it("never invents a token count: an unreported usage stays 'not observed'", () => {
    const run = createRun(baseOpts({ generations: 1, caseIds: ["arena-training-001"] }));
    const rec = { valid: true, failure_codes: [], evaluation: null, first_pass_valid: true, service_repair: { attempted: false, succeeded: null }, product_repair: { attempted: false, succeeded: null }, elapsed_ms: 10, case_id: "arena-training-001", founder_verdict: "pending", model_calls: { provider_calls: 1, prompt_tokens: null, completion_tokens: null, total_tokens: null, provider_duration_ms: null, service_retries: 0 } } as unknown as GenerationRecord;
    const r = computeReport(run, [rec], []);
    expect(r.model.total_tokens).toBeNull();
    expect(renderMarkdown(r)).toContain("total not observed");
  });

  it("zero human relay: an autonomous run records 0; resumes are not relay; only a human_input event counts", async () => {
    const run = createRun(baseOpts());
    await executeRun(run, baseOpts({ maxSlots: 3 }));
    appendEvent(run.run_id, { type: "run_resumed" });
    await executeRun(run, baseOpts());
    const report = writeReport(run);
    expect(report.human_relay_count).toBe(0);
    expect(report.resumes).toBe(1);
    expect(readEvents(run.run_id).some((e) => e.type === "human_input")).toBe(false);
    expect(humanRelayCount([{ at: "t", type: "human_input" }, { at: "t", type: "run_resumed" }])).toBe(1);
    expect(readFileSync(path.join(runDir(run.run_id), "report.md"), "utf8")).toContain("Human relay: 0");
  });
});
