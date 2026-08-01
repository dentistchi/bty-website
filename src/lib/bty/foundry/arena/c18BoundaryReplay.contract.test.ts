import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  HistoricalReconstructionConflict,
  RECONSTRUCTION_DISCLAIMER,
  extractFromArtifactCorrectionPacket,
  extractFromCorpus,
  reconstructHistoricalProvenance,
} from "./historicalBoundaryReconstruction";
import { assertReviewBoundaryAuthority, boundaryProvenanceSha256 } from "@/domain/foundry/arena-draft/boundaryProvenance";
import { subjectDigests } from "@/domain/foundry/arena-draft/reviewSubject";
import { buildC18Subject, CASE_ID, CORPUS, SOURCE_ARTIFACT, SOURCE_ARTIFACT_SHA256 } from "../../../../../scripts/practice-c18-boundary-replay";

/**
 * The R2.23D-R4 c18 source artifact is untracked local evidence, so absence is RECORDED rather
 * than asserted away — the suite must not silently pass on a machine that never ran the canary.
 */
const EVIDENCE_DIR = join(process.cwd(), ".eval-artifacts");
const present = () => existsSync(join(EVIDENCE_DIR, SOURCE_ARTIFACT));

const BOUNDARY_ID = "c1_verify";
const BOUNDARY_TEXT = "Two identifiers must be verified before treatment";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "r227-c18-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe(`HISTORICAL RECONSTRUCTION (${present() ? "c18 evidence present — asserted" : "EVIDENCE ABSENT — not asserted"})`, () => {
  it("20. SOURCE 1 — the canonical corpus case yields the exact boundary", () => {
    const s = extractFromCorpus(join(process.cwd(), CORPUS), CASE_ID);
    expect(s.id).toBe(BOUNDARY_ID);
    expect(s.statement).toBe(BOUNDARY_TEXT);
    expect(s.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(s.source.evidenceLocation).toContain(CASE_ID);
  });

  it("21. SOURCE 2 — the server-authored correction packet in the case artifact yields the same boundary", () => {
    if (!present()) return expect(present()).toBe(false);
    const s = extractFromArtifactCorrectionPacket(join(EVIDENCE_DIR, SOURCE_ARTIFACT));
    expect(s.id).toBe(BOUNDARY_ID);
    expect(s.statement).toBe(BOUNDARY_TEXT);
    expect(s.source.evidenceLocation).toMatch(/^attempts\[\d+\]\.correctionPacket/);
  });

  it("22/31. the two sources agree on the normalized digest", () => {
    if (!present()) return expect(present()).toBe(false);
    const a = extractFromCorpus(join(process.cwd(), CORPUS), CASE_ID);
    const b = extractFromArtifactCorrectionPacket(join(EVIDENCE_DIR, SOURCE_ARTIFACT));
    expect(a.source.normalizedBoundaryDigest).toBe(b.source.normalizedBoundaryDigest);
    expect(a.source.path).not.toBe(b.source.path); // genuinely independent
  });

  it("32. disagreement STOPS the reconstruction rather than picking a winner", () => {
    const a = extractFromCorpus(join(process.cwd(), CORPUS), CASE_ID);
    const fake = { ...a, statement: "One identifier is enough", source: { ...a.source, path: "other", normalizedBoundaryDigest: "f".repeat(64) } };
    expect(() => reconstructHistoricalProvenance({ sources: [a, fake], sourceReference: "x" })).toThrow(HistoricalReconstructionConflict);
    expect(() => reconstructHistoricalProvenance({ sources: [a, fake], sourceReference: "x" })).toThrow(/historical_boundary_reconstruction_conflict/);
  });

  it("a single source is never enough", () => {
    const a = extractFromCorpus(join(process.cwd(), CORPUS), CASE_ID);
    expect(() => reconstructHistoricalProvenance({ sources: [a], sourceReference: "x" })).toThrow(HistoricalReconstructionConflict);
  });

  it("33/34. the reconstructed subject is labelled, names both sources, and disclaims original context", () => {
    if (!present()) return expect(present()).toBe(false);
    const s = buildC18Subject(process.cwd(), EVIDENCE_DIR);
    const p = s.subject.boundaryProvenance!;
    expect(p.sourceKind).toBe("historical_reconstruction");
    expect(p.reconstructed).toBe(true);
    expect(p.reconstructionSources).toHaveLength(2);
    expect(p.boundaryMode).toBe("bearing");
    expect(p.activeBoundaryIds).toEqual([BOUNDARY_ID]);
    expect(p.confirmedBoundaries[0].statement).toBe(BOUNDARY_TEXT);
    // It passes the fail-closed authority — the whole point of rebuilding it.
    expect(assertReviewBoundaryAuthority(p, boundaryProvenanceSha256(p)).ok).toBe(true);
    // And it never claims to be what the historical reviewer saw.
    expect(RECONSTRUCTION_DISCLAIMER).toContain("NOT evidence of what the historical reviewer originally received");
    expect(RECONSTRUCTION_DISCLAIMER).toContain("boundaryIdsConsidered: []");
  });

  it("1. the reconstructed subject contains c1_verify and the exact two-identifier text", () => {
    if (!present()) return expect(present()).toBe(false);
    const s = buildC18Subject(process.cwd(), EVIDENCE_DIR);
    expect(s.subject.activeBoundaryIds).toContain(BOUNDARY_ID);
    expect(s.subject.confirmedBoundaries.map((b) => b.statement)).toContain(BOUNDARY_TEXT);
  });

  it("6/7. the three digests are independently auditable", () => {
    if (!present()) return expect(present()).toBe(false);
    const d = subjectDigests(buildC18Subject(process.cwd(), EVIDENCE_DIR).subject);
    for (const k of ["scenarioSha256", "reviewContractSha256", "boundaryProvenanceSha256", "reviewSubjectSha256"] as const) {
      expect(d[k], k).toMatch(/^[0-9a-f]{64}$/);
    }
    // Four distinct answers to four distinct questions.
    expect(new Set(Object.values(d)).size).toBe(4);
  });

  it("8. a mutated source artifact stops the build before any subject is produced", () => {
    if (!present()) return expect(present()).toBe(false);
    mkdirSync(join(dir, "ev"), { recursive: true });
    const target = join(dir, "ev", SOURCE_ARTIFACT);
    const body = JSON.parse(readFileSync(join(EVIDENCE_DIR, SOURCE_ARTIFACT), "utf8"));
    body.runId = "TAMPERED";
    writeFileSync(target, JSON.stringify(body));
    expect(() => buildC18Subject(process.cwd(), join(dir, "ev"))).toThrow(/digest mismatch/);
  });

  it("35. the original R2.25 replay artifacts are untouched by any of this", () => {
    const r25 = ".eval-artifacts/practice-review.reviewreplay.live.20260801T044343Z.pass2.c18-constrained-clinical.a2.1ed40ea4913c.json";
    if (!existsSync(join(process.cwd(), r25))) return expect(existsSync(join(process.cwd(), r25))).toBe(false);
    const sha = createHash("sha256").update(readFileSync(join(process.cwd(), r25))).digest("hex");
    expect(sha).toBe("2dca49ad90cf0a644452fbf146c825e2a125bba63f6358669f9de7b1b5b56cf2");
  });
});

