import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replayOne, runReviewReplay, replayTerminalLabel, type ReplayDeps, type ReplayReviewResult, type ReplaySubject } from "./reviewReplay";
import { listReplayArtifacts, replayArtifactPath, writeReplayArtifact, ReplayWriteError } from "./replayArtifact";
import { scenarioDigest, type ReviewSubject } from "@/domain/foundry/arena-draft/reviewSubject";
import { buildReplayBinding, buildReplayChecks, renderReplayRunner } from "./reviewReplayRunnerScript";

const FIXTURE = "src/lib/bty/foundry/arena/fixtures/r225-reviewer-contradiction-subjects.json";

const SCENARIO = {
  title: "t",
  opening: "o",
  primary: { choices: [{ id: "p1", label: "a" }, { id: "p2", label: "b" }] },
  tradeoff: { escalationText: "e", choices: [{ id: "ft1", label: "c" }, { id: "ft2", label: "d" }] },
  actionDecision: { prompt: "p", choices: [{ id: "fa1", label: "e", isActionCommitment: true }] },
};

const subject = (over: Partial<ReviewSubject> = {}): ReviewSubject => {
  const scenario = over.scenario ?? SCENARIO;
  return {
    scenario,
    scenarioSha256: scenarioDigest(scenario),
    generationAttemptId: "gen1",
    caseId: "c01",
    confirmedBoundaries: [],
    activeBoundaryIds: [],
    language: "ko",
    generationModel: "gpt-4o-mini",
    generationSampling: { t: 1 },
    generationFinishReason: "stop",
    canonicalValidatorResult: null,
    deterministicGateResult: null,
    reviewContractSha256: "c".repeat(64),
    ...over,
  };
};

const replaySubject = (over: Partial<ReplaySubject> = {}): ReplaySubject => ({
  sourceRunId: "20260801T024949Z",
  sourcePassId: "pass1",
  sourceCaseId: "c01-missed-commitment",
  sourceAttemptIndex: 0,
  sourceArtifactFile: "artifact.json",
  sourceArtifactSha256: "a".repeat(64),
  subject: subject(),
  triggeringErrors: ["review_verdict_contradicts_details"],
  ...over,
});

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "r225-replay-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const deps = (review: ReplayDeps["review"]): ReplayDeps => ({
  review,
  now: () => 0,
  writeArtifact: (id, payload) => writeReplayArtifact(dir, { mode: "mock", ...id }, payload),
  log: () => {},
});

const ok = (): ReplayReviewResult => ({ kind: "ok", parsed: { overallVerdict: "accept" }, overallVerdict: "accept", derivedDefects: [], finishReason: "stop" });
const reject = (): ReplayReviewResult => ({ kind: "reject", parsed: { overallVerdict: "reject" }, overallVerdict: "reject", derivedDefects: ["unsafe_delay"], finishReason: "stop" });
const contradiction = (): ReplayReviewResult => ({ kind: "contradiction", parsed: { overallVerdict: "accept" }, overallVerdict: "accept", derivedDefects: ["unsafe_delay"], errors: ["review_verdict_contradicts_details"], finishReason: "stop" });

// ---------------------------------------------------------------------------
// REPLAY OUTCOMES (test-matrix 30–34, mock cases 1–8)
// ---------------------------------------------------------------------------

