import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CASE_DEADLINE_MS,
  EXIT_CODES,
  MAX_ATTEMPTS,
  REVIEW_TIMEOUT_MS,
  STAGE_TIMEOUT_MS,
  classifyReason,
  runLiveStability,
  type LiveDeps,
} from "./liveEvaluation";
import { ArtifactWriteError, caseArtifactPath, listCaseArtifacts, sha256, writeCaseArtifact } from "./caseArtifact";
import { EVAL_CORPUS } from "./practice-generation.eval";
import { PRACTICE_SAMPLING } from "./arenaScenarioGenerationService";
import { RUNTIME_CONFIG_SCHEMA_VERSION, canonicalRuntimeConfigJson, type StabilityRuntimeConfig } from "./runtimeConfig";

/**
 * LIVE EVALUATION RUNTIME (Slice 3.2I-R5B1A.1-R2.23D-R3).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D-R2 run cleared all 22 contract checks and both provider checks, then died at 5.01 s in
 * each pass. The killer was Vitest's default `testTimeout` of 5,000 ms: the live evaluation ran
 * through `practice-generation.eval.test.ts`, so a unit-test framework held authority over a run
 * whose own stage budgets are 120 s per request across up to four requests per case. The only
 * artifact write sat AFTER the loop over every case, so a mid-loop kill left nothing and the
 * collator truthfully reported zero.
 *
 * These tests prove the replacement: an explicit derived deadline, per-case evidence written before
 * any aggregate step, and an abort policy that stops on infrastructure and continues on content.
 */

const CASES = ["c01-missed-commitment", "c09-transparency-verification", "c18-constrained-clinical"].map(
  (id) => EVAL_CORPUS.find((c) => c.id === id)!,
);
const HEAD = "a".repeat(40);
const MANIFEST = "b".repeat(64);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bty-live-eval-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

type Step = "ok" | "content" | "infra" | "hang" | "throw";

function deps(plan: Step[], over: Partial<LiveDeps> = {}): LiveDeps & { logs: string[] } {
  const logs: string[] = [];
  let n = 0;
  return {
    generate: async () => {
      const step = plan[n++] ?? "ok";
      if (step === "content") return { ok: false, reason: "generation_rejected" };
      if (step === "infra") return { ok: false, reason: "generation_failed" };
      if (step === "throw") throw new Error("boom");
      if (step === "hang") return await new Promise(() => {});
      return { ok: true, value: { draft: { title: "t" }, source: "ai", warnings: [], constraintEvidence: {} } } as never;
    },
    now: () => 1_700_000_000_000,
    setTimer: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return { cancel: () => clearTimeout(t) };
    },
    writeArtifact: (id, payload) => writeCaseArtifact(dir, id, payload),
    observe: () => {},
    log: (l) => logs.push(l),
    logs,
    ...over,
  } as LiveDeps & { logs: string[] };
}

const config = (over: Record<string, unknown> = {}) => ({
  mode: "mock" as const,
  runId: "20260801T000000Z",
  head: HEAD,
  manifestSha256: MANIFEST,
  model: "mock-model",
  passes: ["pass1", "pass2"],
  cases: CASES,
  ...over,
});

// ---------------------------------------------------------------------------
// Timeout authority
// ---------------------------------------------------------------------------

