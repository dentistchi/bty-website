import { describe, it, expect } from "vitest";
import { CANARY_CASE_IDS, buildChecks, manifestPayload, renderRunner } from "./stabilityRunnerScript";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, digest } from "./contractManifest";
import { PRACTICE_SAMPLING } from "./arenaScenarioGenerationService";

/**
 * STABILITY-RUNNER GENERATION INTEGRITY (Slice 3.2I-R5B1A.1-R2.23D-R1).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D runner halted before the credential prompt on a generation-sampling comparison whose
 * four values were semantically identical. Measured from the file, line 33 read:
 *
 *   EXPECT_GEN_SAMPLING='{'temperature': 0.8, …}'temperature': 0.8, …}'temperature': …
 *
 * Two independent faults, both in the untracked ad-hoc generator:
 *   - the expected value was Python `str(dict)`, whose single quotes terminate a single-quoted
 *     shell assignment and whose format is runtime-specific;
 *   - re-placeholdering matched `EXPECT_GEN_SAMPLING='[^']*'`, a pattern that cannot span a value
 *     containing single quotes, so each regeneration left the old remainder behind and appended a
 *     new copy — four fragments for generation, three for review.
 *
 * Nothing tested any of it, because the generator was a throwaway script. That is the real root
 * cause, and it is what this file now covers.
 */

const HEAD = "a".repeat(40);
const payload = () => manifestPayload(HEAD, "gpt-4o-mini");
const runner = () => renderRunner(payload(), HEAD);

// ---------------------------------------------------------------------------
// PART 3 — repeated interpolation
// ---------------------------------------------------------------------------

describe("PART 3 — the repeated-interpolation defect cannot recur", () => {
  it("every check LINE is interpolated exactly once — the R2.23D fault was four copies of one", () => {
    const script = runner();
    for (const c of buildChecks(payload())) {
      // Count the whole emitted line. A bare scalar like `2` legitimately occurs elsewhere; what
      // must be unique is the check itself, which is what accumulated in R2.23D.
      const line = `check '${c.label}' '${c.path}' '${c.expected}'`;
      const occurrences = script.split(line).length - 1;
      expect(occurrences, `${c.label} appears ${occurrences} times`).toBe(1);
    }
  });

  it("every digest is interpolated exactly once — a 64-hex value can never legitimately repeat", () => {
    const script = runner();
    for (const c of buildChecks(payload()).filter((x) => x.kind === "digest")) {
      const raw = JSON.parse(c.expected) as string;
      expect(script.split(raw).length - 1, c.label).toBe(1);
    }
  });

  it("no adjacent object concatenation survives anywhere in the script", () => {
    expect(runner()).not.toMatch(/\}\{/);
    expect(runner()).not.toMatch(/\}'[a-zA-Z]/); // the exact R2.23D shape: }'temperature'
  });

  it("each sampling key appears at most once in the whole runner", () => {
    const script = runner();
    for (const key of ["temperature", "topP", "maxTokens", "timeoutMs"]) {
      const n = script.split(key).length - 1;
      expect(n, `${key} appears ${n} times`).toBeLessThanOrEqual(1);
    }
  });

  it("the runner is generated WHOLE — it never reads a previous runner", () => {
    // Regenerating twice from the same inputs is byte-identical: there is no accumulating state.
    expect(renderRunner(payload(), HEAD)).toBe(renderRunner(payload(), HEAD));
  });

  it("a value containing a single quote is shell-escaped, not left to break the assignment", () => {
    const nasty = renderRunner(payload(), "it's-a-head");
    expect(nasty).toContain(`EXPECT_HEAD='it'\\''s-a-head'`);
  });
});

// ---------------------------------------------------------------------------
// PART 4 — semantic equality
// ---------------------------------------------------------------------------

