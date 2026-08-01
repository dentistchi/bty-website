#!/usr/bin/env npx tsx
/**
 * CORRECTED FORENSIC PACKET (Slice 3.2I-R5B1A.1-R2.24).
 *
 * Rebuilds the aggregate verdict for a completed run from its immutable case artifacts, and writes
 * a NEW packet beside the original without touching it. The original R2.23D-R4 packet is historical
 * evidence: its numbers were accurate and its aggregate label was wrong, and both facts are
 * preserved by leaving it alone and stating the correction here.
 *
 *   npx tsx scripts/practice-stability-forensics.ts --run-id <id> \
 *     [--artifact-dir <dir>] --json <path> --md <path>
 *
 * Reads LIVE artifacts only. Performs no model call.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { listCaseArtifacts } from "@/lib/bty/foundry/arena/caseArtifact";
import { ARTIFACT_DIR } from "@/lib/bty/foundry/arena/evalArtifact";
import {
  deriveStabilityMetrics,
  evaluateStabilityVerdict,
  type CaseEvidence,
} from "@/domain/foundry/arena-draft/stabilityVerdict";
import { stabilityTerminalLabel } from "@/lib/bty/foundry/arena/stabilityReport";
import { classifyCase, everyAttemptClassified, unresolvedAttempts, FORENSIC_CLASSES } from "@/lib/bty/foundry/arena/attemptForensics";

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
  const dir = arg("artifact-dir", join(process.cwd(), ARTIFACT_DIR));
  // LIVE only. A mock artifact is proof of wiring and can never enter product forensics.
  const entries = listCaseArtifacts(dir, runId, "live");
  if (entries.length === 0) throw new Error(`no live case artifacts for run ${runId} in ${dir}`);

  const cases = entries.map((e) => {
    const raw = readFileSync(join(dir, e.file), "utf8");
    return { file: e.file, sha256: createHash("sha256").update(raw).digest("hex"), body: JSON.parse(raw) };
  });

  const bodies = cases.map((c) => c.body);
  const metrics = deriveStabilityMetrics(bodies as unknown as CaseEvidence[], bodies.length);
  const verdict = evaluateStabilityVerdict(metrics, { missingCases: [], problems: [] });
  const forensics = bodies.map((b) => classifyCase(b));

  const packet = {
    slice: "3.2I-PRACTICE-R5B1A.1-R2.24",
    correctionOf: "live_practice_stability_result.r2.23d-r4.json",
    correctionStatement:
      "The original R2.23D-R4 aggregate label was incorrect. Its counts were accurate; its verdict " +
      "was not. The six immutable case artifacts remain authoritative and are unmodified.",
    runId,
    mode: "live",
    head: bodies[0]?.head ?? null,
    manifestSha256: bodies[0]?.manifestSha256 ?? null,
    model: bodies[0]?.model ?? null,
    executionComplete: verdict.executionComplete,
    evidenceComplete: verdict.evidenceComplete,
    infrastructureHealthy: verdict.infrastructureHealthy,
    stabilityHardGatesPass: verdict.stabilityHardGatesPass,
    humanReviewRequired: verdict.humanReviewRequired,
    productQualityPass: verdict.productQualityPass,
    productQualityAuthority: verdict.productQualityAuthority,
    hardGateFailures: verdict.hardGateFailures,
    metrics,
    generatedCaseIds: bodies.filter((b) => b.ok).map((b) => `${b.passId}/${b.caseId}`),
    rejectedCaseIds: bodies.filter((b) => !b.ok).map((b) => `${b.passId}/${b.caseId}`),
    reviewerMalformedCount: metrics.reviewerMalformed,
    artifactPathsAndDigests: cases.map((c) => ({ file: c.file, sha256: c.sha256 })),
    forensicClasses: FORENSIC_CLASSES,
    everyAttemptClassified: everyAttemptClassified(forensics),
    unresolvedAttemptCount: unresolvedAttempts(forensics).length,
    forensics,
  };
  writeFileSync(arg("json"), JSON.stringify(packet, null, 2));

  const L: string[] = [
    `# R2.24 corrected forensic review — run ${runId}`,
    "",
    ...stabilityTerminalLabel(verdict, metrics),
    "",
    "## Correction",
    "",
    packet.correctionStatement,
    "",
    `- head: ${packet.head}`,
    `- contract manifest: ${packet.manifestSha256}`,
    `- model: ${packet.model}`,
    "",
    "## Hard gate failures",
    "",
    ...(verdict.hardGateFailures.length
      ? verdict.hardGateFailures.map((f) => `- \`${f.rule}\` — expected ${f.expected}, measured ${f.actual}`)
      : ["- none"]),
    "",
    "## Metrics (from the artifacts, not the terminal)",
    "",
    ...Object.entries(metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Authoritative artifacts",
    "",
    ...cases.map((c) => `- \`${c.file}\`\n  sha256: ${c.sha256}`),
    "",
    "## Attempt classification",
    "",
  ];
  for (const c of forensics) {
    L.push(`### ${c.passId} · ${c.caseId} — ${c.ok ? "generated" : `rejected (${c.terminalPrimaryCode})`}`);
    L.push("", `generations: ${c.generationAttempts} · retries: ${c.retriesAttempted} · recovered: ${c.retryRecovered}`, "");
    for (const a of c.attempts) {
      const cls = a.machineClass in FORENSIC_CLASSES ? `${a.machineClass} ${FORENSIC_CLASSES[a.machineClass as keyof typeof FORENSIC_CLASSES]}` : a.machineClass;
      L.push(`- attempt ${a.index + 1} · \`${a.outcome}\`${a.code ? ` · \`${a.code}\`` : ""} → **${cls}**`);
      L.push(`  - scenario captured: ${a.scenarioCaptured} · review captured: ${a.reviewCaptured}`);
      if (a.unresolvedReason) L.push(`  - UNRESOLVED: ${a.unresolvedReason}`);
      L.push(`  - ${a.note}`);
    }
    L.push("");
  }
  L.push(
    "## Human review",
    "",
    "Automated `generated_valid` is not decisive. Only scenarios whose content was captured can be",
    "reviewed at all; every attempt marked UNRESOLVED has a defect code and no recoverable content.",
    "",
  );
  writeFileSync(arg("md"), L.join("\n"));
  process.stdout.write(
    `FORENSIC PACKET WRITTEN · ${cases.length} live artifacts · stabilityHardGatesPass=${verdict.stabilityHardGatesPass} · ${verdict.hardGateFailures.length} hard gate failures\n`,
  );
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`FORENSICS FAILED · ${error instanceof Error ? error.message : "unknown"}\n`);
  process.exitCode = 1;
}
