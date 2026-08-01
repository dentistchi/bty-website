import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { listCaseArtifacts } from "./caseArtifact";
import { classifyAttempt, classifyCase, everyAttemptClassified, unresolvedAttempts } from "./attemptForensics";
import { deriveStabilityMetrics, evaluateStabilityVerdict, type CaseEvidence } from "@/domain/foundry/arena-draft/stabilityVerdict";
import { STABILITY_PASS_LABEL } from "./stabilityReport";

/**
 * THE R2.23D-R4 LIVE EVIDENCE.
 *
 * Run 20260801T024949Z, the first complete six-case live measurement. These digests are the
 * canonical baseline; the artifacts are never modified, and this suite asserts that.
 *
 * The files are untracked local evidence, so absence is RECORDED rather than asserted away — the
 * suite must not silently pass on a machine that never ran the canary.
 */
const RUN_ID = "20260801T024949Z";
const DIR = join(process.cwd(), ".eval-artifacts");
const EXPECTED_DIGESTS: Record<string, string> = {
  "pass1/c01-missed-commitment": "444a2651b65c44146e31fa6df4c26e2e255fbbbe118dec941dfa6b7341117ba0",
  "pass1/c09-transparency-verification": "d65e50c04f65b5d27ea96ee9addd3185b70c1e5f9368f0dfc33b654f9297ed5a",
  "pass1/c18-constrained-clinical": "f9b3e22d0d2b91807771045ba3ada8fb1306f48d867288ef7d86bc56822f0417",
  "pass2/c01-missed-commitment": "6935d15630a0494299b0e3b96680f641be26a6de390d4649571236675b31f295",
  "pass2/c09-transparency-verification": "bb4083d3fc074d90c5e42e78078726a3c1b32130d400c2994fe3df2d6721c91b",
  "pass2/c18-constrained-clinical": "7f5292f32f05c5051700c4ac5fd4d556c1e905b8b9d069536f9412cdae8d79cb",
};

const live = () => listCaseArtifacts(DIR, RUN_ID, "live");
const present = () => live().length === 6;
const bodies = () =>
  live().map((e) => {
    const raw = readFileSync(join(DIR, e.file), "utf8");
    return { file: e.file, sha256: createHash("sha256").update(raw).digest("hex"), body: JSON.parse(raw) };
  });

describe(`ARTIFACT AUTHORITY (${present() ? "R2.23D-R4 evidence present — asserted" : "EVIDENCE ABSENT ON THIS MACHINE — not asserted"})`, () => {
  it("9. the six case artifacts remain authoritative and byte-identical", () => {
    if (!present()) return expect(live().length).toBeLessThan(6);
    for (const c of bodies()) {
      const key = `${c.body.passId}/${c.body.caseId}`;
      expect(c.sha256, `digest changed for ${key}`).toBe(EXPECTED_DIGESTS[key]);
    }
  });

  it("10. the original aggregate packet is left untouched, wrong label and all", () => {
    const original = join(process.cwd(), "live_practice_stability_result.r2.23d-r4.json");
    if (!existsSync(original)) return expect(existsSync(original)).toBe(false);
    const p = JSON.parse(readFileSync(original, "utf8"));
    // Its COUNTS were always accurate — the defect was the aggregate verdict, not the arithmetic.
    expect(p.generated).toBe(1);
    expect(p.contentFailures).toBe(5);
    expect(p.presentCases).toBe(6);
    // Preserved exactly as written, including the label now known to be wrong.
    expect(p.status).toBe("COMPLETE");
  });

  it("12. mock artifacts are excluded from live forensics", () => {
    const mixed = listCaseArtifacts(DIR, RUN_ID, "mock");
    expect(mixed).toEqual([]);
    for (const e of live()) expect(e.mode).toBe("live");
  });

  it("the artifacts carry no credential, header or production identifier", () => {
    if (!present()) return expect(live().length).toBeLessThan(6);
    for (const c of bodies()) {
      const raw = JSON.stringify(c.body).toLowerCase();
      for (const banned of ["sk-", "bearer ", "authorization", "api_key", "apikey", "service_role", "supabase.co", "password"]) {
        expect(raw, `${banned} found in ${c.file}`).not.toContain(banned);
      }
    }
  });

  it("the measured metrics reproduce the FAIL verdict from the real artifacts", () => {
    if (!present()) return expect(live().length).toBeLessThan(6);
    const m = deriveStabilityMetrics(bodies().map((c) => c.body) as unknown as CaseEvidence[], 6);
    expect(m.generatedValid).toBe(1);
    expect(m.reviewerMalformed).toBe(4);
    const v = evaluateStabilityVerdict(m, { missingCases: [], problems: [] });
    expect(v.executionComplete).toBe(true);
    expect(v.infrastructureHealthy).toBe(true);
    expect(v.stabilityHardGatesPass).toBe(false);
  });
});

