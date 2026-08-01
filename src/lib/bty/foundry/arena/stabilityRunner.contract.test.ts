import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { EVAL_CORPUS } from "./practice-generation.eval";
import { buildContractManifest, caseDigest, manifestDigest } from "./contractManifest";
import { manifestPayload, renderRunner } from "./stabilityRunnerScript";

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

const PRIOR_RUNNERS = [
  "/tmp/r223_live_practice_stability_canary.sh",
  "/tmp/r223a_live_practice_stability_canary.sh",
  "/tmp/r223c_live_practice_stability_canary.sh",
  "/tmp/r223d_live_practice_stability_canary.sh",
  "/tmp/r223d_r1_live_practice_stability_canary.sh",
  "/tmp/r223d_r2_live_practice_stability_canary.sh",
  "/tmp/r223d_r3_live_practice_stability_canary.sh",
];
const RUNNER_R223 = PRIOR_RUNNERS[0];
const RUNNER = "/tmp/r223d_r4_live_practice_stability_canary.sh";
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

describe("R2.23A — cardinality and budget are part of what the runner binds", () => {
  it("34. the generated cardinality is exactly two, and the manifest carries its digest", () => {
    const m = buildContractManifest("a".repeat(40), "gpt-4o-mini");
    expect(m.cardinality.primaryChoices).toBe(2);
    expect(m.cardinality.branches).toBe(2);
    expect(m.components.generatedCardinality).toMatch(/^[0-9a-f]{64}$/);
  });

  it("35/37/51. the budget now PASSES, and the runner binds that fact", () => {
    const m = buildContractManifest("a".repeat(40), "gpt-4o-mini");
    expect(m.schemaCanExceedBudget).toBe(false); // R2.23C closed it
    expect(m.modelOutputCap).toBe(16384);
    expect(m.evidenceAuthority.providerSelfAttestation).toBe(false);
    expect(m.evidenceAuthority.maxActiveBoundaries).toBe(3);
    // R2.23D — a blocked scope now has a Host route out, and the runner refuses without it.
    expect(m.evidenceAuthority.hostScopeSelectorExists).toBe(true);
    expect(m.components.readinessResolver).toMatch(/^[0-9a-f]{64}$/);
  });

  it("31. EVERY prior runner is PRESERVED and still binds its OWN contract", () => {
    for (const p of PRIOR_RUNNERS) expect(p).not.toBe(RUNNER);
    if (!existsSync(RUNNER_R223)) return expect(existsSync(RUNNER_R223)).toBe(false);
    // Untouched: each still binds the manifest of the slice that produced it.
    expect(readFileSync(PRIOR_RUNNERS[0], "utf8")).toContain("b539c74ed6c97a0d224dd0b60aa25239650288641ac9fc7e37a218d19e567c10");
    if (existsSync(PRIOR_RUNNERS[1])) {
      expect(readFileSync(PRIOR_RUNNERS[1], "utf8")).toContain("64bcbcf9a0f08aa8a2b02c4eb8b8ecdff2b1b098e389e8ad6984964c39269b0d");
    }
    if (existsSync(PRIOR_RUNNERS[2])) {
      expect(readFileSync(PRIOR_RUNNERS[2], "utf8")).toContain("d8f8e60cba1ec23388f988fc74a9e484b2d703ec58b3d8db46cacdd65f66ffe2");
    }
    // Both DEFECTIVE runners are preserved unchanged as evidence of their measured faults:
    // R2.23D concatenated an expected value four times; R2.23D-R1 embedded a top-level await.
    if (existsSync(PRIOR_RUNNERS[3])) {
      expect(readFileSync(PRIOR_RUNNERS[3], "utf8")).toMatch(/\}'temperature':/);
    }
    if (existsSync(PRIOR_RUNNERS[4])) {
      expect(readFileSync(PRIOR_RUNNERS[4], "utf8")).toMatch(/^const r = await getLlmClient/m);
    }
    // R2.23D-R2 ran the live evaluation through Vitest, whose 5,000 ms default killed both passes.
    if (existsSync(PRIOR_RUNNERS[5])) {
      expect(readFileSync(PRIOR_RUNNERS[5], "utf8")).toMatch(/npx vitest run src\/lib\/bty\/foundry\/arena\/practice-generation\.eval\.test\.ts/);
    }
  });
});