describe("PART 4 — the comparison is semantic, never presentational", () => {
  const sampling = { generation: PRACTICE_SAMPLING.generation, review: PRACTICE_SAMPLING.review, retry: PRACTICE_SAMPLING.retry };

  it("1. identical values in a different key order produce the same digest", () => {
    const reordered = {
      retry: PRACTICE_SAMPLING.retry,
      review: { timeoutMs: PRACTICE_SAMPLING.review.timeoutMs, maxTokens: PRACTICE_SAMPLING.review.maxTokens, topP: PRACTICE_SAMPLING.review.topP, temperature: PRACTICE_SAMPLING.review.temperature },
      generation: { topP: PRACTICE_SAMPLING.generation.topP, temperature: PRACTICE_SAMPLING.generation.temperature, timeoutMs: PRACTICE_SAMPLING.generation.timeoutMs, maxTokens: PRACTICE_SAMPLING.generation.maxTokens },
    };
    expect(digest(reordered)).toBe(digest(sampling));
  });

  it("2. NO object representation is ever compared — the script contains no repr or eval path", () => {
    const script = runner();
    // The R2.23D extractor was `print(eval('d'+path))`, which emits a Python dict repr.
    expect(script).not.toContain("eval(");
    expect(script).not.toMatch(/print\(d\)/);
    expect(script).not.toMatch(/\{'[a-zA-Z]+':/); // a Python dict repr anywhere
    // Extraction is json.dumps with sorted keys and fixed separators.
    expect(script).toContain('json.dumps(d, sort_keys=True, separators=(",", ":"))');
  });

  it("3. whitespace cannot affect a comparison", () => {
    expect(canonicalJson(JSON.parse(JSON.stringify(sampling, null, 4)))).toBe(canonicalJson(sampling));
  });

  it("4/5. 16000 and 0.80 canonicalize to their numeric values", () => {
    expect(canonicalJson({ maxTokens: 16000 })).toBe(canonicalJson({ maxTokens: 16_000 }));
    expect(canonicalJson({ temperature: 0.8 })).toBe(canonicalJson({ temperature: 0.80 }));
    expect(digest({ temperature: 0.8 })).toBe(digest({ temperature: 0.80 }));
  });

  it("6/7/8. a changed, missing or extra value DOES change the digest", () => {
    expect(digest({ ...sampling, generation: { ...PRACTICE_SAMPLING.generation, temperature: 0.7 } })).not.toBe(digest(sampling));
    const { review, ...missing } = sampling;
    expect(review).toBeDefined();
    expect(digest(missing)).not.toBe(digest(sampling));
    expect(digest({ ...sampling, extra: 1 })).not.toBe(digest(sampling));
  });

  it("12. secrets and unrelated environment values cannot affect the sampling digest", () => {
    const before = { ...process.env };
    process.env.OPENAI_API_KEY = "sk-must-not-matter";
    process.env.LLM_BASE_URL = "https://secret.example/v1";
    process.env.CI = "1";
    try {
      expect(digest({ generation: PRACTICE_SAMPLING.generation, review: PRACTICE_SAMPLING.review, retry: PRACTICE_SAMPLING.retry })).toBe(digest(sampling));
      expect(runner()).not.toContain("sk-must-not-matter");
      expect(runner()).not.toContain("secret.example");
    } finally {
      process.env = before;
    }
  });
});

// ---------------------------------------------------------------------------
// PART 5 — every structured check audited
// ---------------------------------------------------------------------------

describe("PART 5 — every structured contract is compared by digest or canonical JSON", () => {
  it("sampling is compared by the manifest component digest, not by object text", () => {
    const checks = buildChecks(payload());
    const sampling = checks.find((c) => c.path === "manifest.components.sampling");
    expect(sampling).toBeDefined();
    expect(sampling!.kind).toBe("digest");
    expect(JSON.parse(sampling!.expected)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("every digest check expects a 64-hex SHA-256, and every scalar a JSON primitive", () => {
    for (const c of buildChecks(payload())) {
      const value = JSON.parse(c.expected);
      if (c.kind === "digest") expect(String(value), c.label).toMatch(/^[0-9a-f]{64}$/);
      else expect(["string", "number", "boolean"], c.label).toContain(typeof value);
    }
  });

  it("the full audited surface is covered — 22 checks across every structured contract", () => {
    const paths = buildChecks(payload()).map((c) => c.path);
    for (const required of [
      "manifestSha256",
      "manifest.components.providerSchema",
      "manifest.components.reviewSchema",
      "manifest.components.corpus",
      "canaryCaseSha256",
      "manifest.components.generatedCardinality",
      "manifest.components.generatedFieldBounds",
      "manifest.components.tokenBudget",
      "manifest.components.evidenceAuthority",
      "manifest.components.boundaryScopeContract",
      "manifest.components.readinessResolver",
      "manifest.components.sampling",
      "manifest.components.rejectionPrecedence",
      "manifest.components.retryPolicy",
      "manifest.artifactSchemaVersion",
      "manifest.cardinality.primaryChoices",
      "manifest.evidenceAuthority.maxActiveBoundaries",
      "manifest.evidenceAuthority.providerSelfAttestation",
      "manifest.evidenceAuthority.retryAuthority",
      "manifest.evidenceAuthority.automaticBoundarySelection",
      "manifest.evidenceAuthority.hostScopeSelectorExists",
      "manifest.schemaCanExceedBudget",
    ]) {
      expect(paths, `${required} is not audited`).toContain(required);
    }
    expect(paths).toHaveLength(22);
    expect(new Set(paths).size).toBe(22); // no path checked twice
  });

  it("booleans are canonical JSON — `false`, never a runtime's `False`", () => {
    const checks = buildChecks(payload());
    for (const label of ["provider self-attestation", "automatic boundary selection", "schema can exceed budget"]) {
      expect(checks.find((c) => c.label === label)!.expected, label).toBe("false");
    }
    expect(checks.find((c) => c.label === "Host scope selector")!.expected).toBe("true");
    expect(runner()).not.toMatch(/= 'True'|= 'False'/);
  });
});

// ---------------------------------------------------------------------------
// PART 6 — the credential boundary
// ---------------------------------------------------------------------------

describe("PART 6 — the credential-boundary mode adds a stop, it never removes a check", () => {
  const script = runner();

  it("10/11. EVERY contract check precedes the credential prompt", () => {
    const prompt = script.indexOf("read -rs LLM_API_KEY");
    expect(prompt).toBeGreaterThan(-1);
    for (const c of buildChecks(payload())) {
      expect(script.indexOf(c.expected), `${c.label} is checked after the prompt`).toBeLessThan(prompt);
    }
    // …and so does every non-digest gate.
    for (const gate of ["tracked tree is dirty", "measured headroom below", "canary case missing", "answer-key wording"]) {
      expect(script.indexOf(gate), gate).toBeLessThan(prompt);
    }
  });

  it("the boundary mode exits BEFORE the prompt and prints the test-only marker", () => {
    const exit = script.indexOf("PREFLIGHT CONTRACT PASS · CREDENTIAL NOT REQUESTED");
    expect(exit).toBeGreaterThan(-1);
    expect(exit).toBeLessThan(script.indexOf("read -rs LLM_API_KEY"));
    expect(script).toContain("--credential-boundary-check");
  });

  it("it is NOT a force option — it cannot skip a check or relax a comparison", () => {
    // The flag is read once, and is only consulted AFTER the last check, to exit early.
    expect(script.split("CHECK_ONLY").length - 1).toBe(3); // declare, set, test
    const flagTest = script.indexOf('if [ "$CHECK_ONLY" = \'1\' ]');
    expect(flagTest).toBeGreaterThan(script.lastIndexOf("check '"));
    expect(script).not.toMatch(/--force|SKIP_|ALLOW_STALE|--no-verify|BYPASS/);
  });

  it("a mismatch still exits nonzero with the canonical message", () => {
    expect(script).toContain("CONTRACT MISMATCH · RUNNER STALE");
    expect(script).toMatch(/mismatch\(\)[\s\S]*exit 3/);
  });
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

describe("the generated runner stays inside its scope", () => {
  it("contains no data-store, edge-platform or release operation", () => {
    const script = runner().replace(/^#.*$/gm, ""); // comments legitimately name the boundary
    for (const banned of ["wrangler", "supabase", "psql", "PGPASSWORD", "pgpass"]) {
      expect(script.toLowerCase(), banned).not.toContain(banned.toLowerCase());
    }
  });

  it("binds the three canary cases and never labels the result a product-quality pass", () => {
    const script = runner();
    for (const id of CANARY_CASE_IDS) expect(script).toContain(id);
    expect(script).toContain("STRUCTURAL + SEMANTIC GATES PASS");
    expect(script).toContain("HUMAN PRODUCT REVIEW REQUIRED");
    expect(script).not.toContain("PRODUCT QUALITY PASS");
  });

  it("never writes or echoes the credential", () => {
    const script = runner();
    expect(script).toContain("read -rs LLM_API_KEY");
    expect(script).toContain("unset HISTFILE");
    expect(script).toMatch(/trap cleanup EXIT/);
    expect(script).not.toMatch(/echo .*\$LLM_API_KEY|> *\.env/);
  });
});

// ---------------------------------------------------------------------------
// R2.23D-R2 — runtime safety and credential lifecycle
// ---------------------------------------------------------------------------

describe("PART 7 — no inline async TypeScript survives in the runner path", () => {
  const script = runner();

  it("6. NO `tsx -e` remains anywhere — every TypeScript entry point is a tracked file", () => {
    expect(script).not.toMatch(/tsx -e/);
    // `practice-generation.eval.ts` is the corpus file, not a generated eval program.
    expect(script.replace(/practice-generation\.eval\.ts/g, "")).not.toMatch(/eval\.ts/);
  });

  it("1. the only `await` left is prose in a comment, never executable", () => {
    for (const line of script.split("\n")) {
      if (/\bawait\b/.test(line)) expect(line.trimStart().startsWith("#"), line).toBe(true);
    }
  });

  it("the runner invokes the tracked provider preflight and the tracked collator", () => {
    expect(script).toContain("npx --yes tsx scripts/practice-provider-preflight.ts");
    expect(script).toContain("npx --yes tsx scripts/practice-stability-collate.ts");
  });

  it("8/17. a failing provider preflight stops the runner — its exit status is honoured", () => {
    expect(script).toMatch(/if ! npx --yes tsx scripts\/practice-provider-preflight\.ts; then\n  die /);
  });

  it("9/18. the provider preflight precedes every generation execution", () => {
    const preflight = script.lastIndexOf("scripts/practice-provider-preflight.ts");
    // R2.23D-R3 — generation runs through the tracked orchestrator, never through Vitest. The
    // FIRST mention is the artifact-authority grep in check 7; the invocation is the last.
    const generation = script.lastIndexOf("npx --yes tsx scripts/practice-live-stability.ts");
    expect(preflight).toBeGreaterThan(-1);
    expect(generation).toBeGreaterThan(preflight);
    // …and `die` exits before reaching it.
    expect(script.indexOf("PROVIDER PREFLIGHT FAILED")).toBeLessThan(generation);
  });
});

describe("PART 6 — credential lifecycle", () => {
  const script = runner();

  it("14. the credential is requested only AFTER every contract check", () => {
    const prompt = script.indexOf("read -rs LLM_API_KEY");
    expect(script.lastIndexOf("check '")).toBeLessThan(prompt);
    expect(script.indexOf("MIN_HEADROOM")).toBeLessThan(prompt);
  });

  it("15. the cleanup trap is registered BEFORE the LIVE provider preflight can fail", () => {
    const trap = script.indexOf("trap cleanup EXIT INT TERM");
    expect(trap).toBeGreaterThan(-1);
    // The FIRST preflight occurrence is the credential-free mock, which runs before any credential
    // exists. What must be trapped is the LIVE invocation.
    const livePreflight = script.lastIndexOf("scripts/practice-provider-preflight.ts");
    expect(livePreflight).toBeGreaterThan(script.indexOf("read -rs LLM_API_KEY"));
    expect(trap).toBeLessThan(livePreflight);
    expect(script).toMatch(/cleanup\(\) \{ unset LLM_API_KEY OPENAI_API_KEY/);
  });

  it("the credential is exported to child processes only, never echoed or written", () => {
    expect(script).toContain("export LLM_API_KEY");
    expect(script).toContain("unset HISTFILE");
    expect(script).not.toMatch(/echo .*LLM_API_KEY|printf [^\n]*\$LLM_API_KEY|> *\.env|tee .*key/);
  });

  it("16. no sentinel-shaped secret can reach a generated file — the runner writes only two", () => {
    // The runner's own outputs are produced by the tracked collator from immutable artifacts, and
    // neither ever reads the credential variable.
    expect(script).toMatch(/OUT_JSON='live_practice_stability_result/);
    expect(script).toMatch(/OUT_MD='live_practice_stability_review/);
    const collate = readFileSync(join(process.cwd(), "scripts/practice-stability-collate.ts"), "utf8");
    // Credential USE, not a substring: `requiresNewRunnerAuthorization` legitimately ends in
    // "Authorization". The collator must read no credential and build no auth header.
    expect(collate).not.toMatch(/LLM_API_KEY|OPENAI_API_KEY|Bearer |["']Authorization["']\s*:/);
  });
});

describe("PART 9 — BOUNDARY 2, the mock runtime proof", () => {
  const script = runner();

  it("20. the credential-boundary mode also executes the REAL preflight program against a mock", () => {
    expect(script).toContain("BTY_PREFLIGHT_MOCK=1 npx --yes tsx scripts/practice-provider-preflight.ts");
    const mock = script.indexOf("BTY_PREFLIGHT_MOCK=1");
    expect(mock).toBeLessThan(script.indexOf("read -rs LLM_API_KEY"));
    expect(script).toContain("PREFLIGHT CONTRACT PASS · CREDENTIAL NOT REQUESTED");
  });

  it("the mock env var is set ONLY in the boundary mode — never on the live path", () => {
    expect(script.split("BTY_PREFLIGHT_MOCK").length - 1).toBe(1);
  });
});

describe("R2.23D-R3 — Vitest no longer holds live-execution authority", () => {
  const script = runner();

  it("the runner invokes NO test framework — the 5,000 ms default that killed R2.23D-R2 is gone", () => {
    // Comments legitimately explain the defect; what matters is that nothing EXECUTES a test runner.
    const code = script.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
    expect(code).not.toMatch(/vitest/i);
    expect(code).not.toContain("RUN_LIVE_EVAL");
    expect(code).not.toContain("practice-generation.eval.test.ts");
  });

  it("generation runs through the tracked orchestrator, and collation through the tracked collator", () => {
    expect(script).toContain("npx --yes tsx scripts/practice-live-stability.ts");
    expect(script).toContain("npx --yes tsx scripts/practice-stability-collate.ts");
    expect(script).toContain("--cases \"$CASE_IDS\"");
  });

  it("every documented exit code is handled, and 4/5 are reported distinctly", () => {
    expect(script).toMatch(/EVAL_STATUS=\$\?/);
    expect(script).toMatch(/4\) printf '  INFRASTRUCTURE FAILURE/);
    expect(script).toMatch(/5\) printf '  ARTIFACT WRITE FAILURE/);
  });

  it("PART 8 — the version label is R2.23D-R3 everywhere, with no stale predecessor", () => {
    expect(script).toContain("R2.23D-R3 PRACTICE STABILITY CANARY");
    expect(script).toContain("Slice 3.2I-PRACTICE-R5B1A.1-R2.23D-R3");
    expect(script).toMatch(/live_practice_stability_result\.r2\.23d-r3\.json/);
    expect(script).toMatch(/live_practice_stability_review\.r2\.23d-r3\.md/);
    const code = script.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
    expect(code).not.toMatch(/R2\.23D-R1|R2\.23D-R2|r2\.23d-r1|r2\.23d-r2/);
  });

  it("an incomplete run is never labelled a gates pass", () => {
    expect(script).toMatch(/if \[ "\$EVAL_STATUS" = '0' \]; then\n  printf 'STRUCTURAL \+ SEMANTIC GATES PASS/);
    expect(script).toContain("RUN INCOMPLETE — NOT STABILITY EVIDENCE");
    expect(script).not.toContain("PRODUCT QUALITY PASS");
  });
});