describe("FORENSICS — every attempt is classified, and gaps are named", () => {
  it("13/14. every attempt carries a class, and missing evidence is explicit", () => {
    if (!present()) return expect(live().length).toBeLessThan(6);
    const cases = bodies().map((c) => classifyCase(c.body));
    expect(everyAttemptClassified(cases)).toBe(true);
    // The deterministic-gate path records findings but not the draft, so some attempts genuinely
    // cannot be reviewed. They are marked UNRESOLVED with a reason rather than assumed.
    for (const u of unresolvedAttempts(cases)) {
      expect(u.unresolvedReason).toBeTruthy();
      expect(u.scenarioCaptured).toBe(false);
    }
  });

  it("15. a malformed review is never labelled a generator defect", () => {
    const c = classifyAttempt({ outcome: "review_malformed", code: "review_verdict_contradicts_details" }, 0);
    expect(c.machineClass).toBe("B");
    expect(c.machineClass).not.toBe("A");
    expect(c.machineClass).not.toBe("G");
    expect(c.note).toContain("overallVerdict is 'accept'");
  });

  it("15b. every malformed attempt in the real run classifies as a reviewer defect", () => {
    if (!present()) return expect(live().length).toBeLessThan(6);
    const cases = bodies().map((c) => classifyCase(c.body));
    const malformed = cases.flatMap((c) => c.attempts.filter((a) => a.outcome === "review_malformed"));
    expect(malformed).toHaveLength(4);
    for (const a of malformed) expect(a.machineClass).toBe("B");
  });

  it("16. an automated generated_valid is pending human review, never a pass", () => {
    const c = classifyAttempt({ outcome: "generated_valid" }, 0);
    expect(c.machineClass).toBe("PENDING_HUMAN_REVIEW");
    expect(c.unresolvedReason).toContain("not a quality verdict");
  });

  it("a deterministic rejection with no captured draft is UNRESOLVED, not a generator defect", () => {
    const c = classifyAttempt({ outcome: "gate_level_6", code: "repeated_action_meaning", defectCodes: ["repeated_action_meaning"] }, 0);
    expect(c.machineClass).toBe("H");
    expect(c.scenarioCaptured).toBe(false);
  });

  it("a deterministic rejection WITH a captured draft is checkable", () => {
    const c = classifyAttempt({ outcome: "gate_level_3", code: "unsafe_delay", scenario: { title: "x" } }, 0);
    expect(c.machineClass).toBe("G");
    expect(c.scenarioCaptured).toBe(true);
  });
});

