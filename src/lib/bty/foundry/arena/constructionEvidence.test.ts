import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview } from "@/domain/foundry/arena-draft/providerDto.fixture";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/* THE ONLY MOCKED BOUNDARY IS THE PROVIDER ADAPTER. Everything below it is the real code path. */
const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { __setGenObserver, generateArenaScenarioDraft, type GenObservation } from "./arenaScenarioGenerationService";
import { writeImmutableArtifact, type ArtifactIdentity } from "./evalArtifact";

/**
 * CONSTRUCTION EVIDENCE (R2.30) — DEBT A / DEBT B.
 *
 * Measured cause: the generator's per-choice `construction` is carried OUTSIDE the draft on purpose,
 * so the sanitized scenario an artifact retains never contained it. Every frozen replay therefore
 * called the reviewer with `constructions: {}` while production sent the real records, and the
 * reviewer is explicitly instructed to CONFIRM or DISPUTE them. All axis evidence to date is
 * labelled CONSTRUCTIONS ABSENT for exactly this reason.
 *
 * THE PROOF THAT COUNTS IS THE DURABLE FILE. An in-memory observation carrying the map proves
 * nothing if the writer drops it, so the preservation assertions below re-read the artifact FROM
 * DISK and compare against the original provider value.
 */

const facts: ModuleSourceFacts = {
  problem: "A teammate proposes cutting a planned design review to hit the deadline",
  observableBehavior: "Raise the concern before the shortcut is taken",
  successEvidence: "The concern is recorded",
  audienceType: "leaders",
  audienceDetail: null,
  learningNeeds: ["decide"],
};
const guided: GuidedAnswers = {
  hardestWhen: { choice: "time_limited" },
  avoidancePressure: { text: "raising it feels like slowing everyone down" },
};

const GOOD: ArenaScenarioDraft = {
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

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bty-construction-"));
  mockCreate.mockReset();
  __setGenObserver(null);
});
afterEach(() => {
  __setGenObserver(null);
  rmSync(dir, { recursive: true, force: true });
});

function route(draft: ArenaScenarioDraft) {
  mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
    isBoundaryReviewRequest(p)
      ? { choices: [{ message: { content: compliantBoundaryReview(p) } }] }
      : isReviewRequest(p)
        ? { choices: [{ message: { content: JSON.stringify(acceptReview(draft, {}, [])) } }] }
        : { choices: [{ message: { content: providerJson(draft, undefined, []) } }] },
  );
}

/** Drive one real generation whose provider output is the fixture DTO. */
async function runOnce(captureContent: boolean) {
  const seen: GenObservation[] = [];
  route(GOOD);
  __setGenObserver((o) => seen.push(o), { captureContent });
  const result = await generateArenaScenarioDraft({ locale: "en", facts, guided });
  __setGenObserver(null);
  return { seen, result };
}

/** Write the observations through the REAL tracked artifact writer, then read them back off disk. */
function roundTrip(seen: GenObservation[]): Array<Record<string, unknown>> {
  const identity: ArtifactIdentity = {
    kind: "stability.construction",
    runId: "construction-test",
    head: "a".repeat(40),
    manifestSha256: "b".repeat(64),
    passId: "p1",
  };
  const written = writeImmutableArtifact(dir, identity, JSON.stringify({ attempts: seen }, null, 2));
  const onDisk = JSON.parse(readFileSync(join(dir, written.path), "utf8")) as { attempts: Array<Record<string, unknown>> };
  return onDisk.attempts;
}

const withConstructions = (attempts: Array<Record<string, unknown>>) =>
  attempts.filter((a) => a.constructions !== undefined);

describe("construction evidence survives to the durable artifact", () => {
  it("captureContent=true: the observation carries the construction map", async () => {
    const { seen } = await runOnce(true);
    const carriers = seen.filter((o) => o.constructions !== undefined);
    expect(carriers.length).toBeGreaterThan(0);
    for (const o of carriers) expect(Object.keys(o.constructions ?? {}).length).toBeGreaterThan(0);
  });

  it("DISK ROUND-TRIP: the retained map equals the provider's, key for key", async () => {
    const { seen } = await runOnce(true);
    const original = seen.find((o) => o.constructions !== undefined)?.constructions ?? {};
    const attempts = roundTrip(seen);
    const retained = withConstructions(attempts)[0]?.constructions as Record<string, unknown>;

    expect(retained).toBeDefined();
    // Deep structural equality against what the provider actually produced — not against memory.
    expect(retained).toEqual(original);
    expect(Object.keys(retained).sort()).toEqual(Object.keys(original).sort());
    for (const id of Object.keys(original)) expect(retained[id]).toEqual(original[id]);
  });

  it("the retained map is keyed by canonical choice id", async () => {
    const { seen } = await runOnce(true);
    const retained = withConstructions(roundTrip(seen))[0]?.constructions as Record<string, unknown>;
    // Canonical transport ids are assigned by position; p1/ft1/fa1 are the documented shapes.
    expect(Object.keys(retained).some((k) => /^(p|ft|fa)\d+$/.test(k) || /^p\d+-(t|a)\d+$/.test(k))).toBe(true);
  });

  it("NEGATIVE CONTROL — captureContent=false hides construction, on disk too", async () => {
    const { seen } = await runOnce(false);
    expect(seen.some((o) => o.constructions !== undefined)).toBe(false);
    const attempts = roundTrip(seen);
    expect(withConstructions(attempts)).toHaveLength(0);
    // The artifact layer must not recover content the capture policy withheld.
    expect(JSON.stringify(attempts)).not.toContain("constructions");
  });

  it("observer UNSET leaves the caller-visible result unchanged", async () => {
    route(GOOD);
    __setGenObserver(null);
    const bare = await generateArenaScenarioDraft({ locale: "en", facts, guided });
    const observed = (await runOnce(true)).result;
    expect(JSON.stringify(observed)).toBe(JSON.stringify(bare));
  });

  it("no construction field leaks into the caller-visible generation result", async () => {
    const { result } = await runOnce(true);
    expect(JSON.stringify(result)).not.toContain("constructions");
  });

  it("an old-shape consumer still reads every enriched event", async () => {
    const { seen } = await runOnce(true);
    // A consumer selecting by semantic kind, never by position or field count.
    const frozen = seen.filter((o) => o.outcome === "review_subject_frozen");
    expect(frozen.length).toBeGreaterThan(0);
    for (const o of seen) expect(typeof o.outcome).toBe("string");
  });
});

