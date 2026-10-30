#!/usr/bin/env npx tsx
/** All-case synthetic encounters. Does not import the service, API, auth or a database client. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { runQaJourney, type QaJourney, type QaMode } from "@/lib/bty/clinical-pilot/discovery-qa.server";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
async function main() {
  const mode = arg("--mode") ?? "rules";
  if (mode !== "rules" && mode !== "model") throw Error("Use --mode rules or --mode model");
  if (mode === "model") {
    if (arg("--base-url")) process.env.CLINICAL_DISCOVERY_LLM_BASE_URL = arg("--base-url");
    if (arg("--model")) process.env.CLINICAL_DISCOVERY_LLM_MODEL = arg("--model");
    if (arg("--key-file")) process.env.CLINICAL_DISCOVERY_LLM_KEY = readFileSync(resolve(arg("--key-file")!), "utf8").trim();
  } else if (arg("--key-file") || arg("--base-url") || arg("--model")) throw Error("Model settings require --mode model");
  const fixturePath = resolve(root, arg("--fixture") ?? "scripts/fixtures/clinical-discovery-journeys.v1.json");
  const fixture = readFileSync(fixturePath, "utf8");
  const journeys = JSON.parse(fixture) as QaJourney[];
  const selected = arg("--case");
  const cases = selected ? journeys.filter(j => j.caseId === selected) : journeys;
  if (!cases.length) throw Error("No matching case");
  const results = [];
  const startedAt = new Date().toISOString();
  for (const journey of cases) {
    const result = await runQaJourney(journey, { mode: mode as QaMode });
    results.push(result);
    console.log(`${journey.caseId} | ${result.rows.length} turns | routing issues ${result.routingIssueTurns} | required unavailable ${result.requiredContentGapTurns} | invariants ${result.invariantErrors.length}`);
  }
  const summary = { cases: results.length, turns: results.reduce((n, r) => n + r.rows.length, 0),
    routingIssueTurns: results.reduce((n, r) => n + r.routingIssueTurns, 0),
    answerMismatchTurns: results.reduce((n, r) => n + r.answerMismatchTurns, 0),
    requiredContentGapTurns: results.reduce((n, r) => n + r.requiredContentGapTurns, 0),
    invariantErrors: results.reduce((n, r) => n + r.invariantErrors.length, 0),
    modelTurns: results.flatMap(r => r.rows).filter(r => r.method === "local-model").length,
    newExtraDisclosureTurns: results.flatMap(r => r.rows).filter(r => r.newExtraDisclosures.length).length,
    newExtraAvailableDisclosureTurns: results.flatMap(r => r.rows).filter(r => r.newExtraAvailableDisclosures.length).length,
    repeatedExtraSelectionTurns: results.flatMap(r => r.rows).filter(r => r.repeatedExtraSelections.length).length,
    fallbackReasons: Object.fromEntries([...new Set(results.flatMap(r => r.rows).map(r => r.fallback).filter(Boolean))]
      .map(reason => [reason, results.flatMap(r => r.rows).filter(r => r.fallback === reason).length])),
    casesWithRequiredContentGaps: results.filter(r => r.requiredContentGapTurns > 0).length };
  const sourceFiles = ["src/lib/bty/clinical-pilot/discovery-router.server.ts",
    "src/lib/bty/clinical-pilot/clinical-intents.server.ts", "src/lib/bty/clinical-pilot/clinical-subjects.server.ts",
    "src/lib/bty/clinical-pilot/discovery-cases.server.ts", "src/lib/bty/clinical-pilot/discovery-qa.server.ts",
    "src/domain/clinical-pilot/discovery.ts", "src/domain/clinical-pilot/pilot.ts", "scripts/clinical-discovery-audit.ts"];
  const sourceFileHashes = Object.fromEntries(sourceFiles.map(name => [name, createHash("sha256").update(readFileSync(resolve(root, name))).digest("hex")]));
  const report = { schema: "clinical-discovery-synthetic-qa/v1", synthetic: true, persistedToLearnerStore: false,
    mode, sourceSha: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    routerSourceHash: createHash("sha256").update(readFileSync(resolve(root, "src/lib/bty/clinical-pilot/discovery-router.server.ts"))).digest("hex"),
    sourceFileHashes,
    workingTreeSourceChanges: execFileSync("git", ["-C", root, "status", "--porcelain=v1", "--untracked-files=all", "--", ...sourceFiles, fixturePath], { encoding: "utf8" }).trim().split("\n").filter(Boolean),
    fixtureHash: createHash("sha256").update(fixture).digest("hex"), startedAt, finishedAt: new Date().toISOString(), summary, results };
  if (arg("--json")) writeFileSync(resolve(arg("--json")!), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(summary));
  if (process.argv.includes("--check") && (summary.routingIssueTurns || summary.answerMismatchTurns || summary.requiredContentGapTurns || summary.invariantErrors)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
