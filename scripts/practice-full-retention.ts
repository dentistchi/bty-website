/**
 * TRACKED FULL-RETENTION EXPERIMENT RUNNER (Slice 3.2I-R5B1A.1-R2.31).
 *
 * THE MISS THIS FIXES.
 *
 * The 2026-09-11 full-retention 36-run was executed from an untracked temporary runner that later
 * disappeared. Its evidence survived; the thing that produced it did not. Nobody could answer "what
 * script was that?" from the repository, so the run was not reproducible and the READY verdict that
 * preceded it was test-proven but not runner-proven.
 *
 *   READY = tracked executable entry point
 *         + tracked evidence schema/assembler
 *         + tested durable evidence path
 *
 * This file is the first term. `retentionRecord.ts` is the second.
 *
 * WHAT IT DOES NOT DO
 *
 * It writes no bytes itself — durable records leave through `writeRetentionRecord`, the one existing
 * authority. It assembles no record shape — that is `retentionRecord.ts`. It changes no reviewer, no
 * prompt, no gate. It is a matrix driver and nothing else.
 *
 * PROVIDER FAKE
 *
 * `--provider-fake` starts a local HTTP server and points `LLM_BASE_URL` at it. The faked surface is
 * therefore the PROVIDER ADAPTER and nothing below it: real DTO parsing, real construction capture,
 * real observer, real assembler, real writer, real disk. A fake injected further down would prove
 * only that the fake works.
 *
 * USAGE
 *
 *   npx tsx scripts/practice-full-retention.ts \
 *     --experiment-id fullret37 \
 *     --fixtures c01-missed-commitment,c09-transparency-verification \
 *     --architectures legacy,plan_render_v1 \
 *     --runs 9 \
 *     --correction disabled \
 *     --artifact-dir .eval-artifacts
 *
 *   add --provider-fake for a dry run that makes no live provider call.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { generateArenaScenarioDraft, __setGenObserver, type GenObservation } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";
import { writeRetentionRecord, type RetentionIdentity } from "@/lib/bty/foundry/arena/evalArtifact";
import { createRetentionCollector, type RetentionRecord } from "@/lib/bty/foundry/arena/retentionRecord";
import { EVAL_CORPUS } from "@/lib/bty/foundry/arena/practice-generation.eval";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview } from "@/domain/foundry/arena-draft/providerDto.fixture";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argOf = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined || v.startsWith("--")) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
};
const listOf = (name: string, fallback: string): string[] =>
  argOf(name, fallback).split(",").map((s) => s.trim()).filter(Boolean);
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

export type RunnerConfig = {
  experimentId: string;
  fixtures: string[];
  architectures: Array<"legacy" | "plan_render_v1">;
  runs: number;
  correction: "enabled" | "disabled";
  artifactDir: string;
  providerFake: boolean;
  /** Short deadline used only by the dry run, so the REAL timeout path runs without a 120 s wait. */
  caseDeadlineMs?: number;
};

export function readConfig(): RunnerConfig {
  return {
    experimentId: argOf("experiment-id"),
    fixtures: listOf("fixtures", "c01-missed-commitment,c09-transparency-verification"),
    architectures: listOf("architectures", "legacy,plan_render_v1") as RunnerConfig["architectures"],
    runs: Number(argOf("runs", "9")),
    correction: argOf("correction", "disabled") as "enabled" | "disabled",
    artifactDir: argOf("artifact-dir", ".eval-artifacts"),
    providerFake: flag("provider-fake"),
    ...(process.argv.includes("--case-deadline-ms") ? { caseDeadlineMs: Number(argOf("case-deadline-ms")) } : {}),
  };
}

