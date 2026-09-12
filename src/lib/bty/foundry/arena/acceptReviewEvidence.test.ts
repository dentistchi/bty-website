import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview } from "@/domain/foundry/arena-draft/providerDto.fixture";
import { RETENTION_SUBDIR, retentionPath, type RetentionIdentity } from "./evalArtifact";
import { parseRetentionRecord, applyObservation, createRetentionRecord, deriveParityGrade } from "./retentionRecord";
import { runOne, startProviderFake, type RunnerConfig } from "../../../../../scripts/practice-full-retention";
import type { GenObservation } from "./arenaScenarioGenerationService";

/**
 * CLEAN-ACCEPT REVIEW EVIDENCE (R2.33).
 *
 * THE BLIND SPOT THIS CLOSES. Every clean accept retained `reviewCalls: 0` — not because no provider
 * review happened, but because only the REJECT path ever captured one. Before Decision B that barely
 * mattered: the reviewer mostly rejected, so the measurable half was the interesting half. After it,
 * 12 of 18 reviewed drafts in the strict-parity run were clean accepts, and the first measured false
 * accept — a Plan dimension question offered as a learner choice, accepted — could not be explained
 * from retained evidence at all.
 *
 * The ACCEPT and REJECT paths now emit the SAME review payload shape. An accept simply has no
 * defects and no retry instruction, so those fields are empty by nature rather than by a second
 * schema invented for accepts.
 */

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bty-accept-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_API_KEY;
});

const GOOD = {
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
} as never;

const config = (over: Partial<RunnerConfig> = {}): RunnerConfig => ({
  experimentId: "accept-evidence",
  fixtures: ["c01-missed-commitment"],
  architectures: ["legacy"],
  runs: 1,
  correction: "disabled",
  artifactDir: dir,
  providerFake: true,
  ...over,
});

const idOf = (runNumber = 1): RetentionIdentity => ({
  experimentId: "accept-evidence",
  fixtureId: "c01-missed-commitment",
  architecture: "legacy",
  runNumber,
});

const fromDisk = (id: RetentionIdentity) =>
  JSON.parse(readFileSync(join(dir, RETENTION_SUBDIR, retentionPath(id)), "utf8")) as Record<string, unknown>;

/**
 * The provider fake counts its OWN semantic-review calls, so assertions compare retained evidence
 * against a MEASURED call count rather than against a hard-coded number.
 */
async function fakeProvider(reviewBody: () => string) {
  const counts = { review: 0, generation: 0 };
  const fake = await startProviderFake(() => ({
    plan: "success",
    respond: (body: string) => {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const wrap = (content: string) => JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] });
      if (isBoundaryReviewRequest(parsed as never)) return wrap(compliantBoundaryReview(parsed as never));
      if (isReviewRequest(parsed as never)) {
        counts.review++;
        return wrap(reviewBody());
      }
      counts.generation++;
      return wrap(providerJson(GOOD, undefined, []));
    },
  }));
  process.env.LLM_BASE_URL = fake.url;
  process.env.LLM_API_KEY = "accept-evidence";
  return { fake, counts };
}

const cleanAccept = () => JSON.stringify(acceptReview(GOOD));

describe("clean accept retains the review that authorized it", () => {
  it("retained reviewCalls equals the MEASURED provider review-call count", async () => {
    const { fake, counts } = await fakeProvider(cleanAccept);
    let outcome: string | null = null;
    try {
      outcome = (await runOne(config(), idOf())).terminalOutcome;
    } finally {
      await fake.close();
    }

    const rec = fromDisk(idOf());
    const calls = (rec.reviewCalls ?? []) as Array<Record<string, unknown>>;

    expect(outcome).toBe("generated");
    // THE CONTRACT: equality with what actually happened, never a fixed literal.
    expect(calls.length).toBe(counts.review);
    // …and for THIS fake, that measured count is one.
    expect(counts.review).toBe(1);
  }, 30_000);

  it("the retained accept payload carries the reviewer's structured details", async () => {
    const { fake } = await fakeProvider(cleanAccept);
    try {
      await runOne(config(), idOf());
    } finally {
      await fake.close();
    }
    const call = ((fromDisk(idOf()).reviewCalls ?? []) as Array<Record<string, unknown>>)[0];
    expect(call).toBeDefined();
    // Same contract as a reject: an accept simply has nothing to put in these two.
    expect(call.defects).toEqual([]);
    expect(call.instruction).toBe("");
    // The half that was missing entirely before R2.33.
    const parsed = call.parsed as Record<string, unknown>;
    expect(parsed).toBeTruthy();
    expect(parsed.branches).toBeDefined();
    expect(parsed.primaryChoices).toBeDefined();
    expect(parsed.overallVerdict).toBe("accept");
  }, 30_000);

  it("captureContent=false withholds the accept payload, proven from disk", async () => {
    const { fake } = await fakeProvider(cleanAccept);
    const seen: GenObservation[] = [];
    try {
      // runOne installs captureContent:true; this exercises the policy directly on the same shape.
      const { __setGenObserver, generateArenaScenarioDraft } = await import("./arenaScenarioGenerationService");
      const { EVAL_CORPUS } = await import("./practice-generation.eval");
      __setGenObserver((o) => seen.push(o), { captureContent: false });
      await generateArenaScenarioDraft(EVAL_CORPUS[0].input, null, { architecture: "legacy", correction: "disabled" });
      __setGenObserver(null);
    } finally {
      await fake.close();
    }
    const record = createRetentionRecord({ ...idOf(2), correctionEnabled: false });
    for (const o of seen) applyObservation(record, o);
    // Nothing content-bearing survived the policy, so nothing reaches a durable record either.
    expect(JSON.stringify(record.reviewCalls)).not.toContain("overallVerdict");
  }, 30_000);

  it("observer unset leaves the caller-visible result unchanged", async () => {
    const { fake } = await fakeProvider(cleanAccept);
    try {
      const { __setGenObserver, generateArenaScenarioDraft } = await import("./arenaScenarioGenerationService");
      const { EVAL_CORPUS } = await import("./practice-generation.eval");
      __setGenObserver(null);
      const bare = await generateArenaScenarioDraft(EVAL_CORPUS[0].input, null, { architecture: "legacy", correction: "disabled" });
      __setGenObserver(() => {}, { captureContent: true });
      const observed = await generateArenaScenarioDraft(EVAL_CORPUS[0].input, null, { architecture: "legacy", correction: "disabled" });
      __setGenObserver(null);
      expect(JSON.stringify(observed)).toBe(JSON.stringify(bare));
    } finally {
      await fake.close();
    }
  }, 30_000);
});

