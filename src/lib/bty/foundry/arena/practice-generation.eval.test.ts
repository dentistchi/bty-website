import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { isLlmAvailable, getLlmModel } from "@/lib/bty/llm/client";
import { generateArenaScenarioDraft, __setGenObserver, type GenObservation } from "./arenaScenarioGenerationService";
import { validateIncidentSpecific } from "@/domain/foundry/arena-draft/quality";
import { classifyPracticeEligibility } from "@/domain/foundry/arena-draft/safety";
import { EVAL_CORPUS, crossScenarioDiversity } from "./practice-generation.eval";
import { ARTIFACT_DIR, artifactPath, lineageIndex, writeImmutableArtifact, writeLatestPointer } from "./evalArtifact";
import { buildContractManifest, caseDigest, manifestDigest } from "./contractManifest";
import { PRACTICE_SAMPLING } from "./arenaScenarioGenerationService";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/**
 * Live practice-generation evaluation harness (Slice 3.2I-R2). Runs the EXACT production
 * contract. `npm run evaluate:practice-generation` sets RUN_LIVE_EVAL=1 and, when a live
 * model credential is present, generates the full 20-case corpus and writes a labelled artifact
 * under the git-ignored `.eval-artifacts/`. It never persists a draft / publishes / writes
 * Supabase, and NEVER substitutes deterministic output.
 */
const LIVE = process.env.RUN_LIVE_EVAL === "1";
/**
 * Optional case filter (Slice 3.2I-R2.15). `EVAL_CASE_IDS=c01-…,c09-…` runs a fixed SUBSET — used
 * by the 3-case canary so a small, cheap run can prove the corrected output contract before paying
 * for the full corpus. Unset → the complete corpus. A filtered run writes its own artifact so it
 * can never overwrite full-corpus evidence, and every expected count below is derived from the
 * SELECTED cases, never hard-coded.
 */
