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
 *   npx tsx scripts/practice-stability-collate.ts --run-id <id> --passes pass1,pass2 \
 *     --cases c01-…,c09-…,c18-… --json <path> --md <path>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACT_DIR } from "@/lib/bty/foundry/arena/evalArtifact";
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

function main(): void {
  const runId = arg("run-id");
  const passes = arg("passes").split(",").map((s) => s.trim()).filter(Boolean);
  const caseIds = arg("cases").split(",").map((s) => s.trim()).filter(Boolean);
  const outJson = arg("json");
  const outMd = arg("md");

  const dir = arg("artifact-dir", join(process.cwd(), ARTIFACT_DIR));
  const entries = listCaseArtifacts(dir, runId);
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
    const parsed = JSON.parse(raw) as CaseResult;
    // Verify what is ON DISK, not what a summary claimed about it.
    seen.set(key, { ...parsed, __file: e.file, __sha256: sha256(raw) });
  }

  const missing = expected.filter((k) => !seen.has(k));
  const results = expected.map((k) => seen.get(k)).filter((r): r is CaseResult & { __file: string; __sha256: string } => r !== undefined);

  // One HEAD and one manifest, or the artifacts are not evidence for one contract.
  const heads = new Set(results.map((r) => r.head));
  const manifests = new Set(results.map((r) => r.manifestSha256));
  if (heads.size > 1) problems.push(`artifacts span ${heads.size} different HEADs`);
  if (manifests.size > 1) problems.push(`artifacts span ${manifests.size} different contract manifests`);

  const infrastructure = results.filter((r) => r.classification === "infrastructure");
  const complete = missing.length === 0 && problems.length === 0;
  const generated = results.filter((r) => r.ok);
  const firstAttempt = generated.filter((r) => r.attempts.filter((a) => String(a.outcome ?? "").startsWith("gate_level_")).length === 0);

  const summary = {
    runId,
    complete,
    status: complete ? "COMPLETE" : infrastructure.length > 0 ? "INCOMPLETE · INFRASTRUCTURE ABORT" : "INCOMPLETE",
    head: results[0]?.head ?? null,
    manifestSha256: results[0]?.manifestSha256 ?? null,
    model: results[0]?.model ?? null,
    sampling: results[0]?.sampling ?? null,
    expectedCases: expected.length,
    presentCases: results.length,
    missingCases: missing,
    problems,
    artifacts: results.map((r) => ({ file: r.__file, sha256: r.__sha256, passId: r.passId, caseId: r.caseId })),
    generated: generated.length,
    firstAttemptValid: firstAttempt.length,
    retryRecovered: generated.length - firstAttempt.length,
    contentFailures: results.filter((r) => !r.ok && r.classification === "content").length,
    infrastructureFailures: infrastructure.length,
    abortClassification: infrastructure[0]?.reason ?? null,
    requiresNewRunnerAuthorization: !complete,
    defectFrequency: results
      .flatMap((r) => r.attempts.flatMap((a) => a.defectCodes ?? []))
      .reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {}),
    latencyMs: results.map((r) => ({ caseId: r.caseId, passId: r.passId, ms: r.latencyMs })),
    results,
  };
  writeFileSync(outJson, JSON.stringify(summary, null, 2));

  const lines: string[] = [
    `# R2.23D-R3 Practice stability review — ${summary.status}`,
    "",
    complete ? "STRUCTURAL + SEMANTIC GATES: see result JSON" : "THIS RUN IS INCOMPLETE — it is not stability evidence.",
    "HUMAN PRODUCT REVIEW REQUIRED",
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
  process.stdout.write(`wrote ${outJson} and ${outMd} · ${summary.status} · ${summary.presentCases}/${summary.expectedCases} cases\n`);
  if (!complete) process.exitCode = 6;
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`COLLATION FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
  process.exitCode = 1;
}
