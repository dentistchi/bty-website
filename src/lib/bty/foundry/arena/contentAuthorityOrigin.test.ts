import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  providerJson,
  acceptReview,
  isReviewRequest,
  isBoundaryReviewRequest,
  compliantBoundaryReview,
} from "@/domain/foundry/arena-draft/providerDto.fixture";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import type { SemanticReview } from "@/domain/foundry/arena-draft/semanticReview";

/* THE ONLY MOCKED BOUNDARY IS THE PROVIDER ADAPTER. Everything below it is the real code path. */
const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { __setGenObserver, generateArenaScenarioDraft, type GenObservation } from "./arenaScenarioGenerationService";
import { RETENTION_SUBDIR, retentionPath, writeRetentionRecord, type RetentionIdentity } from "./evalArtifact";
import { createRetentionCollector } from "./retentionRecord";
import { EVAL_CORPUS } from "./practice-generation.eval";

/*
  13A — THE END-TO-END PROVENANCE-ORIGIN PAIR.

  A classifier unit test can only prove that a hand-built finding routes correctly. It cannot prove
  that the RUNTIME attaches the right provenance at the right place — and provenance reconstructed
  after the fact, or attached in the wrong place, is exactly how a provenance model becomes
  decorative. So both arms of this pair start where the real evidence starts: at a fake PROVIDER
  RESPONSE, through DTO parsing, semantic review, authority classification, the observer, retention
  assembly, and a disk round-trip.

  ONE DEFECT STRING — `no_new_decision_dimension` — travels both arms:

    ARM A  the reviewer's two dimension strings are EQUAL, and code proves it → TERMINAL → rejected
    ARM B  the reviewer WRITES the same string into `branches[].defectCodes` → TELEMETRY → accepted

  If both arms produced the same outcome, the inversion would not have happened, whatever the unit
  tests say.
*/

const mockDir = () => mkdtempSync(join(tmpdir(), "bty-provenance-"));
let dir: string;
beforeEach(() => {
  dir = mockDir();
  mockCreate.mockReset();
});
afterEach(() => {
  __setGenObserver(null);
  rmSync(dir, { recursive: true, force: true });
});

const DRAFT: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: {
    choices: [
      { id: "p1", label: "Stop the line now and tell the client why, accepting the delay" },
      { id: "p2", label: "Check the gap yourself first, accepting that the clock keeps running" },
    ],
  },
  tradeoff: {
    escalationText: "A second stakeholder asks for a firm date within the hour.",
    choices: [
      { id: "ft1", label: "Give the range you can defend and name what would change it" },
      { id: "ft2", label: "Narrow the commitment to the one milestone you control" },
    ],
  },
  actionDecision: {
    prompt: "Commit to what?",
    choices: [
      { id: "fa1", label: "Tell the client which part slips", isActionCommitment: true },
      { id: "fa2", label: "Confirm the scope before committing a date", isActionCommitment: false },
    ],
  },
  branches: {
    p1: {
      resultingWorldState: "You stopped the line and said so openly.",
      escalationText: "The client asks who is accountable while the team waits.",
      tradeoffChoices: [
        { id: "p1t1", label: "Own the call publicly and absorb the criticism" },
        { id: "p1t2", label: "Bring your manager in to back the decision, accepting how it looks" },
      ],
      actionDecision: {
        prompt: "Commit to what?",
        choices: [
          { id: "p1a1", label: "Send one written update naming the slip", isActionCommitment: true },
          { id: "p1a2", label: "Hold the update until the check completes", isActionCommitment: false },
        ],
      },
    },
    p2: {
      resultingWorldState: "You verified the gap before saying anything.",
      escalationText: "The team has already moved on while you were checking.",
      tradeoffChoices: [
        { id: "p2t1", label: "Correct the record now and explain the delay" },
        { id: "p2t2", label: "Leave the past alone and apply the standard from here" },
      ],
      actionDecision: {
        prompt: "Commit to what?",
        choices: [
          { id: "p2a1", label: "Publish a short correction to the same channel", isActionCommitment: true },
          { id: "p2a2", label: "Brief only the two people still at risk", isActionCommitment: false },
        ],
      },
    },
  },
};

const c01 = EVAL_CORPUS.find((c) => c.id === "c01-missed-commitment")!;

/** Serve a real generation, then whatever review body the arm under test needs. */
function serve(review: SemanticReview) {
  mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
    if (isBoundaryReviewRequest(p)) return { choices: [{ message: { content: compliantBoundaryReview(p) } }] };
    if (isReviewRequest(p)) return { choices: [{ message: { content: JSON.stringify(review) } }] };
    return { choices: [{ message: { content: providerJson(DRAFT, undefined, []) } }] };
  });
}