/*
  STRICT REPLAY PARITY (R2.30, Debt B).

  The third argument is the whole point. Production calls the reviewer with the generator's
  construction map; the replay called it with `{}`, so every `visibleChoices[].construction` arrived
  as `null` while the prompt instructs the reviewer to CONFIRM or DISPUTE that record. The replay was
  asking a weaker question and its verdict could not be attributed to the production contract.
*/
describe("strict replay parity: the reviewer receives the same constructions", () => {
  const requestBodies: string[] = [];

  const reviewOnlyProvider = () => {
    requestBodies.length = 0;
    mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) => {
      requestBodies.push(p.messages?.map((m) => m.content ?? "").join("\n") ?? "");
      return { choices: [{ message: { content: JSON.stringify(acceptReview(GOOD, {}, [])) }, finish_reason: "stop" }] };
    });
  };

  const subjectFrom = (constructions?: Record<string, unknown>) =>
    ({
      scenario: GOOD,
      scenarioSha256: "0".repeat(64),
      boundaryProvenance: null,
      generationAttemptId: "p1/c01#0",
      caseId: "c01-missed-commitment",
      confirmedBoundaries: [],
      activeBoundaryIds: [],
      language: "en",
      generationModel: "test-model",
      generationSampling: {},
      generationFinishReason: null,
      canonicalValidatorResult: null,
      deterministicGateResult: null,
      reviewContractSha256: "1".repeat(64),
      ...(constructions ? { constructions } : {}),
    }) as never;

  it("a NEW construction-aware artifact replays with a populated map, visible in the request", async () => {
    const { seen } = await runOnce(true);
    const retained = withConstructions(roundTrip(seen))[0]?.constructions as Record<string, unknown>;
    expect(Object.keys(retained).length).toBeGreaterThan(0);

    reviewOnlyProvider();
    const { reviewFrozenSubject } = await import("./reviewFrozenSubject");
    await reviewFrozenSubject(subjectFrom(retained));


    const body = requestBodies.join("\n");
    // The construction records reach the reviewer, exactly as production sends them.
    const anyId = Object.keys(retained)[0];
    const record = retained[anyId] as Record<string, unknown>;
    for (const value of Object.values(record)) {
      if (typeof value === "string" && value.length > 3) expect(body).toContain(value);
    }

    // The comparative claim, which is the one that matters: the strict replay carries construction
    // records the legacy replay cannot, for exactly the choices the generator supplied them for.
    reviewOnlyProvider();
    await reviewFrozenSubject(subjectFrom(undefined));
    const legacyNulls = (requestBodies.join("\n").match(/"construction":null/g) ?? []).length;
    const strictNulls = (body.match(/"construction":null/g) ?? []).length;
    expect(strictNulls).toBeLessThan(legacyNulls);
  });

  it("an OLD construction-less artifact still replays, and is NON-STRICT", async () => {
    reviewOnlyProvider();
    const { reviewFrozenSubject } = await import("./reviewFrozenSubject");
    const r = await reviewFrozenSubject(subjectFrom(undefined));

    // It still runs — historical evidence stays replayable.
    expect(r).toBeDefined();
    // …but every construction is null, which is what CONSTRUCTIONS ABSENT means.
    expect(requestBodies.join("\n")).toContain('"construction":null');
  });

  it("the payload builder is the one production uses, with constructions as its third argument", async () => {
    const { buildBroadReviewRequest } = await import("./reviewRequestProjection");
    const map = { p1: { legitimateValue: "marker-value-p1" } };
    const withMap = buildBroadReviewRequest(GOOD, [], map as never);
    const without = buildBroadReviewRequest(GOOD, []);
    const carried = withMap.visibleChoices.find((c) => c.choiceIndex === 0 && c.phase === "primary");
    expect(carried?.construction).toEqual(map.p1);
    expect(without.visibleChoices.find((c) => c.choiceIndex === 0 && c.phase === "primary")?.construction).toBeNull();
  });
});
