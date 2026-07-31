import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { EVAL_CORPUS } from "./practice-generation.eval";
import { buildContractManifest, caseDigest, manifestDigest } from "./contractManifest";

/**
 * STABILITY-RUNNER CONTRACT (Slice 3.2I-R5B1A.1-R2.23).
 *
 * The runner lives at /tmp by design — it is an operator tool, never repository source, and Part 14
 * forbids staging it. So the invariants are enforced from two directions:
 *
 *   - the BINDING DATA (manifest reproducibility, corpus digest sensitivity, canary-case presence,
 *     c01 answer-key absence) is tested here unconditionally, because that is what makes a mismatch
 *     detectable at all;
 *   - the runner FILE's own properties are asserted when it is present on this machine.
 *
 * When the runner is absent the file-level assertions cannot run. That is stated in the test name
 * rather than hidden behind a skip, so a green suite never implies the runner was inspected.
 */

const RUNNER = "/tmp/r223_live_practice_stability_canary.sh";
const CANARY_CASES = ["c01-missed-commitment", "c09-transparency-verification", "c18-constrained-clinical"];
const runnerSource = (): string | null => (existsSync(RUNNER) ? readFileSync(RUNNER, "utf8") : null);

describe("44/45/48. binding data — what makes a stale runner detectable", () => {
  it("44. the manifest digest is reproducible, so a mismatch means the CONTRACT moved", () => {
    const head = "a".repeat(40);
    expect(manifestDigest(buildContractManifest(head, "gpt-4o-mini"))).toBe(manifestDigest(buildContractManifest(head, "gpt-4o-mini")));
  });

  it("43. a different HEAD produces a different manifest, so a HEAD mismatch is always caught", () => {
    expect(manifestDigest(buildContractManifest("a".repeat(40), "gpt-4o-mini")))
      .not.toBe(manifestDigest(buildContractManifest("b".repeat(40), "gpt-4o-mini")));
  });

  it("47. all three bound canary cases exist, and each is a GENERATION case, not a decline", () => {
    for (const id of CANARY_CASES) {
      const c = EVAL_CORPUS.find((x) => x.id === id);
      expect(c, `${id} is missing — the runner must halt`).toBeDefined();
      expect(c!.expectDecline ?? false, `${id} became a decline case`).toBe(false);
    }
    // c18 must still carry its CONFIRMED boundary, or it is no longer the case the runner binds.
    const c18 = EVAL_CORPUS.find((c) => c.id === "c18-constrained-clinical")!;
    expect(c18.input.boundary?.confirmed).toBe(true);
    expect(c18.input.boundary?.mode).toBe("judgment_with_constraints");
    expect(c18.input.boundary?.constraints?.[0]?.statement).toContain("identifiers");
  });

  it("48. editing ANY bound case moves the canary digest — a stale corpus cannot pass", () => {
    const baseline = caseDigest(CANARY_CASES);
    expect(baseline).toMatch(/^[0-9a-f]{64}$/);
    expect(caseDigest(CANARY_CASES.slice(0, 2))).not.toBe(baseline);
    expect(caseDigest([...CANARY_CASES, "c02-uncertain-customer"])).not.toBe(baseline);
  });

  it("48b. c01 still carries no answer-key wording — the runner checks this before spending a call", () => {
    const c01 = EVAL_CORPUS.find((c) => c.id === "c01-missed-commitment")!;
    const text = [c01.input.facts.problem, c01.input.facts.observableBehavior, c01.input.guided.avoidancePressure.text].join(" ").toLowerCase();
    for (const banned of ["honest", "honesty", "admit", "own the miss", "come clean"]) {
      expect(text, `c01 regained "${banned}"`).not.toContain(banned);
    }
  });
});

describe(`runner file properties (${existsSync(RUNNER) ? "runner present — asserted" : "RUNNER ABSENT ON THIS MACHINE — file-level properties NOT asserted"})`, () => {
  it("43/44/45. it binds HEAD, manifest and BOTH schema digests, and halts on any mismatch", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false); // absence is recorded, never asserted away
    for (const bound of ["EXPECT_HEAD", "EXPECT_MANIFEST", "EXPECT_PROVIDER_SCHEMA", "EXPECT_REVIEW_SCHEMA", "EXPECT_CORPUS", "EXPECT_CANARY_CASES", "EXPECT_ARTIFACT_SCHEMA", "EXPECT_GEN_SAMPLING", "EXPECT_REVIEW_SAMPLING"]) {
      expect(src, `${bound} is not bound`).toContain(bound);
    }
    expect(src).toContain("CONTRACT MISMATCH · RUNNER STALE");
    // Every placeholder must have been substituted with a real value.
    expect(src, "runner still contains unsubstituted placeholders").not.toMatch(/__EXPECT_[A-Z_]+__/);
  });

  it("43b/46. every check runs BEFORE the credential prompt", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    const prompt = src.indexOf("read -rs LLM_API_KEY");
    expect(prompt).toBeGreaterThan(-1);
    for (const check of [
      /\[ "\$ACTUAL_HEAD"\s+= "\$EXPECT_HEAD" \]/,
      /\[ "\$ACTUAL_MANIFEST"\s+= "\$EXPECT_MANIFEST" \]/,
      /tracked tree is dirty/,
      /canary case missing/,
    ]) {
      const at = src.search(check);
      expect(at, `${check} is missing`).toBeGreaterThan(-1);
      expect(at, `${check} runs AFTER the credential prompt`).toBeLessThan(prompt);
    }
  });

  it("49. there is no force bypass of any kind", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    expect(src).not.toMatch(/--force|FORCE=|SKIP_PREFLIGHT|ALLOW_STALE|--no-verify/);
  });

  it("50. it contains no database, Wrangler or deployment operation", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    // The self-check loop legitimately NAMES these tokens; strip that block before scanning.
    const scanned = src.replace(/for forbidden in[\s\S]*?done/, "");
    for (const banned of ["wrangler", "supabase", "psql", "db push", "PGPASSWORD", "pgpass", "deploy"]) {
      expect(scanned.toLowerCase(), `runner contains a ${banned} operation`).not.toContain(banned.toLowerCase());
    }
  });

  it("it never writes, echoes or persists the credential", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    expect(src).toContain("read -rs LLM_API_KEY"); // hidden input
    expect(src).toContain("unset HISTFILE");
    expect(src).toMatch(/trap cleanup EXIT/);
    expect(src).not.toMatch(/echo .*LLM_API_KEY|printf .*\$LLM_API_KEY|> *\.env/);
  });

  it("it runs 3 cases x 2 passes with a distinct pass identity, and never labels the result a quality pass", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    expect(src).toContain("PASSES=2");
    expect(src).toContain("EXPECTED_EXECUTIONS=6");
    for (const id of CANARY_CASES) expect(src).toContain(id);
    expect(src).toContain('EVAL_PASS_ID="pass${pass}"');
    expect(src).toContain("STRUCTURAL + SEMANTIC GATES PASS");
    expect(src).toContain("HUMAN PRODUCT REVIEW REQUIRED");
    expect(src).not.toContain("PRODUCT QUALITY PASS");
  });

  it("the human-review packet leaves every judgment field explicitly PENDING", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    expect(src).toContain("HUMAN REVIEW — every field below is PENDING");
    expect(src).toMatch(/would you put this in front of a learner: PENDING/);
  });
});
