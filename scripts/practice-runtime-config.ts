#!/usr/bin/env npx tsx
/**
 * Emit and validate the Practice stability runtime config (Slice 3.2I-R5B1A.1-R2.23D-R4).
 *
 * Written and validated BEFORE the credential prompt, so a missing or drifted value fails while
 * nothing has been spent. R2.23D-R3 reconstructed the contract in shell after the prompt and died
 * on `EXPECT_MANIFEST: unbound variable` — a name that had been removed two revisions earlier.
 *
 *   npx tsx scripts/practice-runtime-config.ts --mode mock|live --run-id <id> \
 *     --head <sha> --out <path> [--artifact-dir <dir>]
 *
 * Prints the frozen SHA-256 of the canonical config. Carries no credential.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContractManifest, caseDigest, manifestDigest } from "@/lib/bty/foundry/arena/contractManifest";
import { CASE_DEADLINE_MS } from "@/lib/bty/foundry/arena/liveEvaluation";
import { ARTIFACT_DIR } from "@/lib/bty/foundry/arena/evalArtifact";
import { CANARY_CASE_IDS } from "@/lib/bty/foundry/arena/stabilityRunnerScript";
import {
  RUNTIME_CONFIG_SCHEMA_VERSION,
  canonicalRuntimeConfigJson,
  parseRuntimeConfig,
  runtimeConfigDigest,
  type StabilityRuntimeConfig,
} from "@/lib/bty/foundry/arena/runtimeConfig";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

function main(): void {
  const mode = arg("mode");
  if (mode !== "mock" && mode !== "live") throw new Error(`--mode must be mock or live, got ${mode}`);
  const runId = arg("run-id");
  const head = arg("head");
  const out = arg("out");
  const passIds = ["pass1", "pass2"];

  const manifest = buildContractManifest(head, process.env.LLM_MODEL ?? "gpt-4o-mini");
  const candidate: StabilityRuntimeConfig = {
    schemaVersion: RUNTIME_CONFIG_SCHEMA_VERSION,
    mode,
    runId,
    head,
    contractManifestSha256: manifestDigest(manifest),
    corpusSha256: manifest.components.corpus,
    canaryCaseSha256: caseDigest(CANARY_CASE_IDS),
    providerSchemaSha256: manifest.components.providerSchema,
    reviewSchemaSha256: manifest.components.reviewSchema,
    samplingSha256: manifest.components.sampling,
    tokenBudgetSha256: manifest.components.tokenBudget,
    artifactSchemaVersion: manifest.artifactSchemaVersion,
    caseIds: CANARY_CASE_IDS,
    passIds,
    caseDeadlineMs: CASE_DEADLINE_MS,
    artifactDir: arg("artifact-dir", join(process.cwd(), ARTIFACT_DIR)),
    expectedCases: CANARY_CASE_IDS.length * passIds.length,
  };

  // Validate what will actually be written, through the same parser every consumer uses.
  const parsed = parseRuntimeConfig(JSON.parse(canonicalRuntimeConfigJson(candidate)));
  if (!parsed.ok) throw new Error(`runtime config invalid: ${parsed.errors.join(", ")}`);

  writeFileSync(out, `${canonicalRuntimeConfigJson(parsed.value)}\n`);
  process.stdout.write(`${runtimeConfigDigest(parsed.value)}\n`);
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`RUNTIME CONFIG FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
  process.exitCode = 1;
}