describe(`runner file properties (${existsSync(RUNNER) ? "runner present — asserted" : "RUNNER ABSENT ON THIS MACHINE — file-level properties NOT asserted"})`, () => {
  it("R2.23D-R4. the runner is byte-identical to what the tracked generator produces", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    // The runner on disk must be exactly what the tested builder emits for its own bound HEAD —
    // proving no hand edit and no leftover from a previous runner.
    const head = /EXPECT_HEAD='([0-9a-f]{40})'/.exec(src)?.[1];
    expect(head, "the runner does not bind a HEAD").toBeTruthy();
    expect(src).toBe(renderRunner(manifestPayload(head!, "gpt-4o-mini"), head!));
  });

  it("43/44/45. it binds HEAD, manifest and BOTH schema digests, and halts on any mismatch", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false); // absence is recorded, never asserted away
    // R2.23D-R1 — the runner is GENERATED, so every contract is a `check` line rather than an
    // EXPECT_ variable, and structured values are compared by digest.
    for (const path of ["manifest.components.sampling", "manifest.components.providerSchema", "manifest.components.reviewSchema", "manifest.components.readinessResolver", "manifest.components.evidenceAuthority", "manifest.components.tokenBudget"]) {
      expect(src, `${path} is not checked`).toContain(`'${path}'`);
    }
    expect(src).toContain("EXPECT_HEAD=");
    expect(src).toContain("CONTRACT MISMATCH · RUNNER STALE");
    expect(src, "runner still contains unsubstituted placeholders").not.toMatch(/__EXPECT_[A-Z_]+__/);
    // The measured R2.23D defect: a Python dict repr in a shell assignment.
    expect(src, "a runtime object representation is being compared").not.toMatch(/\{'[a-zA-Z]+':/);
  });

  it("43b/46. every check runs BEFORE the credential prompt", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    const prompt = src.indexOf("read -rs LLM_API_KEY");
    expect(prompt).toBeGreaterThan(-1);
    for (const check of [
      /\[ "\$ACTUAL_HEAD"\s+= "\$EXPECT_HEAD" \]/,
      /check 'contract manifest'/,
      /tracked tree is dirty/,
      /canary case missing/,
      /check 'schema can exceed budget'/,
      /measured headroom below/,
      /at most 3 may be active/,
      /check 'Host scope selector'/,
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
    expect(src).toContain("EXPECTED_EXECUTIONS=6");
    for (const id of CANARY_CASES) expect(src).toContain(id);
    // R2.23D-R4 — pass identity lives in the validated runtime config, not in a shell variable the
    // script has to keep in step with the orchestrator's flag names. `EXPECT_MANIFEST` is exactly
    // what that duplication cost: it survived every presence assertion and died under `set -u`.
    expect(src).toContain('scripts/practice-live-stability.ts --config "$LIVE_CONFIG"');
    expect(src).toContain('scripts/practice-stability-collate.ts --config "$LIVE_CONFIG"');
    expect(src).toContain("STRUCTURAL + SEMANTIC GATES PASS");
    expect(src).toContain("HUMAN PRODUCT REVIEW REQUIRED");
    expect(src).not.toContain("PRODUCT QUALITY PASS");
  });

  it("the human-review packet leaves every judgment field explicitly PENDING", () => {
    // R2.23D-R2 — the packet is written by the tracked collator, not by shell-generated TypeScript.
    const collate = readFileSync(join(process.cwd(), "scripts/practice-stability-collate.ts"), "utf8");
    expect(collate).toContain("HUMAN REVIEW — every field below is PENDING");
    expect(collate).toMatch(/would you put this in front of a learner: PENDING/);
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    expect(src).toContain("scripts/practice-stability-collate.ts");
  });
});

// ---------------------------------------------------------------------------
// R2.23D-R4 — the INSTALLED file, not just what the generator emits.
//
// R2.23D-R3 reached an operator because every assertion was about strings being
// PRESENT in the script. `$EXPECT_MANIFEST` was present. It was never BOUND, and
// `--credential-boundary-check` exited before the line that would have proved it.
// ---------------------------------------------------------------------------

/** Names the environment supplies; everything else the script must bind itself. */
const ENV_SUPPLIED = new Set(["HISTFILE", "PATH", "HOME", "OPENAI_API_KEY", "BTY_PREFLIGHT_MOCK", "BTY_LIVE_EVAL_MOCK", "LLM_MODEL"]);

/** Every expansion in a shell script that no declaration binds. Quoted heredocs are Python. */
function unboundExpansions(shellSrc: string): string[] {
  const src = shellSrc.replace(/<<'PY'[\s\S]*?\nPY\n/g, "");
  const declared = new Set(["1", "2", "3", "*", "@", "?", "#", "0"]);
  for (const m of src.matchAll(/^\s*(?:local\s+|export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/gm)) declared.add(m[1]);
  for (const m of src.matchAll(/^\s*local\s+(.+)$/gm)) {
    for (const tok of m[1].split(/\s+/)) {
      const name = tok.split("=")[0];
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) declared.add(name);
    }
  }
  for (const m of src.matchAll(/\bread\s+-\w+\s+([A-Za-z_][A-Za-z0-9_]*)/g)) declared.add(m[1]);
  for (const m of src.matchAll(/\bexport\s+([A-Za-z_][A-Za-z0-9_]*)/g)) declared.add(m[1]);
  const used = new Set([...src.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
  return [...used].filter((n) => !declared.has(n) && !ENV_SUPPLIED.has(n)).sort();
}

describe("R2.23D-R4. the installed runner has no unbound expansion, under `set -u`", () => {
  it("binds every variable the installed runner expands", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    expect(unboundExpansions(src)).toEqual([]);
  });

  it("parses as valid bash", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    // `bash -n` reads the file the operator will actually execute.
    expect(() => execFileSync("bash", ["-n", RUNNER], { stdio: ["ignore", "pipe", "pipe"] })).not.toThrow();
  });

  it("runs under `set -u`, so an unbound expansion aborts rather than defaulting", () => {
    const src = runnerSource();
    if (!src) return expect(existsSync(RUNNER)).toBe(false);
    expect(src).toMatch(/^set -Eeuo pipefail$/m);
  });

  it("finds the exact defect in the R2.23D-R3 runner, if that file is still present", () => {
    // The regression proof against REALITY, not a synthetic mutation: the runner that failed in
    // front of an operator is on disk, and this audit must name the variable that killed it.
    const prior = "/tmp/r223d_r3_live_practice_stability_canary.sh";
    if (!existsSync(prior)) return expect(existsSync(prior)).toBe(false);
    expect(unboundExpansions(readFileSync(prior, "utf8"))).toContain("EXPECT_MANIFEST");
  });
});
