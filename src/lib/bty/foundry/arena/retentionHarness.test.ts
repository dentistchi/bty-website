import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview } from "@/domain/foundry/arena-draft/providerDto.fixture";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/* THE ONLY MOCKED BOUNDARY IS THE PROVIDER ADAPTER. Everything below it is the real code path. */
const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { __setGenObserver, generateArenaScenarioDraft, type GenObservation } from "./arenaScenarioGenerationService";
import { RETENTION_SUBDIR, retentionPath, retentionRecords, writeRetentionRecord, type RetentionIdentity } from "./evalArtifact";
import { createRetentionCollector, RETENTION_SCHEMA_VERSION } from "./retentionRecord";
import { EVAL_CORPUS } from "./practice-generation.eval";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "bty-harness-")); mockCreate.mockReset(); });
afterEach(() => { __setGenObserver(null); rmSync(dir, { recursive: true, force: true }); });

const GOOD: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening: "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: { choices: [{ id: "p1", label: "Stop the line now and tell the client why, accepting the delay" }, { id: "p2", label: "Check the gap yourself first, accepting that the clock keeps running" }] },
  tradeoff: { escalationText: "A second stakeholder asks for a firm date within the hour.", choices: [{ id: "ft1", label: "Give the range you can defend and name what would change it" }, { id: "ft2", label: "Narrow the commitment to the one milestone you control" }] },
  actionDecision: { prompt: "Commit to what?", choices: [{ id: "fa1", label: "Tell the client which part slips", isActionCommitment: true }, { id: "fa2", label: "Confirm the scope before committing a date", isActionCommitment: false }] },
  branches: {
    p1: { resultingWorldState: "You stopped the line and said so openly.", escalationText: "The client asks who is accountable while the team waits.",
      tradeoffChoices: [{ id: "p1t1", label: "Own the call publicly and absorb the criticism" }, { id: "p1t2", label: "Bring your manager in to back the decision, accepting how it looks" }],
      actionDecision: { prompt: "Commit to what?", choices: [{ id: "p1a1", label: "Send one written update naming the slip", isActionCommitment: true }, { id: "p1a2", label: "Hold the update until the check completes", isActionCommitment: false }] } },
    p2: { resultingWorldState: "You verified the gap before saying anything.", escalationText: "The team has already moved on while you were checking.",
      tradeoffChoices: [{ id: "p2t1", label: "Correct the record now and explain the delay" }, { id: "p2t2", label: "Leave the past alone and apply the standard from here" }],
      actionDecision: { prompt: "Commit to what?", choices: [{ id: "p2a1", label: "Publish a short correction to the same channel", isActionCommitment: true }, { id: "p2a2", label: "Brief only the two people still at risk", isActionCommitment: false }] } },
  },
};
/** Both branches share one action set → trips `repeated_action_meaning`, a deterministic gate. */
const GATED: ArenaScenarioDraft = JSON.parse(JSON.stringify(GOOD));
GATED.branches!.p2.actionDecision = JSON.parse(JSON.stringify(GATED.branches!.p1.actionDecision));

const c01 = EVAL_CORPUS.find((c) => c.id === "c01-missed-commitment")!;

type Fake = "success" | "gate_failure" | "malformed" | "timeout";
function fakeProvider(kind: Fake, draft: ArenaScenarioDraft) {
  mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
    if (isBoundaryReviewRequest(p)) return { choices: [{ message: { content: compliantBoundaryReview(p) } }] };
    if (isReviewRequest(p)) return { choices: [{ message: { content: JSON.stringify(acceptReview(draft, {}, [])) } }] };
    if (kind === "malformed") return { choices: [{ message: { content: "not json at all" } }] };
    if (kind === "timeout") throw Object.assign(new Error("aborted"), { name: "AbortError" });
    return { choices: [{ message: { content: providerJson(draft, undefined, []) } }] };
  });
}