describe("reject evidence is unchanged by the accept capture", () => {
  it("a rejected review still retains its defects and instruction", async () => {
    // One detail flipped, so the reviewer's OWN contract derives a rejection. The verdict still
    // comes from the details exactly where it did before; nothing here asserts a verdict directly.
    const reject = () => JSON.stringify(acceptReview(GOOD, { twoValuesInTension: false }));
    const { fake, counts } = await fakeProvider(reject);
    let outcome: string | null = null;
    try {
      outcome = (await runOne(config(), idOf(3))).terminalOutcome;
    } finally {
      await fake.close();
    }
    const rec = fromDisk(idOf(3));
    const calls = (rec.reviewCalls ?? []) as Array<Record<string, unknown>>;
    expect(outcome).toBe("generation_rejected");
    expect(calls.length).toBe(counts.review);
    expect(Array.isArray(calls[0]?.defects)).toBe(true);
    expect(typeof calls[0]?.instruction).toBe("string");
  }, 30_000);
});

describe("assembly is by semantic kind, never by position", () => {
  it("unrelated observations before and between review events do not disturb assembly", () => {
    const record = createRetentionRecord({ ...idOf(4), correctionEnabled: false });
    const noise: GenObservation[] = [
      { outcome: "stage_finished", stageName: "generation", stageDurationMs: 5 },
      { outcome: "boundary_review_not_applicable" },
    ];
    const reviewA: GenObservation = { outcome: "gate_level_6", gate: "semantic_review", level: 6, review: { defects: ["x"], instruction: "fix", parsed: { overallVerdict: "reject" } } };
    const reviewB: GenObservation = { outcome: "generated_valid", review: { defects: [], instruction: "", parsed: { overallVerdict: "accept" } } };
    for (const o of [noise[0], reviewA, noise[1], reviewB]) applyObservation(record, o);

    expect(record.reviewCalls).toHaveLength(2);
    expect((record.reviewCalls[0] as Record<string, unknown>).defects).toEqual(["x"]);
    expect(((record.reviewCalls[1] as Record<string, unknown>).parsed as Record<string, unknown>).overallVerdict).toBe("accept");
  });

  it("accept capture does not move parityGrade — construction evidence still decides", () => {
    const withReview = createRetentionRecord({ ...idOf(5), correctionEnabled: false });
    applyObservation(withReview, { outcome: "generated_valid", review: { defects: [], instruction: "", parsed: {} } });
    expect(deriveParityGrade(withReview)).toBe("non-strict");

    applyObservation(withReview, { outcome: "review_subject_frozen", constructions: { p1: { legitimateValue: "v" } } });
    expect(deriveParityGrade(withReview)).toBe("strict");
  });
});

describe("historical compatibility", () => {
  it("a record whose clean accept retained no review payload still parses", () => {
    const parsed = parseRetentionRecord({
      schemaVersion: "arena_experiment_retention_v1",
      experimentId: "fullret36",
      fixtureId: "c01-missed-commitment",
      architecture: "legacy",
      runNumber: 3,
      terminalOutcome: "generated",
      reviewCalls: [],
    });
    expect(parsed.ok).toBe(true);
    // `reviewCalls: []` on an old accept means the payload was never retained — NOT that no
    // provider review happened. Nothing here may reinterpret it as evidence of absence.
    if (parsed.ok) expect(parsed.value.reviewCalls).toEqual([]);
  });
});