describe("FORENSIC PACKET — corrects without overwriting", () => {
  it("11. the corrected packet references all six digests and states the correction", () => {
    if (!present()) return expect(live().length).toBeLessThan(6);
    const dir = mkdtempSync(join(tmpdir(), "r224-forensic-"));
    try {
      const json = join(dir, "f.json");
      execFileSync("npx", ["tsx", "scripts/practice-stability-forensics.ts", "--run-id", RUN_ID, "--json", json, "--md", join(dir, "f.md")], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
      });
      const p = JSON.parse(readFileSync(json, "utf8"));
      expect(p.artifactPathsAndDigests).toHaveLength(6);
      expect(p.artifactPathsAndDigests.map((a: { sha256: string }) => a.sha256).sort()).toEqual(Object.values(EXPECTED_DIGESTS).sort());
      expect(p.correctionStatement).toContain("The original R2.23D-R4 aggregate label was incorrect");
      expect(p.stabilityHardGatesPass).toBe(false);
      expect(p.productQualityPass).toBeNull();
      expect(p.everyAttemptClassified).toBe(true);
      // The corrected review packet must never carry the pass wording.
      expect(readFileSync(join(dir, "f.md"), "utf8")).not.toContain(STABILITY_PASS_LABEL);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the forensic packet refuses a run with no live artifacts rather than inventing one", () => {
    const dir = mkdtempSync(join(tmpdir(), "r224-empty-"));
    try {
      let failed = false;
      try {
        execFileSync("npx", ["tsx", "scripts/practice-stability-forensics.ts", "--run-id", "NOSUCHRUN", "--artifact-dir", dir, "--json", join(dir, "a.json"), "--md", join(dir, "a.md")], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 120_000,
        });
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
      expect(existsSync(join(dir, "a.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a mock artifact cannot enter live forensics", () => {
    const dir = mkdtempSync(join(tmpdir(), "r224-mock-"));
    try {
      writeFileSync(
        join(dir, `practice-generation.stability.mock.${RUN_ID}.pass1.c01.341c20e95a5e.d816a3dc62df.json`),
        JSON.stringify({ mode: "mock", passId: "pass1", caseId: "c01", ok: true, classification: "content", attempts: [{ outcome: "generated_valid" }] }),
      );
      let failed = false;
      try {
        execFileSync("npx", ["tsx", "scripts/practice-stability-forensics.ts", "--run-id", RUN_ID, "--artifact-dir", dir, "--json", join(dir, "a.json"), "--md", join(dir, "a.md")], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 120_000,
        });
      } catch {
        failed = true;
      }
      expect(failed).toBe(true); // "no live case artifacts" — the mock one is invisible
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("COLLATOR VERDICT — the historical run through the real CLI", () => {
  /** The same config the live run consumed, rebuilt from the artifacts' own identity fields. */
  const configFor = (dir: string, artifactDir: string): string => {
    const b = bodies()[0].body;
    const cfg = {
      artifactDir,
      artifactSchemaVersion: "practice-generation-eval/3",
      canaryCaseSha256: "a".repeat(64),
      caseDeadlineMs: 510_000,
      caseIds: ["c01-missed-commitment", "c09-transparency-verification", "c18-constrained-clinical"],
      contractManifestSha256: b.manifestSha256,
      corpusSha256: "b".repeat(64),
      expectedCases: 6,
      head: b.head,
      mode: "live" as const,
      passIds: ["pass1", "pass2"],
      providerSchemaSha256: "c".repeat(64),
      reviewSchemaSha256: "d".repeat(64),
      runId: RUN_ID,
      samplingSha256: "e".repeat(64),
      schemaVersion: "practice-stability-runtime-config/1",
      tokenBudgetSha256: "f".repeat(64),
    };
    const path = join(dir, "cfg.json");
    writeFileSync(path, JSON.stringify(Object.fromEntries(Object.entries(cfg).sort(([x], [y]) => (x < y ? -1 : 1)))));
    return path;
  };

  it("7b. re-collating the R2.23D-R4 evidence now yields FAIL and a nonzero exit", () => {
    if (!present()) return expect(live().length).toBeLessThan(6);
    const dir = mkdtempSync(join(tmpdir(), "r224-collate-"));
    try {
      const cfg = configFor(dir, DIR);
      const json = join(dir, "r.json");
      const md = join(dir, "r.md");
      let status = 0;
      try {
        execFileSync("npx", ["tsx", "scripts/practice-stability-collate.ts", "--config", cfg, "--json", json, "--md", md], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 120_000,
        });
      } catch (e) {
        status = (e as { status?: number }).status ?? 1;
      }
      // A failed hard gate is a nonzero exit. Zero here is precisely what the runner read as success.
      expect(status).toBe(6);
      const p = JSON.parse(readFileSync(json, "utf8"));
      expect(p.executionComplete).toBe(true);
      expect(p.evidenceComplete).toBe(true);
      expect(p.infrastructureHealthy).toBe(true);
      expect(p.stabilityHardGatesPass).toBe(false);
      expect(p.productQualityPass).toBeNull();
      expect(p.productQualityAuthority).toBe("human_only");
      expect(p.reviewerMalformedCount).toBe(4);
      expect(p.generatedCaseIds).toEqual(["pass2/c09-transparency-verification"]);
      expect(p.rejectedCaseIds).toHaveLength(5);
      expect(p.requiresNewRunnerAuthorization).toBe(true);
      // 8. the pass label cannot print on these metrics.
      const review = readFileSync(md, "utf8");
      expect(review).not.toContain(STABILITY_PASS_LABEL);
      expect(review).toContain("STABILITY HARD GATES FAILED");
      expect(review).toContain("LIVE EXECUTION COMPLETE · 6/6 EVIDENCE WRITTEN");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