/*
  ★ RETENTION IS DRIVEN BY THE REAL OBSERVATION STREAM, INCREMENTALLY.

  This is the retention collector under test: it selects evidence by SEMANTIC KIND — never by
  stream position — and rewrites the run record after every evidence-bearing event, so a process
  killed mid-run still leaves what was already observed.
*/
function runWithRetention(id: RetentionIdentity, _input: unknown) {
  /*
    R2.31 — RESPONSIBILITY INVERSION. This helper used to DEFINE the retention-v1 record shape, which
    made a test the only tracked description of the evidence format while the code that actually
    produced it was untracked and later disappeared. The shape and the fold now live in
    `retentionRecord.ts`; this test verifies that module instead of imitating it.
  */
  const collector = createRetentionCollector(
    { ...id, correctionEnabled: false },
    (r) => writeRetentionRecord(dir, id, JSON.stringify(r, null, 1)),
  );
  __setGenObserver((o: GenObservation) => collector.observe(o), { captureContent: true });
  return { record: collector.record, flush: () => writeRetentionRecord(dir, id, JSON.stringify(collector.record, null, 1)), collector };
}

const read = (id: RetentionIdentity) => JSON.parse(readFileSync(join(dir, RETENTION_SUBDIR, retentionPath(id)), "utf8"));

