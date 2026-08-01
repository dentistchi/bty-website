#!/usr/bin/env npx tsx
/**
 * Practice live stability evaluation (Slice 3.2I-R5B1A.1-R2.23D-R3).
 *
 * THE EXECUTION AUTHORITY. Vitest is no longer it.
 *
 * The R2.23D-R2 run executed the live evaluation through `practice-generation.eval.test.ts`, so
 * Vitest's default 5,000 ms `testTimeout` killed both passes at 5.01 s — against stage budgets of
 * 120 s per request across up to four requests per case. Vitest keeps deterministic corpus,
 * non-live and mock tests; it no longer runs anything that talks to a provider.
 *
 * NO TOP-LEVEL AWAIT — `package.json` declares no `"type"`, so tsx compiles to CommonJS.
 *
 *   npx tsx scripts/practice-live-stability.ts --run-id <id> --head <sha> --manifest <sha> \
 *     --passes pass1,pass2 --cases c01-…,c09-…,c18-…
 *
 * Calls the canonical generation service. No database, no Wrangler, no production endpoint, no
 * fallback. Every case writes its own immutable artifact the moment it terminates.
 */
import { join } from "node:path";
import { ARTIFACT_DIR } from "@/lib/bty/foundry/arena/evalArtifact";
import { writeCaseArtifact } from "@/lib/bty/foundry/arena/caseArtifact";
import { EXIT_CODES, runLiveStability, type LiveDeps } from "@/lib/bty/foundry/arena/liveEvaluation";
import { EVAL_CORPUS } from "@/lib/bty/foundry/arena/practice-generation.eval";
import { __setGenObserver, generateArenaScenarioDraft } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";
import { getLlmModel } from "@/lib/bty/llm/client";

/**
 * TEST-ONLY mock generation seam.
 *
 * Guarded by an environment variable the runner never sets, and every artifact it writes records
 * `model: "mock-model"`, so mock evidence is self-identifying and can never be mistaken for a live
 * run. It exists so the EXACT program the runner executes is proven end to end — including a case
 * that takes longer than five seconds — without a provider call. R2.23D-R2 shipped an execution
 * path nobody had ever run to completion.
 */
const MOCK_ENV = "BTY_LIVE_EVAL_MOCK";
const MOCK_DELAY_ENV = "BTY_LIVE_EVAL_MOCK_DELAY_MS";
/** `ok`, `content`, `infra`, `slow` — one token per case, in order. */
const MOCK_PLAN_ENV = "BTY_LIVE_EVAL_MOCK_PLAN";

function mockGenerate(plan: string[], delayMs: number): LiveDeps["generate"] {
  let n = 0;
  return async () => {
    const step = plan[n++] ?? "ok";
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (step === "content") return { ok: false, reason: "generation_rejected" as const };
    if (step === "infra") return { ok: false, reason: "generation_failed" as const };
    if (step === "hang") return await new Promise(() => {}); // never settles — the deadline must fire
    return {
      ok: true as const,
      value: {
        draft: {
          title: "Mock scenario",
          opening: "A mock opening that is long enough to read as a scene for the packet.",
          primary: { choices: [{ id: "p1", label: "Mock primary one" }, { id: "p2", label: "Mock primary two" }] },
          tradeoff: { escalationText: "Mock escalation.", choices: [{ id: "ft1", label: "Mock tradeoff one" }, { id: "ft2", label: "Mock tradeoff two" }] },
          actionDecision: { prompt: "What now?", choices: [{ id: "fa1", label: "Mock action one", isActionCommitment: true }, { id: "fa2", label: "Mock action two", isActionCommitment: false }] },
        },
        source: "ai" as const,
        warnings: [],
        constraintEvidence: {},
      },
    };
  };
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

async function main(): Promise<void> {
  const runId = arg("run-id");
  const head = arg("head");
  const manifestSha256 = arg("manifest");
  const passes = arg("passes").split(",").map((s) => s.trim()).filter(Boolean);
  const caseIds = arg("cases").split(",").map((s) => s.trim()).filter(Boolean);

  const cases = caseIds.map((id) => {
    const c = EVAL_CORPUS.find((x) => x.id === id);
    if (!c) throw new Error(`unknown case id: ${id}`);
    return c;
  });

  const useMock = process.env[MOCK_ENV] === "1";
  const dir = arg("artifact-dir", join(process.cwd(), ARTIFACT_DIR));
  const deps: LiveDeps = {
    generate: useMock
      ? mockGenerate((process.env[MOCK_PLAN_ENV] ?? "").split(",").map((s) => s.trim()).filter(Boolean), Number(process.env[MOCK_DELAY_ENV] ?? "0"))
      : (input) => generateArenaScenarioDraft(input),
    now: () => Date.now(),
    setTimer: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return { cancel: () => clearTimeout(t) };
    },
    writeArtifact: (id, payload) => writeCaseArtifact(dir, id, payload),
    observe: (fn, opts) => __setGenObserver(fn, opts),
    log: (line) => process.stdout.write(`${line}\n`),
  };

  const summary = await runLiveStability(deps, {
    runId,
    head,
    manifestSha256,
    model: useMock ? "mock-model" : getLlmModel(),
    passes,
    cases,
  });

  if (useMock) process.stdout.write("LIVE EVALUATION MOCK · LIVE PROVIDER NOT CALLED\n");
  process.stdout.write(
    `\nRUN ${summary.runId} · completed ${summary.completedCases}/${summary.expectedCases}` +
      `${summary.aborted ? ` · ABORTED (${summary.abortClassification}: ${summary.abortReason})` : ""}\n`,
  );
  process.exitCode = summary.exitCode;
}

void main().catch((error: unknown) => {
  // Sanitized: an SDK error can carry request headers, so only its name and any numeric status
  // ever reach the operator.
  const name = error instanceof Error ? error.name : "UnknownError";
  const status = (error as { status?: unknown })?.status;
  process.stderr.write(`LIVE EVALUATION FAILED · code=${name} · status=${typeof status === "number" ? status : "none"}\n`);
  process.exitCode = EXIT_CODES.infrastructure;
});