async function runArm(runNumber: number, review: SemanticReview) {
  const id: RetentionIdentity = { experimentId: "provenance", fixtureId: c01.id, architecture: "legacy", runNumber };
  serve(review);
  const collector = createRetentionCollector({ ...id, correctionEnabled: false }, (r) =>
    writeRetentionRecord(dir, id, JSON.stringify(r, null, 1)),
  );
  const observations: GenObservation[] = [];
  __setGenObserver(
    (o: GenObservation) => {
      observations.push(o);
      collector.observe(o);
    },
    { captureContent: true },
  );
  const result = await generateArenaScenarioDraft(c01.input as never);
  __setGenObserver(null);
  collector.record.terminalOutcome = result.ok ? "PASS" : (result as { reason: string }).reason;
  writeRetentionRecord(dir, id, JSON.stringify(collector.record, null, 1));
  // DISK is the durability authority — never the in-memory collector.
  const saved = JSON.parse(readFileSync(join(dir, RETENTION_SUBDIR, retentionPath(id)), "utf8"));
  return { result, saved, observations };
}

/** ARM A — the two dimensions are byte-equal, so CODE establishes the repetition. */
function provenIdentityReview(): SemanticReview {
  const r = acceptReview(DRAFT, {}, []);
  r.branches = r.branches.map((b) => ({
    ...b,
    tradeoffDecisionDimension: "who owns the escalation",
    actionDecisionDimension: "who owns the escalation",
  }));
  return r;
}

/** ARM B — the dimensions genuinely differ; the MODEL simply asserts the same defect string. */
function modelAssertedReview(): SemanticReview {
  const r = acceptReview(DRAFT, {}, []);
  r.branches = r.branches.map((b, i) => ({
    ...b,
    tradeoffDecisionDimension: i === 0 ? "who owns the escalation" : "which client to brief first",
    actionDecisionDimension: i === 0 ? "what to commit in writing" : "when to send the correction",
    defectCodes: ["no_new_decision_dimension"],
  }));
  r.overallVerdict = "reject";
  return r;
}

describe("13A. the same defect string, two origins, two outcomes", () => {
  it("ARM A — PROVEN exact identity REJECTS the draft", async () => {
    const { result, saved } = await runArm(1, provenIdentityReview());
    expect(result.ok).toBe(false);
    expect(saved.defectCodes).toContain("no_new_decision_dimension");
    expect(saved.primaryCode).toBe("no_new_decision_dimension");
  });

  it("ARM B — the MODEL asserting the identical string does NOT reject", async () => {
    const { result } = await runArm(2, modelAssertedReview());
    expect(result.ok).toBe(true);
  });

  it("ARM B — and the claim survives on disk, carrying the provenance that denied it", async () => {
    const { saved } = await runArm(3, modelAssertedReview());
    const telemetry = (saved.contentTelemetry ?? []) as Array<{ code: string; provenance: string }>;
    const denied = telemetry.find((f) => f.code === "no_new_decision_dimension");
    expect(denied).toBeDefined();
    expect(denied!.provenance).toBe("MODEL_DEFECT_CODE");
    // Downgraded is not deleted, and it is also not promoted: it never reached the verdict fields.
    expect(saved.defectCodes).not.toContain("no_new_decision_dimension");
    expect(saved.primaryCode).not.toBe("no_new_decision_dimension");
  });

  it("ARM B — telemetry consumed no retry budget: exactly one generation call was made", async () => {
    mockCreate.mockClear();
    const { result } = await runArm(4, modelAssertedReview());
    expect(result.ok).toBe(true);
    const generationCalls = mockCreate.mock.calls.filter(
      (c) => !isReviewRequest(c[0] as never) && !isBoundaryReviewRequest(c[0] as never),
    );
    expect(generationCalls).toHaveLength(1);
  });

  it("the reviewer's own advisory verdict is observed and visibly DISAGREES with the outcome", async () => {
    /*
      ARM B's reviewer voted reject. The product accepted. That disagreement is the measurement this
      whole arc exists to keep visible, so it must be OBSERVABLE rather than smoothed away.

      It is asserted on the observation stream, which is where the generator actually reports it. The
      record's `advisory` field is filled by the RUNNER's `finalize`, not by the stream — so reading
      it here would test this helper's plumbing rather than the product's behaviour.
    */
    const { observations } = await runArm(5, modelAssertedReview());
    const accepted = observations.find((o) => o.outcome === "generated_valid");
    expect(accepted?.advisoryVerdict).toBe("reject");
    expect(accepted?.advisoryConsistency).toBe("disagrees");
  });
});
