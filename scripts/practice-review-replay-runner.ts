#!/usr/bin/env npx tsx
/** Thin CLI over the tracked replay-runner builder (Slice 3.2I-R5B1A.1-R2.25). */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildReplayBinding, renderReplayRunner } from "@/lib/bty/foundry/arena/reviewReplayRunnerScript";
import { buildContractManifest, manifestDigest } from "@/lib/bty/foundry/arena/contractManifest";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const manifest = manifestDigest(buildContractManifest(head, process.env.LLM_MODEL ?? "gpt-4o-mini"));
const binding = buildReplayBinding(head, manifest);

if (process.argv.includes("--binding-json")) {
  process.stdout.write(`${JSON.stringify(binding)}\n`);
} else {
  const out = arg("out");
  writeFileSync(out, renderReplayRunner(binding), { mode: 0o700 });
  process.stdout.write(`wrote ${out}\n  head     ${binding.head}\n  manifest ${binding.manifestSha256}\n  fixture  ${binding.fixtureSha256}\n  runtime  ${binding.replayRuntimeSha256}\n  subjects ${binding.subjectDigests.length}\n`);
}
