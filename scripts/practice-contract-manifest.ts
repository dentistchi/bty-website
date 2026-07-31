#!/usr/bin/env npx tsx
/**
 * Print the Practice generation-contract manifest (Slice 3.2I-R5B1A.1-R2.23).
 *
 * Reproducible: no timestamps, no file mtimes, no environment values, no secrets. Only the model
 * NAME is included — never a key, endpoint or account identifier.
 *
 *   npx tsx scripts/practice-contract-manifest.ts [--json] [--head <sha>]
 *
 * A runner binds to `manifestSha256` and refuses to execute when it moves.
 */
import { execFileSync } from "node:child_process";
import { buildContractManifest, manifestDigest, caseDigest, canonicalJson, short } from "@/lib/bty/foundry/arena/contractManifest";
import { measureProviderBudget, measureReviewBudget } from "@/lib/bty/foundry/arena/tokenBudget";
import { PRACTICE_SAMPLING } from "@/lib/bty/foundry/arena/arenaScenarioGenerationService";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const headArg = argv.includes("--head") ? argv[argv.indexOf("--head") + 1] : null;

function gitHead() {
  if (headArg) return headArg;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const CANARY_CASES = ["c01-missed-commitment", "c09-transparency-verification", "c18-constrained-clinical"];

const head = gitHead();
// The model NAME is part of the contract; LLM_MODEL's default is the contract default.
const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
const manifest = buildContractManifest(head, model);
const sha = manifestDigest(manifest);
const cases = caseDigest(CANARY_CASES);

if (asJson) {
  process.stdout.write(
    JSON.stringify(
      {
        manifestSha256: sha,
        canaryCaseIds: CANARY_CASES,
        canaryCaseSha256: cases,
        manifest,
        budgets: {
          generation: measureProviderBudget(PRACTICE_SAMPLING.generation.maxTokens),
          review: measureReviewBudget(PRACTICE_SAMPLING.review.maxTokens),
        },
      },
      null,
      2,
    ) + "\n",
  );
} else {
  console.log("PRACTICE GENERATION CONTRACT MANIFEST");
  console.log(`  head                 ${manifest.head}`);
  console.log(`  model                ${manifest.model}`);
  console.log(`  artifactSchema       ${manifest.artifactSchemaVersion}`);
  console.log(`  manifestSha256       ${sha}`);
  console.log(`  canaryCases          ${CANARY_CASES.join(", ")}`);
  console.log(`  canaryCaseSha256     ${cases}`);
  console.log("  components:");
  for (const [k, v] of Object.entries(manifest.components).sort(([a], [b]) => (a < b ? -1 : 1))) {
    console.log(`    ${k.padEnd(34)} ${short(v)}`);
  }
  console.log("  sampling:");
  console.log(`    generation  ${JSON.stringify(manifest.sampling.generation)}`);
  console.log(`    review      ${JSON.stringify(manifest.sampling.review)}`);
  console.log(`    retry       ${JSON.stringify(manifest.sampling.retry)}`);
  console.log(`    envOverrides ${JSON.stringify(manifest.sampling.environmentOverrides)}`);
  console.log("  canonical JSON length " + canonicalJson(manifest).length);
}
