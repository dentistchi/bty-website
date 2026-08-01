#!/usr/bin/env npx tsx
/**
 * Collate a Practice stability run (Slice 3.2I-R5B1A.1-R2.23D-R3).
 *
 * THE SIX CASE ARTIFACTS ARE THE AUTHORITY.
 *
 * R2.23D-R2 collated from two PASS-summary files, so when both passes died mid-loop the collator
 * reported zero evidence — which was true only because the summaries never existed. Evidence is now
 * per case, written the moment each case terminates, and this reads those.
 *
 * A missing summary can no longer erase completed case evidence, and an incomplete run is reported
 * as incomplete rather than as nothing.
 *
 *   npx tsx scripts/practice-stability-collate.ts --config <path> --json <path> --md <path>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseRuntimeConfig } from "@/lib/bty/foundry/arena/runtimeConfig";
import {
  deriveStabilityMetrics,
  evaluateStabilityVerdict,
  type CaseEvidence,
} from "@/domain/foundry/arena-draft/stabilityVerdict";
import { stabilityTerminalLabel } from "@/lib/bty/foundry/arena/stabilityReport";
import { listCaseArtifacts, sha256 } from "@/lib/bty/foundry/arena/caseArtifact";
import type { CaseResult } from "@/lib/bty/foundry/arena/liveEvaluation";

type Choice = { label: string };
type Draft = {
  title: string;
  opening: string;
  primary: { choices: Choice[] };
  tradeoff: { choices: Choice[] };
  actionDecision: { choices: Choice[] };
  branches?: Record<string, { resultingWorldState?: string; escalationText: string; tradeoffChoices: Choice[]; actionDecision: { choices: Choice[] } }>;
};

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return v;
}

/** Every artifact must attest to the SAME contract the config names. */
function anyManifestMismatch(seen: Map<string, { manifestSha256: string }>, expected: string): boolean {
  return [...seen.values()].some((r) => r.manifestSha256 !== expected);
}