describe("PART 3 — the case deadline is DERIVED, not chosen", () => {
  it("the formula is the real maximum stage sequence plus write headroom", () => {
    expect(STAGE_TIMEOUT_MS).toBe(120_000);
    expect(REVIEW_TIMEOUT_MS).toBe(120_000);
    expect(MAX_ATTEMPTS).toBe(2);
    // 2 x (120s generation + 120s review) + 30s serialization/write headroom
    expect(CASE_DEADLINE_MS).toBe(2 * (120_000 + 120_000) + 30_000);
    expect(CASE_DEADLINE_MS).toBe(510_000);
  });

  it("it is strictly greater than the maximum legitimate sequence, and stage timeouts are unchanged", () => {
    expect(CASE_DEADLINE_MS).toBeGreaterThan(MAX_ATTEMPTS * (STAGE_TIMEOUT_MS + REVIEW_TIMEOUT_MS));
    expect(PRACTICE_SAMPLING.generation.timeoutMs).toBe(120_000);
    expect(PRACTICE_SAMPLING.review.timeoutMs).toBe(120_000);
  });

  it("a deadline breach is INFRASTRUCTURE — never dressed up as a content rejection", async () => {
    const d = deps(["hang"]);
    const s = await runLiveStability(d, config({ caseDeadlineMs: 30, passes: ["pass1"] }));
    expect(s.aborted).toBe(true);
    expect(s.abortReason).toBe("case_deadline_exceeded");
    expect(s.abortClassification).toBe("infrastructure");
    // 5. …and the failure artifact still exists.
    const written = listCaseArtifacts(dir, "20260801T000000Z");
    expect(written).toHaveLength(1);
    const rec = JSON.parse(readFileSync(join(dir, written[0].file), "utf8"));
    expect(rec.reason).toBe("case_deadline_exceeded");
    expect(rec.reason).not.toBe("generation_rejected");
  });
});

describe("PART 6 — content and infrastructure are classified differently", () => {
  it("completed model+reviewer work is CONTENT; provider or runtime failure is INFRASTRUCTURE", () => {
    for (const r of ["generation_rejected", "no_safe_judgment_space", "boundary_confirmation_required", "fixed_answer_knowledge"]) {
      expect(classifyReason(r), r).toBe("content");
    }
    for (const r of ["generation_failed", "generation_unavailable", "structured_output_unavailable", "case_deadline_exceeded", "orchestrator_exception"]) {
      expect(classifyReason(r), r).toBe("infrastructure");
    }
  });

  it("an UNKNOWN reason fails toward infrastructure — stopping is recoverable, spending is not", () => {
    expect(classifyReason("something_new")).toBe("infrastructure");
  });

  it("4. a content rejection on case 1 does NOT stop the remaining cases", async () => {
    const d = deps(["content", "ok", "ok", "ok", "ok", "ok"]);
    const s = await runLiveStability(d, config());
    expect(s.aborted).toBe(false);
    expect(s.completedCases).toBe(6);
    expect(s.exitCode).toBe(EXIT_CODES.ok);
    expect(d.logs.some((l) => l.startsWith("CONTENT RESULT"))).toBe(true);
  });

  it("5/6. an infrastructure failure in PASS 1 prevents pass 2 entirely", async () => {
    const d = deps(["ok", "infra"]);
    const s = await runLiveStability(d, config());
    expect(s.aborted).toBe(true);
    expect(s.abortClassification).toBe("infrastructure");
    expect(s.completedCases).toBe(2); // the third case of pass 1 was never attempted
    expect(s.exitCode).toBe(EXIT_CODES.infrastructure);
    const files = listCaseArtifacts(dir).map((e) => `${e.passId}/${e.caseId}`);
    expect(files.every((f) => f.startsWith("pass1/"))).toBe(true);
  });

  it("7. a reviewer/transport failure is infrastructure, and 8. retry exhaustion is content", async () => {
    expect(classifyReason("generation_failed")).toBe("infrastructure");
    // Retry exhaustion after real model and reviewer responses surfaces as generation_rejected.
    expect(classifyReason("generation_rejected")).toBe("content");
  });

  it("an orchestrator exception is infrastructure and is sanitized", async () => {
    const d = deps(["throw"]);
    const s = await runLiveStability(d, config({ passes: ["pass1"] }));
    expect(s.abortReason).toBe("orchestrator_exception");
    const rec = JSON.parse(readFileSync(join(dir, listCaseArtifacts(dir)[0].file), "utf8"));
    expect(rec.sanitizedError).toBe("Error"); // the name, never the message
    expect(JSON.stringify(rec)).not.toContain("boom");
  });
});

// ---------------------------------------------------------------------------
// Per-case evidence
// ---------------------------------------------------------------------------

