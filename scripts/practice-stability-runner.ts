#!/usr/bin/env npx tsx
/**
 * Write a Practice stability runner (Slice 3.2I-R5B1A.1-R2.23D-R1).
 *
 * Thin CLI. All render logic lives in `src/lib/bty/foundry/arena/stabilityRunnerScript.ts`, where it
 * is unit-tested — the previous generators were untracked throwaway scripts, which is exactly why a
 * truncated re-placeholder was able to accumulate four copies of one expected value unnoticed.
 *
 *   npx tsx scripts/practice-stability-runner.ts --out /tmp/<name>.sh [--head <sha>]
 *
 * No live-model call, no database, nothing written but the runner.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { buildChecks, manifestPayload, renderRunner } from "@/lib/bty/foundry/arena/stabilityRunnerScript";

const argv = process.argv.slice(2);
const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : null;
const head = argv.includes("--head")
  ? argv[argv.indexOf("--head") + 1]
  : execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

if (!out) {
  process.stderr.write("usage: practice-stability-runner.ts --out <path> [--head <sha>]\n");
  process.exit(2);
}

const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
const payload = manifestPayload(head, model);
writeFileSync(out, renderRunner(payload, head));
chmodSync(out, 0o700);
process.stdout.write(`wrote ${out}\n  head     ${head}\n  manifest ${payload.manifestSha256}\n  checks   ${buildChecks(payload).length}\n`);