const ONLY = (process.env.EVAL_CASE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const SELECTED = ONLY.length ? EVAL_CORPUS.filter((c) => ONLY.includes(c.id)) : EVAL_CORPUS;
/**
 * IMMUTABLE artifact naming (R2.20). Every filtered run previously wrote the SAME
 * `practice-generation.canary.json`, so each canary destroyed the evidence of the one before it —
 * four prior artifacts are permanently gone. Each run now writes a unique path first; the
 * convenience `latest` copy is written afterwards and is never the authority.
 */
const RUN_ID = process.env.EVAL_RUN_ID?.trim() || `${process.env.EVAL_SLICE?.trim() || "run"}-${Date.now()}`;
const PASS_ID = process.env.EVAL_PASS_ID?.trim() || "pass1";
const RUN_KIND = process.env.EVAL_KIND?.trim() || (ONLY.length ? "subset" : "full");
const LATEST_ARTIFACT = ONLY.length ? "practice-generation.canary.json" : "practice-generation.latest.json";

/**
 * R2.23 — an artifact is evidence for exactly ONE contract. Its identity carries the source HEAD and
 * the generation-contract manifest digest, so a result can never be attributed to a contract that
 * did not produce it, and a runner bound to a stale contract cannot quietly write over fresh
 * evidence.
 */
function sourceHead(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

describe("practice-generation corpus is well-formed", () => {
  it("covers >=16 cases, >=8 English, >=4 Korean, incl. mixed-safety, ambiguous, and confirmed-boundary cases", () => {
    expect(EVAL_CORPUS.length).toBeGreaterThanOrEqual(16);
    expect(EVAL_CORPUS.filter((c) => c.locale === "en").length).toBeGreaterThanOrEqual(8);
    expect(EVAL_CORPUS.filter((c) => c.locale === "ko").length).toBeGreaterThanOrEqual(4);
    expect(EVAL_CORPUS.some((c) => c.expectClass === "know_only")).toBe(true);
    expect(EVAL_CORPUS.filter((c) => c.expectClass === "mixed_with_non_negotiables").length).toBeGreaterThanOrEqual(3);
    expect(EVAL_CORPUS.some((c) => c.expectClass === "unresolved_safety_boundary")).toBe(true);
    // R4 — confirmed-boundary cases (judgment + judgment_with_constraints).
    expect(EVAL_CORPUS.some((c) => c.input.boundary?.confirmed && c.input.boundary.mode === "judgment")).toBe(true);
    expect(EVAL_CORPUS.some((c) => c.input.boundary?.mode === "judgment_with_constraints")).toBe(true);
  });

  it("classifies each labelled case to its expected eligibility (deterministic, no live model)", () => {
    for (const c of SELECTED) {
      if (!c.expectClass) continue;
      const f = c.input.facts;
      const got = classifyPracticeEligibility({ problem: f.problem, observableBehavior: f.observableBehavior, successEvidence: f.successEvidence, learningNeeds: f.learningNeeds });
      expect(got.kind, `${c.id}`).toBe(c.expectClass);
    }
  });
});

describe("crossScenarioDiversity", () => {
  it("flags an identical scaffold reused across unrelated scenarios", () => {
    const scaffold = (title: string): ArenaScenarioDraft => ({
      title,
      opening: "A teammate pulls you aside and the people who rely on this are already affected today.",
      primary: { choices: [{ id: "primary_1", label: "Raise it openly with the whole team now" }, { id: "primary_2", label: "Check the facts yourself first" }] },
      tradeoff: { escalationText: "e", choices: [{ id: "t1", label: "x" }, { id: "t2", label: "y" }] },
      actionDecision: { prompt: "p", choices: [{ id: "a1", label: "x", isActionCommitment: true }, { id: "a2", label: "y", isActionCommitment: false }] },
    });
    const d = crossScenarioDiversity([scaffold("A"), scaffold("B"), scaffold("C")]);
    expect(d.repeatedPrimaryLabels.length).toBeGreaterThan(0); // same Primary labels reused
    expect(d.repeatedFourGrams.length).toBeGreaterThan(0); // same opening phrasing reused
  });

  it("stays clean for genuinely distinct scenarios", () => {
    const a: ArenaScenarioDraft = { title: "A", opening: "The night nurse reports a medication chart mismatch minutes before rounds begin.", primary: { choices: [{ id: "primary_1", label: "Halt the round and reconcile the chart" }, { id: "primary_2", label: "Verify the single dose in question first" }] }, tradeoff: { escalationText: "e1", choices: [{ id: "t1", label: "x1" }, { id: "t2", label: "y1" }] }, actionDecision: { prompt: "p", choices: [{ id: "a1", label: "x1", isActionCommitment: true }, { id: "a2", label: "y1", isActionCommitment: false }] } };
    const b: ArenaScenarioDraft = { title: "B", opening: "A regional client threatens to cancel after a billing error surfaces on the quarterly invoice.", primary: { choices: [{ id: "primary_1", label: "Call the client and disclose the error" }, { id: "primary_2", label: "Reconcile the invoice before responding" }] }, tradeoff: { escalationText: "e2", choices: [{ id: "t3", label: "x2" }, { id: "t4", label: "y2" }] }, actionDecision: { prompt: "p", choices: [{ id: "a3", label: "x2", isActionCommitment: true }, { id: "a4", label: "y2", isActionCommitment: false }] } };
    const d = crossScenarioDiversity([a, b]);
    expect(d.repeatedFourGrams.length).toBe(0);
    expect(d.repeatedPrimaryLabels.length).toBe(0);
  });
});

describe("no deterministic substitution (production contract)", () => {
  it("returns generation_unavailable — never a deterministic scenario — when no live model is configured", async () => {
    if (isLlmAvailable()) return; // a credential is present; the live run covers this path
    const r = await generateArenaScenarioDraft(EVAL_CORPUS[0].input);
    expect(r).toMatchObject({ ok: false, reason: "generation_unavailable" });
  });
});

describe.runIf(LIVE)("LIVE corpus (RUN_LIVE_EVAL=1)", () => {
  it("generates the selected corpus (full 20 cases, or the EVAL_CASE_IDS subset), validates, and writes a labelled artifact", async () => {
    const model = getLlmModel();
    const results: Array<Record<string, unknown>> = [];
    const drafts: ArenaScenarioDraft[] = [];
    for (const c of SELECTED) {
      // R2.16 — record EVERY provider attempt for this case. The R2.15 artifact carried only the
      // final reason, so the per-attempt stage (JSON validity, truncation, DTO, schema, safety)
      // could not be read back from it; the sub-codes only ever reached stdout.
      const attempts: GenObservation[] = [];
      // R2.19 — capture rejected scenarios / reviewer verdicts / retry feedback for forensics.
      __setGenObserver((o) => attempts.push(o), { captureContent: true });
      const started = Date.now();
      const r = await generateArenaScenarioDraft(c.input);
      const ms = Date.now() - started;
      __setGenObserver(null);
      const trace = attempts.map((a, i) => ({ attempt: i + 1, ...a }));
      if (c.expectDecline) {
        results.push({ id: c.id, dilemma: c.dilemma, role: c.role, locale: c.locale, kind: "LIVE MODEL OUTPUT", ms, attempts: trace, declined: !r.ok, reason: r.ok ? null : r.reason });
        continue;
      }
      if (r.ok) {
        drafts.push(r.value.draft);
        results.push({ id: c.id, dilemma: c.dilemma, role: c.role, locale: c.locale, kind: "LIVE MODEL OUTPUT", ms, attempts: trace, ok: true, incidentSpecific: validateIncidentSpecific(r.value.draft).ok, draft: r.value.draft });
      } else {
        results.push({ id: c.id, dilemma: c.dilemma, role: c.role, locale: c.locale, kind: "LIVE MODEL OUTPUT", ms, attempts: trace, ok: false, reason: r.reason });
      }
    }
    const diversity = crossScenarioDiversity(drafts);
    const dir = join(process.cwd(), ARTIFACT_DIR);
    const head = sourceHead();
    const manifest = buildContractManifest(head, model);
    const manifestSha256 = manifestDigest(manifest);
    const identity = { kind: RUN_KIND, runId: RUN_ID, head, manifestSha256, passId: PASS_ID };
    const payload = JSON.stringify(
      {
        label: "LIVE MODEL OUTPUT",
        artifactSchemaVersion: manifest.artifactSchemaVersion,
        runId: RUN_ID,
        passId: PASS_ID,
        head,
        manifestSha256,
        corpusSha256: manifest.components.corpus,
        selectedCaseSha256: caseDigest(SELECTED.map((c) => c.id)),
        providerSchemaSha256: manifest.components.providerSchema,
        reviewSchemaSha256: manifest.components.reviewSchema,
        generatorPromptSha256: manifest.components.generatorSystemPromptEn,
        reviewPromptSha256: manifest.components.reviewSystemPrompt,
        model,
        sampling: PRACTICE_SAMPLING,
        selectedIds: SELECTED.map((c) => c.id),
        expectedCount: SELECTED.length,
        executedCount: results.length,
        diversity,
        results,
      },
      null,
      2,
    );
    // Immutable FIRST — a run must never be able to destroy the sole copy of a previous one, and a
    // failing run must still leave its complete evidence behind.
    const written = writeImmutableArtifact(dir, identity, payload);
    // Convenience pointer only, written after the authoritative copy is safe. Never the authority.
    writeLatestPointer(dir, payload, LATEST_ARTIFACT);
    console.info(`[eval] artifact ${written.path} sha256=${written.sha256} head=${head} manifest=${manifestSha256}`);
    console.info(`[eval] lineage: ${lineageIndex(dir).length} immutable artifact(s) present`);

    // ---- HARD GATES (Slice 3.2I-R2.14) -------------------------------------
    // The artifact is written FIRST so a failing run still leaves full evidence to inspect.
    // Before this, the only assertion was `results.length`, so a run in which the provider
    // rejected every single call still passed — a total infrastructure failure was reported as
    // a green evaluation. A model failure must never be presented as generation evidence.
    if (ONLY.length) expect(SELECTED.length).toBe(ONLY.length); // a typo in EVAL_CASE_IDS must not silently shrink the run
    expect(results.length).toBe(SELECTED.length); // 1. every selected case actually executed

    // 2. A provider/transport error is infrastructure failure, never product evidence.
    // A strict-schema capability gap is a contract failure, never a quality result.
    const capabilityGaps = results.filter((r) => r.reason === "structured_output_unavailable").map((r) => r.id);
    expect(capabilityGaps).toEqual([]);

    const providerFailures = results.filter((r) => r.reason === "generation_failed").map((r) => r.id);
    expect(providerFailures).toEqual([]);

    // 3. Declines must actually decline (hard-stops are never turned into dilemmas).
    const declined = results.filter((r) => r.declined === true).map((r) => r.id);
    expect(declined.sort()).toEqual(SELECTED.filter((c) => c.expectDecline).map((c) => c.id).sort());

    // 4. The run must contain real generated scenarios, not only refusals.
    const generated = results.filter((r) => r.ok === true);
    expect(generated.length).toBeGreaterThan(0);

    // 5. Any remaining non-generated case must be an explainable product state (awaiting
    //    manager-confirmed boundaries) — never an unexplained failure.
    const unexplained = results
      .filter((r) => r.ok === false && r.reason !== "boundary_confirmation_required")
      .map((r) => `${r.id}: ${r.reason}`);
    expect(unexplained).toEqual([]);

    // 6. Generated output must carry no internal Arena terminology.
    const leaked = generated.filter((r) => /Arena|아레나/.test(JSON.stringify(r.draft))).map((r) => r.id);
    expect(leaked).toEqual([]);
  });
});