describe("PART 4/5 — six authoritative case artifacts, written before any aggregate step", () => {
  it("2. two passes x three cases produce SIX immutable case artifacts", async () => {
    const s = await runLiveStability(deps([]), config());
    expect(s.completedCases).toBe(6);
    const entries = listCaseArtifacts(dir, "20260801T000000Z");
    expect(entries).toHaveLength(6);
    expect(entries.map((e) => `${e.passId}/${e.caseId}`).sort()).toEqual([
      "pass1/c01-missed-commitment", "pass1/c09-transparency-verification", "pass1/c18-constrained-clinical",
      "pass2/c01-missed-commitment", "pass2/c09-transparency-verification", "pass2/c18-constrained-clinical",
    ]);
  });

  it("13. the path carries run, pass, case, HEAD and manifest", () => {
    expect(caseArtifactPath({ mode: "mock" as const, runId: "R", passId: "pass1", caseId: "c01", head: HEAD, manifestSha256: MANIFEST })).toBe(
      "practice-generation.stability.mock.R.pass1.c01.aaaaaaaaaaaa.bbbbbbbbbbbb.json",
    );
  });

  it("each artifact records HEAD, manifest, sampling, attempts, classification and latency", async () => {
    await runLiveStability(deps([]), config({ passes: ["pass1"], cases: [CASES[0]] }));
    const rec = JSON.parse(readFileSync(join(dir, listCaseArtifacts(dir)[0].file), "utf8"));
    for (const k of ["head", "manifestSha256", "runId", "passId", "caseId", "model", "sampling", "startedAt", "endedAt", "latencyMs", "attempts", "classification", "defectCodes"]) {
      expect(Object.keys(rec), k).toContain(k);
    }
    expect(rec.head).toBe(HEAD);
    expect(rec.manifestSha256).toBe(MANIFEST);
  });

  it("14/15. the write is atomic and the digest is verified FROM DISK", () => {
    const id = { mode: "mock" as const, runId: "R", passId: "pass1", caseId: "c01", head: HEAD, manifestSha256: MANIFEST };
    const payload = JSON.stringify({ hello: "world" });
    const w = writeCaseArtifact(dir, id, payload);
    expect(w.sha256).toBe(sha256(payload));
    expect(readFileSync(join(dir, w.path), "utf8")).toBe(payload);
    // No temporary file survives a successful write.
    expect(readdirSync(dir).filter((f) => f.includes(".tmp"))).toEqual([]);
  });

  it("9. a collision FAILS CLOSED and leaves the original untouched", () => {
    const id = { mode: "mock" as const, runId: "R", passId: "pass1", caseId: "c01", head: HEAD, manifestSha256: MANIFEST };
    writeCaseArtifact(dir, id, '{"first":true}');
    expect(() => writeCaseArtifact(dir, id, '{"second":true}')).toThrow(ArtifactWriteError);
    expect(readFileSync(join(dir, caseArtifactPath(id)), "utf8")).toBe('{"first":true}');
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(1);
  });

  it("10/16. a write failure NEVER produces a success claim — the R2.23D-R2 false-claim regression", async () => {
    const failing = deps([], {
      writeArtifact: () => {
        throw new ArtifactWriteError("disk full");
      },
    });
    const s = await runLiveStability(failing, config());
    expect(s.aborted).toBe(true);
    expect(s.abortReason).toBe("infrastructure_artifact_write_failure");
    expect(s.exitCode).toBe(EXIT_CODES.artifactFailure);
    expect(s.written).toEqual([]);
    // The exact phrase must never appear when nothing was written.
    expect(failing.logs.some((l) => l.includes("IMMUTABLE CASE ARTIFACT WRITTEN"))).toBe(false);
    expect(failing.logs.some((l) => l.includes("no evidence was preserved"))).toBe(true);
  });

  it("the success line is printed only AFTER the file exists and its digest verifies", async () => {
    const d = deps([]);
    await runLiveStability(d, config({ passes: ["pass1"], cases: [CASES[0]] }));
    const line = d.logs.find((l) => l.startsWith("IMMUTABLE CASE ARTIFACT WRITTEN"))!;
    const [, path] = /· (\S+\.json) ·/.exec(line)!;
    const [, digest] = /sha256=([0-9a-f]{64})/.exec(line)!;
    expect(existsSync(join(dir, path))).toBe(true);
    expect(sha256(readFileSync(join(dir, path), "utf8"))).toBe(digest);
  });
});

// ---------------------------------------------------------------------------
// PART 9 — the EXACT tracked program, executed
// ---------------------------------------------------------------------------

const CLI = "scripts/practice-live-stability.ts";

