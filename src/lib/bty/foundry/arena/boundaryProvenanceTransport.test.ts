import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArenaScenarioDraft, GuidedAnswers } from "@/domain/foundry/arena-draft/types";
import type { ModuleSourceFacts } from "./arenaScenarioSource";
import type { SemanticReview } from "@/domain/foundry/arena-draft/semanticReview";

/*
  BOUNDARY PROVENANCE TRANSPORT (Slice 3.2I-R5B1A.1-R2.35).

  R2.34 made content authority provenance-aware, then the service layer quietly undid part of it: it
  rebuilt findings from the reviewer DTO, merged model-authored `defectCodes` into the same string
  array as the boolean derivations, and recovered "provenance" by testing the resulting STRING.

  SIX of the eight provisional boundary strings are also in `BOUNDARY_DEFECT_CODES`, so the model can
  author the exact word a derivation produces. The measured consequence: a model-written
  `confirmed_boundary_absent` took gate level 3 and stole `primaryCode` from a genuinely PROVEN
  level-6 finding — while the same instance also appeared in telemetry, which is itself proof the two
  layers disagreed about one finding.

  Every case here pins the repaired invariant:

    AUTHORITY IS TRANSPORTED FROM THE OBSERVATION, NEVER RECONSTRUCTED FROM THE CODE STRING.
*/

const mockCreate = vi.fn();
vi.mock("@/lib/bty/llm/client", () => ({
  isLlmAvailable: () => true,
  getLlmModel: () => "test-model",
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
}));

import { generateArenaScenarioDraft, __setGenObserver, type GenObservation } from "./arenaScenarioGenerationService";
import { providerJson, acceptReview, isReviewRequest, isBoundaryReviewRequest, compliantBoundaryReview } from "@/domain/foundry/arena-draft/providerDto.fixture";
import { PROVISIONAL_BOUNDARY_AUTHORITY } from "@/domain/foundry/arena-draft/contentAuthority";
import { BOUNDARY_DEFECT_CODES } from "@/domain/foundry/arena-draft/boundaryGrounding";
import { SEMANTIC_REVIEW_JSON_SCHEMA } from "@/domain/foundry/arena-draft/semanticReview";
import { RETENTION_SUBDIR, retentionPath, writeRetentionRecord, type RetentionIdentity } from "./evalArtifact";
import { createRetentionCollector } from "./retentionRecord";

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
const CONSTRAINT = { id: "c1", statement: "Verify two identifiers before treatment", provenance: "manager_entered" as const };
const input = {
  locale: "en" as const,
  facts,
  guided,
  boundary: { mode: "judgment_with_constraints" as const, confirmed: true, constraints: [CONSTRAINT] },
};