describe("every run leaves a durable record, whatever its outcome", () => {
  const cases: Array<{ name: string; kind: Fake; draft: ArenaScenarioDraft }> = [
    { name: "successful legacy", kind: "success", draft: GOOD },
    { name: "deterministic gate failure", kind: "gate_failure", draft: GATED },
    { name: "malformed provider response", kind: "malformed", draft: GOOD },
    { name: "provider timeout", kind: "timeout", draft: GOOD },
  ];

  it("L — EXECUTED RUN COUNT == DURABLE RUN ARTIFACT COUNT", async () => {
    let executed = 0;
    for (const [i, c] of cases.entries()) {
      const id: RetentionIdentity = { experimentId: "mixed", fixtureId: c01.id, architecture: "legacy", runNumber: i + 1 };
      fakeProvider(c.kind, c.draft);
      const { record, flush } = runWithRetention(id, c01.input);
      const r = await generateArenaScenarioDraft(c01.input as never);
      __setGenObserver(null);
      record.terminalOutcome = r.ok ? "PASS" : (r as { reason: string }).reason;
      flush();
      executed++;
    }
    expect(retentionRecords(dir)).toHaveLength(executed);
    expect(executed).toBe(cases.length);
  });

  it("H — a gate-rejected run retains the candidate draft it was rejected for", async () => {
    const id: RetentionIdentity = { experimentId: "e", fixtureId: c01.id, architecture: "legacy", runNumber: 1 };
    fakeProvider("gate_failure", GATED);
    const { record, flush } = runWithRetention(id, c01.input);
    const r = await generateArenaScenarioDraft(c01.input as never);
    __setGenObserver(null);
    record.terminalOutcome = r.ok ? "PASS" : (r as { reason: string }).reason;
    flush();
    const saved = read(id);
    expect(saved.terminalOutcome).toBe("generation_rejected");
    expect(saved.gates.length).toBeGreaterThan(0);
    expect(saved.draft.present).toBe(true);                       // the very thing that was lost
    expect(JSON.stringify(saved.draft.parsed)).toContain(GATED.opening);
    expect(saved.stages.some((s: { stageName: string }) => s.stageName === "generation")).toBe(true);
  });

  it("M — a timeout still leaves identity, stage evidence and the timed-out stage", async () => {
    const id: RetentionIdentity = { experimentId: "e", fixtureId: c01.id, architecture: "legacy", runNumber: 2 };
    fakeProvider("timeout", GOOD);
    const { record, flush } = runWithRetention(id, c01.input);
    const r = await generateArenaScenarioDraft(c01.input as never);
    __setGenObserver(null);
    record.terminalOutcome = r.ok ? "PASS" : (r as { reason: string }).reason;
    flush();
    const saved = read(id);
    expect(existsSync(join(dir, RETENTION_SUBDIR, retentionPath(id)))).toBe(true);
    expect(saved.terminalOutcome).toBe("generation_failed");
    const gen = saved.stages.find((s: { stageName: string }) => s.stageName === "generation");
    expect(gen).toBeTruthy();
    expect(gen.stageDurationMs).toBeGreaterThanOrEqual(0);
    expect(saved.draft.present).toBe(false);                      // never existed — recorded as absent
  });

  /* K — the record exists BEFORE any outcome, so a kill mid-run cannot erase the run. */
  it("K — identity is durable before the provider is ever called", async () => {
    const id: RetentionIdentity = { experimentId: "e", fixtureId: c01.id, architecture: "legacy", runNumber: 7 };
    fakeProvider("success", GOOD);
    runWithRetention(id, c01.input);
    __setGenObserver(null);
    const saved = read(id);
    expect(saved.runNumber).toBe(7);
    expect(saved.terminalOutcome).toBeNull();
  });

  it("J — a successful run retains stage timing for generation AND semantic review", async () => {
    const id: RetentionIdentity = { experimentId: "e", fixtureId: c01.id, architecture: "legacy", runNumber: 3 };
    fakeProvider("success", GOOD);
    const { record, flush } = runWithRetention(id, c01.input);
    const r = await generateArenaScenarioDraft(c01.input as never);
    __setGenObserver(null);
    record.terminalOutcome = r.ok ? "PASS" : (r as { reason: string }).reason;
    flush();
    const saved = read(id);
    expect(saved.terminalOutcome).toBe("PASS");
    const names = saved.stages.map((s: { stageName: string }) => s.stageName);
    expect(names).toContain("generation");
    expect(names).toContain("semantic_review");
    for (const s of saved.stages) expect(s.stageDurationMs).toBeGreaterThanOrEqual(0);
  });

  /*
    ★ I — MEASURED LIMIT: REVIEWER EVIDENCE RIDES THE STREAM ONLY WHEN A VERDICT IS REPORTED.

    `ReviewEvidence` (parsed response, overallVerdict, derivedDefects, consistency, latencyMs) is
    attached via `captured({ review })` on the review_malformed / review_rerun /
    reviewer_terminal_failure / review-rejection emissions. A CLEAN ACCEPT emits no review payload,
    so a passing run retains review *timing* but not the reviewer's structured response.

    That is exactly the right way round for this experiment — the open question is why runs FAIL,
    and every failing review path carries its evidence — but it is a real limit and is asserted here
    rather than assumed away.
  */
  it("I — a clean accept retains review timing AND the review that authorized it", async () => {
    /*
      R2.33 — this used to assert `reviewCalls` was EMPTY on a clean accept, which encoded the blind
      spot as though it were a contract: "the structured verdict rides only failure paths". It was
      never a property of the reviewer, only of which path bothered to capture. After Decision B most
      reviewed drafts are accepts, so the un-measurable half became the larger half, and the first
      measured false accept could not be explained from retained evidence at all.
    */
    const id: RetentionIdentity = { experimentId: "e", fixtureId: c01.id, architecture: "legacy", runNumber: 4 };
    fakeProvider("success", GOOD);
    const { record, flush } = runWithRetention(id, c01.input);
    const r = await generateArenaScenarioDraft(c01.input as never);
    __setGenObserver(null);
    record.terminalOutcome = r.ok ? "PASS" : (r as { reason: string }).reason;
    flush();
    const saved = read(id);
    expect(saved.terminalOutcome).toBe("PASS");
    // The reviewer ran and was timed…
    const reviewStages = saved.stages.filter((s: { stageName: string }) => s.stageName === "semantic_review").length;
    expect(reviewStages).toBeGreaterThan(0);
    // …and the review that authorized the accept is retained, one record per actual call.
    expect(saved.reviewCalls).toHaveLength(reviewStages);
    expect(saved.reviewCalls[0].defects).toEqual([]);
    expect(saved.reviewCalls[0].parsed).toBeTruthy();
  });
});