function main(): void {
  // R2.23D-R4 — ONE validated config, the same file the orchestrator read.
  const parsed = parseRuntimeConfig(JSON.parse(readFileSync(arg("config"), "utf8")));
  if (!parsed.ok) throw new Error(`runtime config invalid: ${parsed.errors.join(", ")}`);
  const cfg = parsed.value;
  const { runId, passIds: passes, caseIds, mode } = cfg;
  const outJson = arg("json");
  const outMd = arg("md");

  const dir = cfg.artifactDir;
  // Mode isolation: a live collation never reads mock evidence, and vice versa.
  const entries = listCaseArtifacts(dir, runId, mode);
  const expected = passes.flatMap((p) => caseIds.map((c) => `${p}/${c}`));

  const problems: string[] = [];
  const seen = new Map<string, CaseResult & { __file: string; __sha256: string }>();

  for (const e of entries) {
    const key = `${e.passId}/${e.caseId}`;
    if (!expected.includes(key)) {
      problems.push(`unknown case artifact: ${key}`);
      continue;
    }
    if (seen.has(key)) {
      problems.push(`duplicate case artifact: ${key}`);
      continue;
    }
    const raw = readFileSync(join(dir, e.file), "utf8");
    const result = JSON.parse(raw) as CaseResult;
    // Verify what is ON DISK, not what a summary claimed about it.
    seen.set(key, { ...result, __file: e.file, __sha256: sha256(raw) });
  }

  const missing = expected.filter((k) => !seen.has(k));
  const results = expected.map((k) => seen.get(k)).filter((r): r is CaseResult & { __file: string; __sha256: string } => r !== undefined);

  // Mode must match the config on BOTH sides — the filename and the payload.
  for (const [key, r] of seen) if (r.mode !== mode) problems.push(`mode mismatch in ${key}: artifact is ${r.mode}, run is ${mode}`);
  if (anyManifestMismatch(seen, cfg.contractManifestSha256)) problems.push("artifact manifest differs from the runtime config");

  // One HEAD and one manifest, or the artifacts are not evidence for one contract.
  const heads = new Set(results.map((r) => r.head));
  const manifests = new Set(results.map((r) => r.manifestSha256));
  if (heads.size > 1) problems.push(`artifacts span ${heads.size} different HEADs`);
  if (manifests.size > 1) problems.push(`artifacts span ${manifests.size} different contract manifests`);

  const infrastructure = results.filter((r) => r.classification === "infrastructure");
  // R2.24 — `complete` is EVIDENCE completeness and nothing more. It used to be the only thing
  // standing between a run and the words "GATES PASS"; a run of six rejections satisfied it.
  const complete = missing.length === 0 && problems.length === 0;
  const generated = results.filter((r) => r.ok);

  // The verdict is computed by the pure domain authority from the artifacts, never from the
  // orchestrator's exit status.
  const metrics = deriveStabilityMetrics(results as unknown as CaseEvidence[], expected.length);
  const verdict = evaluateStabilityVerdict(metrics, { missingCases: missing, problems });

  const summary = {
    runId,
    mode,
    complete,
    status: !complete
      ? infrastructure.length > 0
        ? "INCOMPLETE · INFRASTRUCTURE ABORT"
        : "INCOMPLETE"
      : verdict.stabilityHardGatesPass
        ? "COMPLETE · STABILITY HARD GATES PASS"
        : "COMPLETE · STABILITY HARD GATES FAILED",
    head: results[0]?.head ?? null,
    manifestSha256: results[0]?.manifestSha256 ?? null,
    model: results[0]?.model ?? null,
    sampling: results[0]?.sampling ?? null,
    // --- R2.24 machine-readable verdict: six independent dimensions ---
    executionComplete: verdict.executionComplete,
    evidenceComplete: verdict.evidenceComplete,
    infrastructureHealthy: verdict.infrastructureHealthy,
    stabilityHardGatesPass: verdict.stabilityHardGatesPass,
    humanReviewRequired: verdict.humanReviewRequired,
    productQualityPass: verdict.productQualityPass,
    productQualityAuthority: verdict.productQualityAuthority,
    hardGateFailures: verdict.hardGateFailures,
    metrics,
    generatedCaseIds: generated.map((r) => `${r.passId}/${r.caseId}`),
    rejectedCaseIds: results.filter((r) => !r.ok).map((r) => `${r.passId}/${r.caseId}`),
    reviewerMalformedCount: metrics.reviewerMalformed,
    expectedCases: expected.length,
    presentCases: results.length,
    missingCases: missing,
    problems,
    artifacts: results.map((r) => ({ file: r.__file, sha256: r.__sha256, passId: r.passId, caseId: r.caseId })),
    generated: generated.length,
    firstAttemptValid: metrics.firstAttemptValid,
    retryRecovered: metrics.retryRecovered,
    retryExhausted: metrics.retryExhausted,
    contentFailures: results.filter((r) => !r.ok && r.classification === "content").length,
    infrastructureFailures: infrastructure.length,
    abortClassification: infrastructure[0]?.reason ?? null,
    // A run whose hard gates failed cannot be re-executed on the old authorization either.
    requiresNewRunnerAuthorization: !verdict.stabilityHardGatesPass,
    defectFrequency: results
      .flatMap((r) => r.attempts.flatMap((a) => a.defectCodes ?? []))
      .reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {}),
    latencyMs: results.map((r) => ({ caseId: r.caseId, passId: r.passId, ms: r.latencyMs })),
    results,
  };
  writeFileSync(outJson, JSON.stringify(summary, null, 2));

  const lines: string[] = [
    `# Practice stability review — ${summary.status}${mode === "mock" ? " · MOCK" : ""}`,
    "",
    // An incomplete run is incomplete in EVERY mode. A mock that did not finish must never
    // print a PASS line just because it was a mock.
    ...(!complete
      ? ["THIS RUN IS INCOMPLETE — it is not stability evidence."]
      : mode === "mock"
        ? ["FULL STABILITY MOCK PASS · LIVE PRODUCT QUALITY NOT MEASURED"]
        : stabilityTerminalLabel(verdict, metrics)),
    "",
    `- run: ${runId}`,
    `- head: ${summary.head ?? "(no artifacts)"}`,
    `- contract manifest: ${summary.manifestSha256 ?? "(no artifacts)"}`,
    `- model: ${summary.model ?? "(no artifacts)"}`,
    `- cases present / expected: ${summary.presentCases} / ${summary.expectedCases}`,
    `- first-attempt valid: ${summary.firstAttemptValid}   retry-recovered: ${summary.retryRecovered}`,
    `- content failures: ${summary.contentFailures}   infrastructure failures: ${summary.infrastructureFailures}`,
    "",
  ];
  if (!complete) {
    lines.push("## Incomplete run", "");
    lines.push(`- missing cases: ${missing.length ? missing.join(", ") : "none"}`);
    if (problems.length) lines.push(`- problems: ${problems.join("; ")}`);
    if (summary.abortClassification) lines.push(`- abort classification: ${summary.abortClassification}`);
    lines.push(`- another execution requires a new runner authorization: ${summary.requiresNewRunnerAuthorization ? "YES" : "no"}`);
    lines.push("", "The case artifacts that DO exist are listed below and are preserved.", "");
  }

  for (const r of results) {
    lines.push(`## ${r.caseId} · ${r.passId} · ${r.classification} · attempts ${r.attempts.length}`, "");
    lines.push(`artifact: ${r.__file}`, `sha256: ${r.__sha256}`, "");
    if (!r.ok || !r.draft) {
      lines.push(`NOT GENERATED: ${r.reason ?? "unknown"}${r.sanitizedError ? ` (${r.sanitizedError})` : ""}`, "");
      continue;
    }
    const d = r.draft as Draft;
    lines.push(`**${d.title}**`, "", d.opening, "");
    lines.push("Primary:", ...d.primary.choices.map((c) => `- ${c.label}`));
    lines.push("", "Tradeoff:", ...d.tradeoff.choices.map((c) => `- ${c.label}`));
    lines.push("", "Action:", ...d.actionDecision.choices.map((c) => `- ${c.label}`));
    for (const [k, b] of Object.entries(d.branches ?? {})) {
      lines.push("", `Branch ${k} — ${b.resultingWorldState ?? "(no world state)"}`, `  escalation: ${b.escalationText}`);
      lines.push(...b.tradeoffChoices.map((c) => `  - tradeoff: ${c.label}`));
      lines.push(...b.actionDecision.choices.map((c) => `  - action: ${c.label}`));
    }
    lines.push(
      "",
      "HUMAN REVIEW — every field below is PENDING and must be completed by a person:",
      "- [ ] every option defensible by a competent, well-intentioned person: PENDING",
      "- [ ] no false or vague reassurance at any phase: PENDING",
      "- [ ] confirmed boundary visibly and operationally grounded: PENDING",
      "- [ ] each branch causally distinct from its siblings: PENDING",
      "- [ ] would you put this in front of a learner: PENDING",
      "",
    );
  }
  writeFileSync(outMd, lines.join("\n"));
  process.stdout.write(
    mode === "mock" && complete
      ? `COLLATION MOCK PASS · ${summary.presentCases} IMMUTABLE CASE ARTIFACTS\n`
      : `wrote ${outJson} and ${outMd} · ${summary.status} · ${summary.presentCases}/${summary.expectedCases} cases\n`,
  );
  // R2.24 — a failed hard gate is a nonzero exit, exactly like an incomplete run. The runner reads
  // this status, and a zero here is what let a 1-of-6 run read as success.
  if (!complete || !verdict.stabilityHardGatesPass) process.exitCode = 6;
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`COLLATION FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
  process.exitCode = 1;
}