const draft: ArenaScenarioDraft = {
  title: "Raising a risk under a deadline",
  opening:
    "A teammate quietly flags a safety gap to you with the client's deadline only hours away. Two identifiers must be verified before treatment begins, without exception. Raising it now stops the line while the customer waits; staying on schedule keeps the promise but carries the risk.",
  primary: {
    choices: [
      { id: "primary_1", label: "Verify both identifiers yourself now and hold the queue while you do it" },
      { id: "primary_2", label: "Assign a colleague to verify both identifiers so the queue keeps moving" },
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
    primary_1: {
      resultingWorldState: "You held the queue and verified both identifiers yourself.",
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
    primary_2: {
      resultingWorldState: "A colleague verified both identifiers while you kept the queue moving.",
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

const GROUNDING = [{
  boundaryId: "c1",
  boundaryStatement: "Verify two identifiers before treatment",
  scenarioPresence: "The opening establishes that two identifiers are verified before treatment begins.",
  operationalEffect: "No option may begin treatment before both identifiers are verified; the decision is who verifies and what the pause costs.",
  affectedDecisionStages: ["opening", "primary", "branch_tradeoff"] as const,
  prohibitedAlternativeExcluded: "Beginning treatment and verifying afterwards is never offered.",
  remainingJudgmentDimensions: ["sequencing", "staffing"],
}];

/** Generation output whose per-choice constraint assessments satisfy the confirmed rule. */
const generation = () => {
  const wire = JSON.parse(providerJson(draft, undefined, [...GROUNDING] as never));
  const a = [{ constraintId: "c1", status: "satisfied", rationale: "complies" }];
  for (const c of wire.primaryChoices) c.constraintAssessments = a;
  for (const c of wire.flatTradeoffChoices) c.constraintAssessments = a;
  for (const c of wire.flatActionDecision.choices) c.constraintAssessments = a;
  for (const b of wire.branches) {
    for (const c of b.tradeoffChoices) c.constraintAssessments = a;
    for (const c of b.actionDecision.choices) c.constraintAssessments = a;
  }
  return JSON.stringify(wire);
};

const base = () => acceptReview(draft, {}, ["c1"]);

/** An independent, genuinely PROVEN rejection: two branches naming a byte-identical next decision. */
const withProvenCollapse = (r: SemanticReview): SemanticReview => ({
  ...r,
  branches: r.branches.map((b) => ({ ...b, nextDecisionDimension: "who owns the escalation" })),
});

let observed: GenObservation[] = [];
let dir: string;
beforeEach(() => {
  mockCreate.mockReset();
  observed = [];
  dir = mkdtempSync(join(tmpdir(), "bty-prov-"));
  __setGenObserver((o) => observed.push(o), { captureContent: true });
});
afterEach(() => {
  __setGenObserver(null);
  rmSync(dir, { recursive: true, force: true });
});

const route = (review: SemanticReview) =>
  mockCreate.mockImplementation(async (p: { messages?: Array<{ content?: string }> }) =>
    isBoundaryReviewRequest(p)
      ? { choices: [{ message: { content: compliantBoundaryReview(p) } }] }
      : isReviewRequest(p)
        ? { choices: [{ message: { content: JSON.stringify(review) } }] }
        : { choices: [{ message: { content: generation() } }] },
  );

const run = async (review: SemanticReview) => {
  route(review);
  const result = await generateArenaScenarioDraft(input as never);
  const gate = observed.find((o) => String(o.outcome).startsWith("gate_level_"));
  const accept = observed.find((o) => o.outcome === "generated_valid" || o.outcome === "review_content_telemetry_only");
  const telemetry = ((gate ?? accept)?.contentTelemetry ?? []).map((f) => `${f.code}|${f.provenance}|${f.disposition}`);
  return { result, gate, accept, telemetry, defectCodes: gate?.defectCodes ?? [], primaryCode: gate?.code };
};

/** CASE A shape — the reviewer's own compliance observation produces the derivation. */
const sourceDerived: Record<string, (r: SemanticReview) => SemanticReview> = {
  confirmed_boundary_absent: (r) => patch(r, { presentInScenario: false }),
  boundary_not_operationalized: (r) => patch(r, { operationalized: false }),
  vacuous_boundary_compliance: (r) => patch(r, { affectedStages: [] }),
  choice_bypasses_boundary: (r) => patch(r, { allPrimaryChoicesComply: false }),
  action_reopens_boundary: (r) => patch(r, { allActionChoicesComply: false }),
  branch_drops_boundary: (r) => patch(r, { allBranchesPreserve: false }),
  boundary_treated_as_optional: (r) => patch(r, { prohibitedAlternativeExcluded: false }),
};
function patch(r: SemanticReview, over: Partial<SemanticReview["boundaryAssessments"][number]>): SemanticReview {
  return { ...r, boundaryAssessments: r.boundaryAssessments.map((a) => ({ ...a, ...over })) };
}
/** CASE B shape — every compliance observation stays TRUE; the model merely writes the string. */
const modelWritten = (r: SemanticReview, code: string): SemanticReview => patch(r, { defectCodes: [code] });

// ---------------------------------------------------------------------------
// STEP 6 — the actual overlap, measured from current code
// ---------------------------------------------------------------------------
const OVERLAP = PROVISIONAL_BOUNDARY_AUTHORITY.filter((c) => (BOUNDARY_DEFECT_CODES as readonly string[]).includes(c));
const NOT_WRITABLE = PROVISIONAL_BOUNDARY_AUTHORITY.filter((c) => !(BOUNDARY_DEFECT_CODES as readonly string[]).includes(c));

describe("6. the model-writable overlap is measured, not assumed", () => {
  it("six provisional strings are ALSO directly authorable by the model", () => {
    expect([...OVERLAP].sort()).toEqual([
      "action_reopens_boundary",
      "boundary_not_operationalized",
      "branch_drops_boundary",
      "choice_bypasses_boundary",
      "confirmed_boundary_absent",
      "vacuous_boundary_compliance",
    ]);
  });

  it("two provisional strings have no direct model ingress through that enum", () => {
    expect([...NOT_WRITABLE].sort()).toEqual(["boundary_treated_as_optional", "boundary_violation"]);
  });
});

// ---------------------------------------------------------------------------
// STEP 7 — six same-string pairs, one per overlapping code
// ---------------------------------------------------------------------------
describe("7. same boundary string, two origins, two authorities", () => {
  it.each(OVERLAP)("%s — CASE A source-derived is TERMINAL", async (code) => {
    const { result, defectCodes, telemetry } = await run(sourceDerived[code](base()));
    expect(result.ok).toBe(false);
    expect(defectCodes).toContain(code);
    // …and it is NOT also sitting in telemetry: one origin, one disposition.
    expect(telemetry.filter((t) => t.startsWith(`${code}|`))).toEqual([]);
  });

  it.each(OVERLAP)("%s — CASE B model-written is TELEMETRY and rejects nothing", async (code) => {
    const { result, telemetry } = await run(modelWritten(base(), code));
    expect(result.ok).toBe(true);
    expect(telemetry).toContain(`${code}|MODEL_DEFECT_CODE|telemetry`);
  });
});

// ---------------------------------------------------------------------------
// STEP 8 — the two non-writable paths, proven at the schema
// ---------------------------------------------------------------------------
describe("8. the non-writable boundary paths stay non-writable", () => {
  it.each(NOT_WRITABLE)("%s cannot be authored through boundaryAssessments[].defectCodes", (code) => {
    // Read the SHIPPED schema, not a copy of it — the enum is the ingress surface itself.
    const schema = SEMANTIC_REVIEW_JSON_SCHEMA as unknown as {
      properties: { boundaryAssessments: { items: { properties: { defectCodes: { items: { enum: readonly string[] } } } } } };
    };
    expect(schema.properties.boundaryAssessments.items.properties.defectCodes.items.enum).not.toContain(code);
  });

  it("…and their source-derived form still holds terminal authority", async () => {
    const { result, defectCodes } = await run(sourceDerived.boundary_treated_as_optional(base()));
    expect(result.ok).toBe(false);
    expect(defectCodes).toContain("boundary_treated_as_optional");
  });
});

// ---------------------------------------------------------------------------
// STEP 9 / 10 / 11 — the original leak probe, and what it proves once flipped
// ---------------------------------------------------------------------------
describe("9-11. the measured leak, closed", () => {
  /** Every boundary observation compliant; the model writes the string; a PROVEN finding rejects. */
  const leak = () => withProvenCollapse(modelWritten(base(), "confirmed_boundary_absent"));

  it("9. the model-written boundary code no longer steals primaryCode", async () => {
    const { result, primaryCode, defectCodes, telemetry } = await run(leak());
    expect(result.ok).toBe(false);
    // Measured at 54299abe: gate_level_3 / confirmed_boundary_absent. Both are now impossible.
    expect(primaryCode).toBe("cross_branch_axis_collapse");
    expect(defectCodes).toContain("cross_branch_axis_collapse");
    expect(defectCodes).not.toContain("confirmed_boundary_absent");
    expect(telemetry).toContain("confirmed_boundary_absent|MODEL_DEFECT_CODE|telemetry");
  });

  it("10. ONE model instance never emerges as both terminal and telemetry", async () => {
    const { defectCodes, telemetry } = await run(leak());
    const inTerminal = defectCodes.includes("confirmed_boundary_absent");
    const inTelemetry = telemetry.some((t) => t.startsWith("confirmed_boundary_absent|"));
    expect(inTerminal && inTelemetry).toBe(false);
    expect(inTelemetry).toBe(true);
  });

  it("10b. …but TWO genuinely different origins of one string may legitimately coexist", async () => {
    // presentInScenario=false derives it, AND the model also writes it. Two findings, two records.
    const both = withProvenCollapse(patch(base(), { presentInScenario: false, defectCodes: ["confirmed_boundary_absent"] }));
    const { defectCodes, telemetry } = await run(both);
    expect(defectCodes).toContain("confirmed_boundary_absent");
    expect(telemetry).toContain("confirmed_boundary_absent|MODEL_DEFECT_CODE|telemetry");
  });

  it("11. disposition outranks raw code precedence", async () => {
    // The telemetry code ranks at level 3; the terminal one at level 6. The lower number would win
    // on precedence alone — and must not, because it has no authority to bring to the contest.
    const { gate } = await run(leak());
    expect(gate?.outcome).toBe("gate_level_6");
    expect(gate?.level).toBe(6);
  });

  it("12. telemetry never reaches the correction packet or spends a retry", async () => {
    const { gate } = await run(leak());
    const feedback = observed.find((o) => typeof o.retryFeedback === "string")?.retryFeedback ?? "";
    expect(feedback).not.toContain("confirmed_boundary_absent");
    expect(JSON.stringify(gate?.findings ?? [])).not.toContain("confirmed_boundary_absent");
    const generations = mockCreate.mock.calls.filter(
      (c) => !isReviewRequest(c[0] as never) && !isBoundaryReviewRequest(c[0] as never),
    );
    // A telemetry-only finding buys no extra generation; the PROVEN one drives the single retry.
    expect(generations.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// STEP 13 — durable provenance, read back from disk
// ---------------------------------------------------------------------------
describe("13. provenance survives the disk round-trip", () => {
  const persist = async (review: SemanticReview, runNumber: number) => {
    const id: RetentionIdentity = { experimentId: "provenance", fixtureId: "c18-boundary", architecture: "legacy", runNumber };
    route(review);
    const collector = createRetentionCollector({ ...id, correctionEnabled: false }, (r) =>
      writeRetentionRecord(dir, id, JSON.stringify(r, null, 1)),
    );
    __setGenObserver((o: GenObservation) => {
      observed.push(o);
      collector.observe(o);
    }, { captureContent: true });
    const result = await generateArenaScenarioDraft(input as never);
    __setGenObserver(null);
    collector.record.terminalOutcome = result.ok ? "PASS" : (result as { reason: string }).reason;
    writeRetentionRecord(dir, id, JSON.stringify(collector.record, null, 1));
    return JSON.parse(readFileSync(join(dir, RETENTION_SUBDIR, retentionPath(id)), "utf8"));
  };

  it("a model-written boundary code is retained as MODEL_DEFECT_CODE telemetry", async () => {
    const saved = await persist(withProvenCollapse(modelWritten(base(), "confirmed_boundary_absent")), 1);
    const telemetry = (saved.contentTelemetry ?? []) as Array<{ code: string; provenance: string; disposition?: string }>;
    const hit = telemetry.find((f) => f.code === "confirmed_boundary_absent");
    expect(hit?.provenance).toBe("MODEL_DEFECT_CODE");
    expect(hit?.disposition).toBe("telemetry");
    expect(saved.defectCodes).not.toContain("confirmed_boundary_absent");
    expect(saved.primaryCode).toBe("cross_branch_axis_collapse");
  });

  it("a source-derived boundary finding is retained with its terminal authority", async () => {
    const saved = await persist(sourceDerived.confirmed_boundary_absent(base()), 2);
    expect(saved.defectCodes).toContain("confirmed_boundary_absent");
    expect(saved.primaryCode).toBe("confirmed_boundary_absent");
  });
});