describe("CORRECTED-BOUNDARY REPLAY — the exact program, on mocks", () => {
  const run = (env: Record<string, string>, args: string[]) => {
    try {
      const stdout = execFileSync("npx", ["tsx", "scripts/practice-c18-boundary-replay.ts", ...args], {
        encoding: "utf8",
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
      });
      return { code: 0, stdout, stderr: "" };
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
    }
  };

  it("2/3/16/18/36/37/38. one subject, one reviewer call, zero generation calls, one artifact", () => {
    if (!present()) return expect(present()).toBe(false);
    const r = run({ BTY_C18_REPLAY_MOCK: "1" }, ["--replay-run-id", "MOCKC18", "--artifact-dir", dir]);
    expect(r.code).toBe(0);
    // 2. the exact boundary text travels with the subject.
    expect(r.stdout).toContain(`ACTIVE BOUNDARY: ${BOUNDARY_ID}`);
    expect(r.stdout).toContain(BOUNDARY_TEXT);
    expect(r.stdout).toContain("REVIEWER REPLAY COMPLETE · 1/1 SUBJECTS");
    expect(r.stdout).toContain("GENERATION CALLS: 0");
    const files = readdirSync(dir).filter((f) => f.startsWith("practice-review.reviewreplay.mock."));
    expect(files).toHaveLength(1);
  });

  it("12/39. the artifact carries the complete boundary evidence, not just a label", () => {
    if (!present()) return expect(present()).toBe(false);
    run({ BTY_C18_REPLAY_MOCK: "1" }, ["--replay-run-id", "MOCKC18", "--artifact-dir", dir, "--mock-outcome", "reject"]);
    const f = readdirSync(dir).find((x) => x.endsWith(".json"))!;
    const a = JSON.parse(readFileSync(join(dir, f), "utf8"));
    expect(a.outcome).toBe("consistent_reject");
    expect(a.activeBoundaryIds).toEqual([BOUNDARY_ID]);
    expect(a.boundaryProvenance.confirmedBoundaries[0].statement).toBe(BOUNDARY_TEXT);
    expect(a.boundaryProvenance.reconstructed).toBe(true);
    expect(a.subjectDigests.boundaryProvenanceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.reconstructionDisclaimer).toContain("NOT evidence");
    // The reviewer's own coverage and derived defects survive to the artifact.
    expect(a.reviewResponse.boundaryIdsConsidered).toEqual([BOUNDARY_ID]);
    expect(a.derivedDefects).toContain("choice_bypasses_boundary");
  });

  it("13. a consistent accept is never a product-quality pass", () => {
    if (!present()) return expect(present()).toBe(false);
    const r = run({ BTY_C18_REPLAY_MOCK: "1" }, ["--replay-run-id", "MOCKC18", "--artifact-dir", dir, "--mock-outcome", "accept"]);
    expect(r.stdout).toContain("consistent_accept 1");
    expect(r.stdout).toContain("PRODUCT QUALITY NOT MEASURED");
    expect(r.stdout).not.toContain("STRUCTURAL + SEMANTIC GATES PASS");
    expect(r.stdout).not.toContain("PRODUCT QUALITY PASS");
  });

  it("14. a repeated contradiction stays a reviewer failure", () => {
    if (!present()) return expect(present()).toBe(false);
    const r = run({ BTY_C18_REPLAY_MOCK: "1" }, ["--replay-run-id", "MOCKC18", "--artifact-dir", dir, "--mock-outcome", "contradiction"]);
    expect(r.stdout).toContain("repeated_contradiction 1");
    expect(r.stdout).not.toContain("consistent_accept 1");
  });

  it("4/9. missing or conflicting reconstruction evidence stops before any reviewer call", () => {
    mkdirSync(join(dir, "empty"), { recursive: true });
    const r = run({ BTY_C18_REPLAY_MOCK: "1" }, ["--replay-run-id", "X", "--artifact-dir", dir, "--evidence-dir", join(dir, "empty")]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("C18 BOUNDARY REPLAY FAILED");
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(0);
  });

  it("15/17. zero generation entry points, and no credential reaches the artifact", () => {
    if (!present()) return expect(present()).toBe(false);
    const src = readFileSync(join(process.cwd(), "scripts/practice-c18-boundary-replay.ts"), "utf8");
    expect(src).not.toMatch(/generateArenaScenarioDraft|generateWithLlm|buildTemplateScenarioDraft/);
    run({ BTY_C18_REPLAY_MOCK: "1" }, ["--replay-run-id", "MOCKC18", "--artifact-dir", dir]);
    const f = readdirSync(dir).find((x) => x.endsWith(".json"))!;
    const raw = readFileSync(join(dir, f), "utf8").toLowerCase();
    for (const banned of ["sk-", "bearer ", "authorization", "api_key", "apikey", "x-request-id"]) expect(raw).not.toContain(banned);
  });
});