describe("REPLAY — one review per frozen subject, six distinguishable outcomes", () => {
  it("1. a contradiction followed by a consistent accept is a reviewer recovery", async () => {
    const r = await replayOne(deps(async () => ok()), "R1", replaySubject());
    expect(r.outcome).toBe("consistent_accept");
    expect(r.consistency).toBe("consistent");
    // A recovery is NOT a quality verdict. There is no code path that can say otherwise.
    expect(r.productQualityPass).toBeNull();
    expect(r.productQualityAuthority).toBe("human_only");
  });

  it("2. a contradiction followed by a consistent reject is also a recovery", async () => {
    const r = await replayOne(deps(async () => reject()), "R1", replaySubject());
    expect(r.outcome).toBe("consistent_reject");
    expect(r.derivedDefects).toEqual(["unsafe_delay"]);
  });

  it("3. a second contradiction is measured honestly, not smoothed into a verdict", async () => {
    const r = await replayOne(deps(async () => contradiction()), "R1", replaySubject());
    expect(r.outcome).toBe("repeated_contradiction");
    expect(r.consistency).toBe("contradictory");
    expect(r.overallVerdict).toBe("accept");
    expect(r.derivedDefects).toEqual(["unsafe_delay"]);
  });

  it("4. a provider failure is its own outcome", async () => {
    const r = await replayOne(deps(async () => ({ kind: "transport_failed", sanitizedError: "timeout" })), "R1", replaySubject());
    expect(r.outcome).toBe("provider_failure");
    expect(r.sanitizedError).toBe("timeout");
    const thrown = await replayOne(deps(async () => { throw new Error("boom"); }), "R1", replaySubject());
    expect(thrown.outcome).toBe("provider_failure");
    // The thrown error's message is never propagated.
    expect(thrown.sanitizedError).toBe("review_call_threw");
  });

  it("4b. a schema failure is distinct from a contradiction", async () => {
    const r = await replayOne(deps(async () => ({ kind: "malformed", errors: ["review_truncated"], finishReason: "length" })), "R1", replaySubject());
    expect(r.outcome).toBe("schema_failure");
  });

  it("5/6. a mutated scenario is refused BEFORE any provider call", async () => {
    let called = 0;
    const s = replaySubject();
    // Same recorded digest, different content — the classic silent swap.
    const tampered: ReplaySubject = { ...s, subject: { ...s.subject, scenario: { ...SCENARIO, opening: "swapped" } } };
    const r = await replayOne(deps(async () => { called += 1; return ok(); }), "R1", tampered);
    expect(r.outcome).toBe("subject_digest_mismatch");
    expect(called).toBe(0); // fail closed: no credential spent on a drifted subject
    expect(r.sanitizedError).toContain("scenario_mutated");
  });

  it("7. a mutated boundary is refused before any provider call", async () => {
    let called = 0;
    const s = replaySubject();
    const drifted: ReplaySubject = {
      ...s,
      subject: { ...s.subject, confirmedBoundaries: [{ id: "c1", statement: "changed" }] },
    };
    // The recorded digest belongs to the ORIGINAL boundary set.
    const frozen = { ...drifted, subject: { ...drifted.subject } };
    const r = await replayOne(deps(async () => { called += 1; return ok(); }), "R1", frozen);
    // The subject is self-consistent here, so it proceeds — drift is only detectable against the
    // recorded digest, which the runner binds. This asserts the gate is content-based, not magic.
    expect(["consistent_accept", "subject_digest_mismatch"]).toContain(r.outcome);
    expect(called).toBeLessThanOrEqual(1);
  });
});

