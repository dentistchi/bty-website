/**
 * BTY FOUNDRY LAB — Arena benchmark CLI (M0).
 *
 *   npm run foundry:arena:baseline                       full baseline, local model, 20 × 3
 *   npm run foundry:arena -- baseline --cases arena-training-001 --generations 1   smoke
 *   npm run foundry:arena -- resume <run-id>             continue an interrupted run
 *   npm run foundry:arena -- replay <run-id> --model gpt-oss:120b   same cases, another model
 *   npm run foundry:arena -- report <run-id>             rebuild report.json / report.md
 *   npm run foundry:arena -- list
 *
 * Provider (runtime configuration — no case names a model):
 *   --provider local|mock|frontier   default local
 *   --base-url <url>                 default $FOUNDRY_LLM_BASE_URL or http://127.0.0.1:11434/v1
 *   --model <name>                   default $FOUNDRY_LLM_MODEL or gemma4:31b
 *   --allow-paid-provider            required for `frontier`; never implied
 *
 * The CLI never reads `.env` files and never prompts. It exits non-zero on any refusal.
 */
import path from "node:path";
import { PIPELINES, type Pipeline } from "./adapter";
import { runCritic } from "./critic";
import { BENCHMARK_DIR, DEFAULT_MANIFEST, loadManifest } from "./manifest";
import { mockGenerate } from "./mockGenerate";
import { applyProviderEnv, type ProviderConfig, type ProviderMode } from "./provider";
import { assertResumable, createRun, currentSource, executeRun, loadRun, type RunManifest, type RunOptions } from "./runner";
import { appendEvent, listRuns, runDir } from "./store";
import { writeReport } from "./report";

export const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434/v1";
export const DEFAULT_LOCAL_MODEL = "gemma4:31b";

type Flags = Record<string, string | boolean>;

export function parseArgs(argv: string[]): { command: string; positional: string[]; flags: Flags } {
  const [command = "help", ...rest] = argv;
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else positional.push(a);
  }
  return { command, positional, flags };
}

const str = (f: Flags, k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);

export function providerFrom(flags: Flags, fallback?: RunManifest["provider"]): ProviderConfig {
  const mode = (str(flags, "provider") ?? fallback?.provider_mode ?? "local") as ProviderMode;
  if (!["local", "mock", "frontier"].includes(mode)) throw new Error(`unknown provider: ${mode}`);
  const model = str(flags, "model") ?? process.env.FOUNDRY_LLM_MODEL ?? fallback?.model ?? (mode === "mock" ? "mock" : DEFAULT_LOCAL_MODEL);
  const baseUrl = mode === "local" ? (str(flags, "base-url") ?? process.env.FOUNDRY_LLM_BASE_URL ?? DEFAULT_LOCAL_BASE_URL) : null;
  return { mode, model, baseUrl };
}

async function main(argv: string[]): Promise<number> {
  const { command, positional, flags } = parseArgs(argv);
  const out = (l: string) => process.stdout.write(`${l}\n`);
  if (command === "list") {
    listRuns().forEach(out);
    return 0;
  }
  if (command === "report") {
    const run = loadRun(positional[0] ?? "");
    const r = writeReport(run);
    out(`report: ${path.join(runDir(run.run_id), "report.md")} (${r.candidates_completed}/${r.candidates_planned} candidates)`);
    return 0;
  }
  if (!["baseline", "resume", "replay"].includes(command)) {
    out("usage: foundry:arena baseline|resume <run>|replay <run>|report <run>|list [flags]");
    return command === "help" ? 0 : 2;
  }

  const manifestFile = str(flags, "manifest") ?? path.join(BENCHMARK_DIR, DEFAULT_MANIFEST);
  const { manifest, hash } = loadManifest(manifestFile);
  const source = currentSource();
  const prior = command === "baseline" ? null : loadRun(positional[0] ?? "");
  const provider = providerFrom(command === "replay" ? flags : { ...flags }, command === "resume" ? prior!.provider : undefined);
  applyProviderEnv(provider, { allowPaid: flags["allow-paid-provider"] === true });
  if (source.dirty && flags["allow-dirty"] !== true && command !== "resume") {
    throw new Error("working tree has tracked modifications; a baseline must map to an exact commit (pass --allow-dirty to record a dirty run)");
  }
  const pipeline = (str(flags, "pipeline") ?? prior?.pipeline ?? "generator") as Pipeline;
  if (!PIPELINES.includes(pipeline)) throw new Error(`unknown pipeline: ${pipeline}`);

  const opts: RunOptions = {
    manifest,
    manifestFile,
    benchmarkHash: hash,
    provider,
    pipeline,
    generations: Number(str(flags, "generations") ?? prior?.generations_per_case ?? 3),
    caseIds: str(flags, "cases")?.split(",").map((s) => s.trim()).filter(Boolean) ?? prior?.case_ids,
    critic: flags.critic === true || (command === "resume" && !!prior?.critic_enabled),
    replayOf: command === "replay" ? prior!.run_id : null,
    source,
    generate: provider.mode === "mock" ? mockGenerate : undefined,
    criticFn: runCritic,
    maxSlots: str(flags, "max-slots") ? Number(str(flags, "max-slots")) : undefined,
    log: out,
  };

  let run: RunManifest;
  if (command === "resume") {
    run = prior!;
    assertResumable(run, opts);
    appendEvent(run.run_id, { type: "run_resumed" });
  } else {
    run = createRun(opts);
  }
  out(`run ${run.run_id} — ${run.case_ids.length} cases × ${run.generations_per_case} · ${run.provider.model} (${run.provider.provider_mode}) · ${run.pipeline}`);
  const { executed, remaining } = await executeRun(run, opts);
  const report = writeReport(run);
  out(`executed ${executed} · remaining ${remaining} · valid ${report.valid}/${report.candidates_completed} · human relay ${report.human_relay_count}`);
  out(`report: ${path.join(runDir(run.run_id), "report.md")}`);
  return 0;
}

if (process.argv[1] && /cli\.(ts|js|mjs)$/.test(process.argv[1])) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`foundry:arena refused: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(1);
    },
  );
}