function runCli(env: Record<string, string>, args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("npx", ["tsx", CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

/**
 * R2.23D-R4 — ONE validated config file, exactly as the runner produces it.
 *
 * The old helper passed nine loose flags and the shell passed its own set; a name could drift
 * between the two, and one did: `EXPECT_MANIFEST` reached an operator as an unbound variable.
 * Both consumers now read the same file through the same parser, so a drifted name is a parse
 * error here rather than a runtime death after a credential prompt.
 */
let configSeq = 0;
const writeConfig = (over: Partial<StabilityRuntimeConfig> = {}): string[] => {
  const caseIds = over.caseIds ?? CASES.map((c) => c.id);
  const passIds = over.passIds ?? ["pass1", "pass2"];
  const cfg: StabilityRuntimeConfig = {
    schemaVersion: RUNTIME_CONFIG_SCHEMA_VERSION,
    mode: "mock",
    runId: "MOCKRUN",
    head: HEAD,
    contractManifestSha256: MANIFEST,
    corpusSha256: "c".repeat(64),
    canaryCaseSha256: "d".repeat(64),
    providerSchemaSha256: "e".repeat(64),
    reviewSchemaSha256: "f".repeat(64),
    samplingSha256: "0".repeat(64),
    tokenBudgetSha256: "1".repeat(64),
    artifactSchemaVersion: "practice-generation-eval/3",
    caseIds,
    passIds,
    caseDeadlineMs: 510_000,
    artifactDir: dir,
    expectedCases: caseIds.length * passIds.length,
    ...over,
  };
  const path = join(dir, `runtime-config.${configSeq++}.json`);
  writeFileSync(path, canonicalRuntimeConfigJson(cfg));
  return ["--config", path];
};

describe("PART 9 — the exact tracked orchestrator, run end to end", () => {
  it("1/2/14. six cases complete with NO provider call, and six artifacts exist", () => {
    const r = runCli({ BTY_LIVE_EVAL_MOCK: "1" }, writeConfig());
    expect(r.stderr).not.toMatch(/Top-level await|cjs output format/);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("LIVE EVALUATION MOCK · LIVE PROVIDER NOT CALLED");
    expect(r.stdout).toContain("completed 6/6");
    expect(listCaseArtifacts(dir, "MOCKRUN")).toHaveLength(6);
  });

  it("3. a case taking LONGER THAN FIVE SECONDS completes — no 5,000 ms authority exists", () => {
    // The exact failure mode: Vitest's default testTimeout killed R2.23D-R2 at 5.01 s. This runs
    // the real CLI as a child process, so no test-framework clock governs it at all.
    const started = Date.now();
    const r = runCli(
      { BTY_LIVE_EVAL_MOCK: "1", BTY_LIVE_EVAL_MOCK_DELAY_MS: "5500" },
      writeConfig({ passIds: ["pass1"], caseIds: [CASES[0].id] }),
    );
    const elapsed = Date.now() - started;
    expect(r.code).toBe(0);
    expect(elapsed).toBeGreaterThan(5_000);
    expect(r.stdout).toContain("completed 1/1");
    expect(listCaseArtifacts(dir, "MOCKRUN")).toHaveLength(1);
  }, 90_000);

  it("5/6. an infrastructure failure aborts the run and returns exit code 4", () => {
    const r = runCli({ BTY_LIVE_EVAL_MOCK: "1", BTY_LIVE_EVAL_MOCK_PLAN: "ok,infra" }, writeConfig());
    expect(r.code).toBe(EXIT_CODES.infrastructure);
    expect(r.stdout).toContain("ABORTED (infrastructure: generation_failed)");
    expect(listCaseArtifacts(dir, "MOCKRUN")).toHaveLength(2);
  });

  it("4. a content rejection does not abort — all six still run", () => {
    const r = runCli({ BTY_LIVE_EVAL_MOCK: "1", BTY_LIVE_EVAL_MOCK_PLAN: "content" }, writeConfig());
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("completed 6/6");
  });

  it("13. no credential reaches stdout, stderr or any artifact", () => {
    const SENTINEL = "sk-sentinel-MUST-NOT-APPEAR-7c2b";
    const r = runCli({ BTY_LIVE_EVAL_MOCK: "1", LLM_API_KEY: SENTINEL, OPENAI_API_KEY: SENTINEL }, writeConfig());
    expect(r.stdout).not.toContain(SENTINEL);
    expect(r.stderr).not.toContain(SENTINEL);
    for (const f of readdirSync(dir)) {
      expect(readFileSync(join(dir, f), "utf8"), f).not.toContain(SENTINEL);
    }
  });

  it("the mock is TEST-ONLY — env-guarded, self-identifying, and not a runner flag", () => {
    const src = readFileSync(join(process.cwd(), CLI), "utf8");
    expect(src).toContain('const MOCK_ENV = "BTY_LIVE_EVAL_MOCK"');
    expect(src).toContain('model: useMock ? "mock-model" : getLlmModel()');
    expect(src).not.toMatch(/--mock|--offline|--skip-provider/);
    // No TOP-LEVEL await: package.json declares no "type", so tsx compiles to CommonJS. Awaits
    // inside function bodies are fine and expected; a column-0 await is the measured fault.
    const code = src.replace(/^\s*\*.*$/gm, "").replace(/\/\/.*$/gm, "");
    expect(code).toMatch(/async function main\(\): Promise<void>/);
    expect(code).toMatch(/void main\(\)\.catch\(/);
    for (const line of code.split("\n")) {
      if (/\bawait\b/.test(line)) expect(line, line).toMatch(/^\s+/); // always indented, never top level
    }
  });
});

// ---------------------------------------------------------------------------
// PART 7 — collation authority
// ---------------------------------------------------------------------------

describe("PART 7 — the six case artifacts are the collation authority", () => {
  function runCollator(args: string[]): { code: number; stdout: string; stderr: string } {
    try {
      const stdout = execFileSync("npx", ["tsx", "scripts/practice-stability-collate.ts", ...args], {
        encoding: "utf8",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, stdout, stderr: "" };
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
    }
  }

  it("11. a complete run of six is reported COMPLETE", () => {
    runCli({ BTY_LIVE_EVAL_MOCK: "1" }, writeConfig());
    const json = join(dir, "out.json");
    const md = join(dir, "out.md");
    const r = runCollator([...writeConfig(), "--json", json, "--md", md]);
    expect(r.code).toBe(0);
    const s = JSON.parse(readFileSync(json, "utf8"));
    expect(s.complete).toBe(true);
    expect(s.presentCases).toBe(6);
    expect(s.missingCases).toEqual([]);
    expect(s.artifacts.every((a: { sha256: string }) => /^[0-9a-f]{64}$/.test(a.sha256))).toBe(true);
  });

  it("12. a PARTIAL run reports what exists truthfully — never zero when artifacts are present", () => {
    runCli({ BTY_LIVE_EVAL_MOCK: "1", BTY_LIVE_EVAL_MOCK_PLAN: "ok,infra" }, writeConfig());
    const json = join(dir, "partial.json");
    const md = join(dir, "partial.md");
    const r = runCollator([...writeConfig(), "--json", json, "--md", md]);
    expect(r.code).toBe(6); // incomplete
    const s = JSON.parse(readFileSync(json, "utf8"));
    expect(s.complete).toBe(false);
    expect(s.presentCases).toBe(2); // the evidence that DOES exist is preserved and reported
    expect(s.missingCases).toHaveLength(4);
    expect(s.infrastructureFailures).toBe(1);
    expect(s.requiresNewRunnerAuthorization).toBe(true);
    expect(readFileSync(md, "utf8")).toContain("THIS RUN IS INCOMPLETE — it is not stability evidence.");
  });

  it("a run with NO artifacts says so without inventing any", () => {
    const json = join(dir, "empty.json");
    const r = runCollator([...writeConfig({ runId: "NOSUCHRUN", passIds: ["pass1"], caseIds: [CASES[0].id] }), "--json", json, "--md", join(dir, "empty.md")]);
    expect(r.code).toBe(6);
    const s = JSON.parse(readFileSync(json, "utf8"));
    expect(s.presentCases).toBe(0);
    expect(s.missingCases).toEqual(["pass1/c01-missed-commitment"]);
    expect(s.results).toEqual([]);
  });
});