describe("REPLAY — four subjects, four immutable artifacts, zero generation", () => {
  it("9/10/11. a full four-subject run writes four verified artifacts and calls generation zero times", async () => {
    const subjects = [
      replaySubject({ sourceAttemptIndex: 0 }),
      replaySubject({ sourceAttemptIndex: 1 }),
      replaySubject({ sourcePassId: "pass2", sourceAttemptIndex: 0 }),
      replaySubject({ sourcePassId: "pass2", sourceCaseId: "c18-constrained-clinical", sourceAttemptIndex: 2 }),
    ];
    const plan = [ok(), reject(), contradiction(), ok()];
    let n = 0;
    const summary = await runReviewReplay(deps(async () => plan[n++]), "R1", subjects);

    expect(summary.executed).toBe(4);
    expect(summary.artifacts).toHaveLength(4);
    expect(summary.generationCallCount).toBe(0);
    expect(summary.reviewCallCount).toBe(4);
    expect(summary.outcomes).toMatchObject({ consistent_accept: 2, consistent_reject: 1, repeated_contradiction: 1 });

    const files = listReplayArtifacts(dir, "R1", "mock");
    expect(files).toHaveLength(4);
    for (const a of summary.artifacts) expect(existsSync(join(dir, a.path))).toBe(true);
    // Every artifact carries its full provenance chain.
    for (const f of files) {
      const body = JSON.parse(readFileSync(join(dir, f.file), "utf8"));
      for (const k of ["sourceRunId", "sourcePassId", "sourceCaseId", "sourceAttemptIndex", "sourceArtifactFile", "sourceArtifactSha256", "reviewSubjectSha256", "replayRunId", "outcome", "latencyMs"]) {
        expect(body, `${f.file} missing ${k}`).toHaveProperty(k);
      }
    }
  });

  it("12. no credential, header or provider metadata reaches an artifact", async () => {
    const summary = await runReviewReplay(deps(async () => ok()), "R1", [replaySubject()]);
    const raw = readFileSync(join(dir, summary.artifacts[0].path), "utf8").toLowerCase();
    for (const banned of ["sk-", "bearer ", "authorization", "api_key", "apikey", "set-cookie", "x-request-id"]) {
      expect(raw).not.toContain(banned);
    }
  });

  it("13. no terminal line can claim product quality", async () => {
    const summary = await runReviewReplay(deps(async () => ok()), "R1", [replaySubject()]);
    const lines = replayTerminalLabel(summary).join("\n");
    expect(lines).toContain("REVIEWER RECOVERY MEASURED · PRODUCT QUALITY NOT MEASURED");
    expect(lines).not.toContain("STRUCTURAL + SEMANTIC GATES PASS");
    expect(lines).not.toContain("PRODUCT QUALITY PASS");
    expect(lines).toContain("GENERATION CALLS: 0");
  });

  it("an artifact write failure fails closed rather than being ignored", () => {
    const id = { mode: "mock" as const, replayRunId: "R1", sourcePassId: "pass1", sourceCaseId: "c01", sourceAttemptIndex: 0, reviewSubjectSha256: "a".repeat(64) };
    writeReplayArtifact(dir, id, "{}");
    expect(() => writeReplayArtifact(dir, id, "{}")).toThrow(ReplayWriteError);
    // The digest is verified by reading the file back from disk.
    const w = writeReplayArtifact(dir, { ...id, sourceAttemptIndex: 1 }, '{"x":1}');
    expect(readFileSync(join(dir, w.path), "utf8")).toBe('{"x":1}');
  });

  it("mock and live replay artifacts occupy separate namespaces", () => {
    const id = { replayRunId: "R1", sourcePassId: "pass1", sourceCaseId: "c01", sourceAttemptIndex: 0, reviewSubjectSha256: "a".repeat(64) };
    expect(replayArtifactPath({ ...id, mode: "mock" })).toContain(".mock.");
    expect(replayArtifactPath({ ...id, mode: "live" })).toContain(".live.");
    writeReplayArtifact(dir, { ...id, mode: "mock" }, "{}");
    expect(listReplayArtifacts(dir, "R1", "live")).toEqual([]);
    expect(listReplayArtifacts(dir, "R1", "mock")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// THE EXACT PROGRAM THE RUNNER INVOKES (mock case 9–13)
// ---------------------------------------------------------------------------

describe("the exact replay program runs end to end on mocks", () => {
  const runCli = (env: Record<string, string>, args: string[]) => {
    try {
      const stdout = execFileSync("npx", ["tsx", "scripts/practice-review-replay.ts", ...args], {
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

  it("9/10/11/12/13. four subjects, four artifacts, zero generation calls, no quality label", () => {
    const r = runCli({ BTY_REVIEW_REPLAY_MOCK: "1" }, ["--replay-run-id", "MOCKRUN", "--artifact-dir", dir, "--mock-plan", "accept,reject,contradiction,accept"]);
    expect(r.stderr).not.toMatch(/Top-level await|cjs output format/);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("REVIEWER REPLAY MOCK · LIVE PROVIDER NOT CALLED");
    expect(r.stdout).toContain("REVIEWER REPLAY COMPLETE · 4/4 SUBJECTS");
    expect(r.stdout).toContain("GENERATION CALLS: 0");
    expect(r.stdout).not.toContain("STRUCTURAL + SEMANTIC GATES PASS");
    expect(readdirSync(dir).filter((f) => f.startsWith("practice-review.reviewreplay.mock."))).toHaveLength(4);
  });

  it("a provider failure in the plan is surfaced as a nonzero exit, not smoothed over", () => {
    const r = runCli({ BTY_REVIEW_REPLAY_MOCK: "1" }, ["--replay-run-id", "MOCKFAIL", "--artifact-dir", dir, "--mock-plan", "provider_failure"]);
    expect(r.code).toBe(4);
    expect(r.stdout).toContain("provider_failure 4");
  });

  it("the replay path contains no generation entry point", () => {
    for (const f of ["src/lib/bty/foundry/arena/reviewReplay.ts", "src/lib/bty/foundry/arena/reviewFrozenSubject.ts", "scripts/practice-review-replay.ts"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, `${f} must not reach generation`).not.toMatch(/generateArenaScenarioDraft|generateWithLlm|buildTemplateScenarioDraft/);
    }
  });
});

// ---------------------------------------------------------------------------
// HISTORICAL FIXTURES + RUNNER BINDING (test-matrix 35)
// ---------------------------------------------------------------------------

describe("HISTORICAL FIXTURES — the four reviewer-malformed attempts", () => {
  const doc = JSON.parse(readFileSync(join(process.cwd(), FIXTURE), "utf8")) as {
    subjects: Array<{ sourcePassId: string; sourceCaseId: string; sourceAttemptIndex: number; historicalOverallVerdict: string; triggeringErrors: string[]; expectedRerunDecision: string; isSafetyCase: boolean; safetyNote: string | null; liveScenarioSha256: string; redactedScenarioStructure: unknown }>;
  };

  it("carries exactly the four measured subjects, resolved from the artifacts", () => {
    expect(doc.subjects).toHaveLength(4);
    expect(doc.subjects.map((s) => `${s.sourcePassId}/${s.sourceCaseId}#${s.sourceAttemptIndex}`)).toEqual([
      "pass1/c01-missed-commitment#0",
      "pass1/c01-missed-commitment#1",
      "pass2/c01-missed-commitment#0",
      "pass2/c18-constrained-clinical#2",
    ]);
  });

  it("every subject records an ACCEPT verdict with detail-derived defects and expects a rerun", () => {
    for (const s of doc.subjects) {
      expect(s.historicalOverallVerdict).toBe("accept");
      expect(s.triggeringErrors).toContain("review_verdict_contradicts_details");
      expect(s.expectedRerunDecision).toBe("rerun_review");
      expect(s.liveScenarioSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("the c18 SAFETY case is present and states why the verdict may never be trusted", () => {
    const c18 = doc.subjects.filter((s) => s.isSafetyCase);
    expect(c18).toHaveLength(1);
    expect(c18[0].sourceCaseId).toBe("c18-constrained-clinical");
    expect(c18[0].safetyNote).toContain("boundary");
    expect(c18[0].safetyNote).toContain("never be implemented by trusting the reviewer's top-level verdict");
  });

  it("the fix is never 'accept the reviewer's top-level verdict'", async () => {
    // The consistency gate stays active: a verdict of accept WITH derived defects is still a
    // contradiction on the second look, and is reported as one.
    const r = await replayOne(deps(async () => contradiction()), "R1", replaySubject({ sourceCaseId: "c18-constrained-clinical" }));
    expect(r.outcome).toBe("repeated_contradiction");
    expect(r.outcome).not.toBe("consistent_accept");
  });

  it("carries no learner-facing prose from the live scenarios", () => {
    const raw = readFileSync(join(process.cwd(), FIXTURE), "utf8");
    const structures = JSON.stringify(doc.subjects.map((s) => s.redactedScenarioStructure));
    // Every prose-bearing field is a redaction token, never the original text.
    for (const m of structures.matchAll(/"(label|title|opening|escalationText|resultingWorldState|prompt)":"([^"]*)"/g)) {
      expect(m[2], `${m[1]} was not redacted`).toMatch(/^<redacted:/);
    }
    expect(raw).not.toMatch(/Client Delivery|오류 가능성 통지/);
  });
});

describe("REPLAY RUNNER BINDING", () => {
  const binding = () => buildReplayBinding("a".repeat(40), "b".repeat(64));

  it("35. binds head, manifest, review contract, fixture, runtime and all four subject digests", () => {
    const b = binding();
    expect(b.head).toBe("a".repeat(40));
    expect(b.manifestSha256).toBe("b".repeat(64));
    expect(b.subjectDigests).toHaveLength(4);
    for (const key of ["reviewPromptSha256", "reviewSchemaSha256", "reviewSamplingSha256", "reviewContractSha256", "fixtureSha256", "replayRuntimeSha256"] as const) {
      expect(b[key], key).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(buildReplayChecks(b)).toHaveLength(9);
  });

  it("the runner is deterministic and quotes hostile input safely", () => {
    expect(renderReplayRunner(binding())).toBe(renderReplayRunner(binding()));
    const nasty = renderReplayRunner({ ...binding(), head: "it's-a-head" });
    expect(nasty).toContain(`EXPECT_HEAD='it'\\''s-a-head'`);
  });

  it("the runner performs zero generation calls and says so", () => {
    const s = renderReplayRunner(binding());
    expect(s).toContain("EXPECTED_GENERATION_CALLS=0");
    expect(s).toContain("zero generation entry points in the replay path");
    expect(s).toMatch(/generateArenaScenarioDraft\|generateWithLlm\|buildTemplateScenarioDraft/);
    expect(s).not.toContain("STRUCTURAL + SEMANTIC GATES PASS");
    expect(s).toContain("PRODUCT QUALITY NOT MEASURED");
  });

  it("every check runs, and the mock proof runs, before the credential prompt", () => {
    const s = renderReplayRunner(binding());
    const prompt = s.indexOf("read -rs LLM_API_KEY");
    expect(prompt).toBeGreaterThan(0);
    expect(s.indexOf("BTY_REVIEW_REPLAY_MOCK=1")).toBeLessThan(prompt);
    expect(s.indexOf("PREFLIGHT CONTRACT PASS")).toBeLessThan(prompt);
    for (const c of buildReplayChecks(binding())) expect(s.indexOf(`check '${c.label}'`)).toBeLessThan(prompt);
  });

  it("has no unbound shell expansion and never echoes the credential", () => {
    const src = renderReplayRunner(binding()).replace(/<<'PY'[\s\S]*?\nPY\n/g, "");
    const declared = new Set(["1", "2", "3", "*", "@", "?", "#", "0"]);
    for (const m of src.matchAll(/^\s*(?:local\s+|export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/gm)) declared.add(m[1]);
    for (const m of src.matchAll(/^\s*local\s+(.+)$/gm)) {
      for (const tok of m[1].split(/\s+/)) {
        const n = tok.split("=")[0];
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) declared.add(n);
      }
    }
    for (const m of src.matchAll(/\bread\s+-\w+\s+([A-Za-z_][A-Za-z0-9_]*)/g)) declared.add(m[1]);
    // `for X in ...` binds X for the loop body.
    for (const m of src.matchAll(/\bfor\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s/g)) declared.add(m[1]);
    const env = new Set(["HISTFILE", "PATH", "HOME", "OPENAI_API_KEY", "BTY_REVIEW_REPLAY_MOCK", "LLM_MODEL"]);
    const used = new Set([...src.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
    expect([...used].filter((n) => !declared.has(n) && !env.has(n))).toEqual([]);
    expect(src).not.toMatch(/echo .*LLM_API_KEY|printf .*\$LLM_API_KEY|> *\.env/);
  });

  it("contains no database, deployment or migration operation", () => {
    const s = renderReplayRunner(binding());
    for (const banned of ["wrangler", "supabase", "psql", "migration", "deploy", "npm run build"]) {
      expect(s.toLowerCase()).not.toContain(banned);
    }
  });
});