/** Every configured cell, expanded once. One identity = one durable artifact, always. */
export function buildMatrix(c: RunnerConfig): Array<RetentionIdentity> {
  const out: RetentionIdentity[] = [];
  for (const fixtureId of c.fixtures) {
    for (const architecture of c.architectures) {
      for (let runNumber = 1; runNumber <= c.runs; runNumber++) {
        out.push({ experimentId: c.experimentId, fixtureId, architecture, runNumber });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Provider fake — the ONLY faked surface
// ---------------------------------------------------------------------------

export type FakePlan = "success" | "gate_reject" | "malformed" | "timeout";

/**
 * The draft the fake provider returns. Deliberately a VALID branched scenario, so the dry run
 * exercises the real gates rather than tripping on a malformed shape.
 */
const FAKE_DRAFT = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: {
    choices: [
      { id: "p1", label: "Stop the line now and tell the client why, accepting the delay" },
      { id: "p2", label: "Check the gap yourself first, accepting that the clock keeps running" },
    ],
  },
  tradeoff: {
    escalationText: "A second stakeholder asks for a firm date within the hour.",
    choices: [
      { id: "ft1", label: "Give the range you can defend and name what would change it" },
      { id: "ft2", label: "Narrow the commitment to the one milestone you control" },
    ],
  },
  actionDecision: {
    prompt: "Commit to what?",
    choices: [
      { id: "fa1", label: "Tell the client which part slips", isActionCommitment: true },
      { id: "fa2", label: "Confirm the scope before committing a date", isActionCommitment: false },
    ],
  },
  branches: {
    p1: {
      resultingWorldState: "You stopped the line and said so openly.",
      escalationText: "The client asks who is accountable while the team waits.",
      tradeoffChoices: [
        { id: "p1t1", label: "Own the call publicly and absorb the criticism" },
        { id: "p1t2", label: "Bring your manager in to back the decision, accepting how it looks" },
      ],
      actionDecision: {
        prompt: "Commit to what?",
        choices: [
          { id: "p1a1", label: "Send one written update naming the slip", isActionCommitment: true },
          { id: "p1a2", label: "Hold the update until the check completes", isActionCommitment: false },
        ],
      },
    },
    p2: {
      resultingWorldState: "You verified the gap before saying anything.",
      escalationText: "The team has already moved on while you were checking.",
      tradeoffChoices: [
        { id: "p2t1", label: "Correct the record now and explain the delay" },
        { id: "p2t2", label: "Leave the past alone and apply the standard from here" },
      ],
      actionDecision: {
        prompt: "Commit to what?",
        choices: [
          { id: "p2a1", label: "Publish a short correction to the same channel", isActionCommitment: true },
          { id: "p2a2", label: "Brief only the two people still at risk", isActionCommitment: false },
        ],
      },
    },
  },
} as never;

/** A structurally valid Plan, so the PTR dry run reaches Render instead of dying at plan shape. */
const FAKE_PLAN = {
  primary: {
    dimensionId: "response_stance",
    dimension: "지금 알릴지, 확인을 먼저 할지",
    tension: "투명성과 정확성이 함께 걸려 있다",
    choices: [
      { id: "p1", stance: "지금 알린다", acceptedCost: "확인되지 않은 내용이 남는다" },
      { id: "p2", stance: "확인을 먼저 한다", acceptedCost: "상대가 더 오래 기다린다" },
    ],
  },
  branches: [
    {
      primaryChoiceId: "p1",
      resultingWorldState: "상대는 소식을 들었지만 복구 계획은 아직 없다",
      tradeoff: { dimensionId: "explanation_depth", dimension: "얼마나 설명할지", tension: "솔직함과 불안 사이" },
      action: { dimensionId: "who_hears_first", dimension: "누구에게 먼저 알릴지" },
    },
    {
      primaryChoiceId: "p2",
      resultingWorldState: "확인은 끝났지만 상대는 아직 아무 소식을 못 들었다",
      tradeoff: { dimensionId: "coverage_source", dimension: "공백을 어디서 메울지", tension: "피로와 비용 사이" },
      action: { dimensionId: "rota_commitment", dimension: "일정을 언제 확정할지" },
    },
  ],
};

/** Both branches share one action set, so a real deterministic gate rejects it. */
const FAKE_GATED = JSON.parse(JSON.stringify(FAKE_DRAFT)) as typeof FAKE_DRAFT;
(FAKE_GATED as unknown as { branches: Record<string, { actionDecision: unknown }> }).branches.p2.actionDecision = JSON.parse(
  JSON.stringify((FAKE_DRAFT as unknown as { branches: Record<string, { actionDecision: unknown }> }).branches.p1.actionDecision),
);


async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * A real HTTP endpoint the real LLM client talks to. The timeout plan simply never answers in time,
 * so the orchestrator's own abort path runs — a timeout is not simulated by writing a timeout record.
 */
export async function startProviderFake(plans: () => { plan: FakePlan; respond: (body: string) => string }) {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const body = await readBody(req);
      const { plan, respond } = plans();
      if (plan === "timeout") return; // no response: the real deadline path takes over
      res.writeHead(200, { "content-type": "application/json" });
      res.end(respond(body));
    })();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export type RunOutcome = { identity: RetentionIdentity; terminalOutcome: string | null; parityGrade: string | undefined; path: string };

/**
 * Drive ONE configured cell to a terminal record.
 *
 * The retention identity is flushed to disk BEFORE the provider is ever called, then updated after
 * every evidence-bearing observation. An interrupted process leaves the last complete record, never
 * a truncated one and never nothing.
 */
export async function runOne(
  config: RunnerConfig,
  identity: RetentionIdentity,
  onFlush?: (record: RetentionRecord) => void,
): Promise<RunOutcome> {
  const evalCase = EVAL_CORPUS.find((c) => c.id === identity.fixtureId);
  if (!evalCase) throw new Error(`unknown fixture ${identity.fixtureId}`);

  let lastPath = "";
  const collector = createRetentionCollector(
    { ...identity, correctionEnabled: config.correction === "enabled" },
    (record) => {
      lastPath = writeRetentionRecord(config.artifactDir, identity, JSON.stringify(record, null, 1)).path;
      onFlush?.(record);
    },
  );

  // STRICT-PARITY PRECONDITION. Construction is content-derived evidence and is hidden when
  // captureContent is false, so a strict run without it would silently produce weaker evidence.
  __setGenObserver((o: GenObservation) => collector.observe(o), { captureContent: true });

  const startedAt = Date.now();
  let terminalOutcome: string | null = null;
  try {
    const execution =
      identity.architecture === "plan_render_v1"
        ? ({ architecture: "plan_render_v1", correction: "disabled" } as const)
        : ({ architecture: "legacy", correction: config.correction } as const);
    const result = await generateArenaScenarioDraft(evalCase.input, null, execution);
    terminalOutcome = result.ok ? "generated" : (result as { reason?: string }).reason ?? "generation_rejected";
  } catch (e) {
    // Sanitized: an SDK error can carry request headers, so only its name survives.
    terminalOutcome = e instanceof Error ? `orchestrator_${e.name}` : "orchestrator_exception";
  } finally {
    __setGenObserver(null);
  }

  const record = collector.finalize({ terminalOutcome, totalMs: Date.now() - startedAt });
  return { identity, terminalOutcome, parityGrade: record.parityGrade, path: lastPath };
}

export async function main(): Promise<void> {
  const config = readConfig();
  const matrix = buildMatrix(config);
  console.info(`TRACKED RUNNER: scripts/practice-full-retention.ts`);
  console.info(`COMMAND: ${process.argv.slice(1).join(" ")}`);
  console.info(`captureContent = true (STRICT-PARITY precondition asserted before any provider call)`);
  console.info(`CONFIGURED RUN COUNT: ${matrix.length}`);

  let fake: { url: string; close: () => Promise<void> } | null = null;
  if (config.providerFake) {
    /*
      ONE plan for the whole dry run, chosen by `--fake-plan`. Per-request cycling was tried and
      removed: a single generation spends several provider calls (plan, render, boundary, review),
      so advancing the plan per request describes nothing a reader could reason about. Run the script
      once per outcome class instead — that is also what a real matrix does.
    */
    const plan = (argOf("fake-plan", "success") as FakePlan);
    fake = await startProviderFake(() => {
      return {
        plan,
        respond: (body: string) => {
          const parsed = JSON.parse(body) as {
            messages?: Array<{ content?: string }>;
            response_format?: { json_schema?: { name?: string } };
          };
          // Routing by the declared response schema name is exact; sniffing prose is not.
          const schema = parsed.response_format?.json_schema?.name ?? "";
          const wrap = (content: string) => JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] });
          if (schema === "arena_decision_plan_v1") return wrap(JSON.stringify(FAKE_PLAN));
          if (isBoundaryReviewRequest(parsed)) return wrap(compliantBoundaryReview(parsed));
          if (isReviewRequest(parsed)) return wrap(JSON.stringify(acceptReview(FAKE_DRAFT, {}, [])));
          if (plan === "malformed") return wrap("{not json");
          return wrap(providerJson(plan === "gate_reject" ? FAKE_GATED : FAKE_DRAFT, undefined, []));
        },
      };
    });
    process.env.LLM_BASE_URL = fake.url;
    process.env.LLM_API_KEY = "provider-fake";
    console.info(`PROVIDER FAKE: ${fake.url} plan=${plan} (adapter only; everything downstream is real)`);
  }

  let executed = 0;
  const durable: RunOutcome[] = [];
  try {
    for (const identity of matrix) {
      durable.push(await runOne(config, identity));
      executed++;
    }
  } finally {
    if (fake) await fake.close();
  }
  console.info(`EXECUTED RUN COUNT: ${executed}`);
  for (const d of durable) {
    console.info(`  ${d.identity.fixtureId}/${d.identity.architecture}#${d.identity.runNumber} outcome=${d.terminalOutcome} parityGrade=${d.parityGrade} path=${d.path}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("practice-full-retention.ts")) {
  main().catch((e) => {
    console.error("RUNNER FAILED:", e);
    process.exit(1);
  });
}
