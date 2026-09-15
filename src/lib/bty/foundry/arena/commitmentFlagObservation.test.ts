import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { C18_SCENARIO } from "@/domain/foundry/arena-draft/c18BoundaryFixture";
import { enumerateChoices, type ChoiceRef } from "@/domain/foundry/arena-draft/choiceConstruction";
import { PHASE_CHOICE_DEFECT_CODES } from "@/domain/foundry/arena-draft/choiceReview";
import { validateSemanticReview, type SemanticReview } from "@/domain/foundry/arena-draft/semanticReview";
import { resolveRejection, type Finding } from "@/domain/foundry/arena-draft/gatePrecedence";
import { CONTENT_PROVENANCE } from "@/domain/foundry/arena-draft/contentAuthority";
import { ARTIFACT_SCHEMA_VERSION, buildContractManifest } from "./contractManifest";
import { buildBroadReviewRequest } from "./reviewRequestProjection";
import { REVIEW_SYSTEM_PROMPT, buildGenerationSystemPrompt } from "./arenaScenarioGenerationService";

/**
 * COMMITMENT FLAG OBSERVATION (GOV-ARENA-COMMITMENT-FLAG-OBS + AMENDMENT-1 + AMENDMENT-2).
 *
 * `isActionCommitment` decides runtime consequence — ACTION_REQUIRED and action-contract candidacy
 * versus NEXT_SCENARIO_READY. Run 1 found a choice describing an observable client-facing action
 * carrying `isActionCommitment: false`. The flag reached the reviewer's payload under the raw
 * `branches[].action` / `flatAction` projections, but NOT on `visibleChoices[]` — the prompt-defined
 * per-choice review unit — and no prompt clause named it. The observation was therefore OUT OF the
 * reviewer's defined schema, not out of its payload.
 *
 * These tests pin the observation as TELEMETRY ONLY. Nothing here may grant rejection authority.
 */

const NEW_CODE = "commitment_flag_mismatch";
const ARENA_DRAFT = "src/domain/foundry/arena-draft";
const ARENA_LIB = "src/lib/bty/foundry/arena";
const readSrc = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");

/** The exact 14 members present before this slice. Frozen: preservation is the invariant, not count. */
const ORIGINAL_14 = [
  "no_legitimate_value", "bad_faith_option", "moral_decoy", "dominated_choice",
  "obvious_correct_answer", "unsafe_option", "vague_evasion", "duplicate_tradeoff",
  "vague_reassurance", "false_reassurance", "non_commitment_decoy", "passive_delay",
  "deflection_without_value", "repeated_decoy_across_branches",
] as const;

/** Measured on the parent before the enum moved. N1 asserts the manifest digest LEAVES this value. */
const PARENT_ALL_PHASE_DIGEST = "45015840b7ba7b0e072eaee48055bda8c965eda6c4b02674409d4cf9608e6e8d";

const CHOICES: ChoiceRef[] = enumerateChoices(C18_SCENARIO);
const CTX = { primaryCount: 2, branchCount: 2, constraintIds: [] as string[], choices: CHOICES };

const phaseChoice = (
  c: ChoiceRef,
  over: Partial<SemanticReview["phaseChoices"][number]> = {},
): SemanticReview["phaseChoices"][number] => ({
  phase: c.phase,
  branchIndex: c.branchIndex,
  choiceIndex: c.index,
  legitimateValue: c.index === 0 ? "speed" : "certainty",
  acceptedCost: c.index === 0 ? "less verification" : "more elapsed time",
  competentIntent: "a capable lead could reasonably choose this",
  actionable: true,
  defensible: true,
  dominatedBySibling: false,
  badFaith: false,
  vagueReassurance: false,
  nonCommitmentDecoy: false,
  unsafe: false,
  constructionAgrees: true,
  constructionDispute: "",
  defectCodes: [],
  conciseExplanation: "Concrete action with a real cost.",
  ...over,
});

const branchReview = (i: number) => ({
  index: i,
  selectedPrimarySummary: `primary ${i + 1} already chosen`,
  resultingWorldState: `world after primary ${i + 1}`,
  newConstraintOrPressure: `new pressure ${i + 1}`,
  nextDecisionDimension: i === 0 ? "who owns the escalation" : "how much coverage to commit",
  repeatsPrimaryDecision: false,
  overlapsOtherBranchIndex: -1,
  overlapReason: "",
  branchDistinct: true,
  defectCodes: [] as string[],
  primaryDecisionPreserved: true,
  tradeoffDecisionDimension: i === 0 ? "escalation order" : "staffing coverage",
  actionDecisionDimension: i === 0 ? "who owns the recovery" : "what scope is committed",
  tradeoffAdvancesScenario: true,
  actionAdvancesScenario: true,
  repeatedMeaningPairs: [] as string[],
  progressionValid: true,
  selectedPrimaryEffect: `primary ${i + 1} changed who is available`,
  affectedStakeholders: [i === 0 ? "the director" : "the wider team"],
  resourceOrRelationshipChange: `resource state ${i + 1}`,
  causalLink: `follows from primary ${i + 1}`,
  boundaryState: "unchanged",
  urgencyState: "no time-sensitive harm",
});

function review(over: Partial<SemanticReview> = {}): SemanticReview {
  return {
    phaseChoices: CHOICES.map((c) => phaseChoice(c)),
    crossBranch: {
      resultingWorldOverlapPairs: [],
      nextDecisionAxisOverlapPairs: [],
      stakeholderOverlapPairs: [],
      repeatedActionMeaningPairs: [],
      branchesInterchangeable: false,
      allBranchesSameGenericAxis: false,
      defectCodes: [],
      conciseExplanation: "Each branch follows from its own primary choice.",
    },
    boundaryAssessments: [],
    urgency: {
      urgencyPresent: false,
      urgencySource: "",
      timeSensitiveHarmPossible: false,
      choices: [0, 1].map((index) => ({
        index, introducesDelay: false, delayPurpose: "", safetyBasis: "",
        foreseeableHarm: "", escalationUsed: false, defensible: true, defectCodes: [],
      })),
      overallUrgencyVerdict: "not_applicable",
    },
    noSafeJudgmentSpace: false,
    noSafeReasonCode: "judgment_space_remains",
    boundaryIdsConsidered: [],
    remainingJudgmentDimensions: ["sequencing", "notification timing"],
    violatedBoundaryIds: [],
    explanation: "Judgment remains about sequencing and notification.",
    primaryChoices: [
      { index: 0, legitimateValue: "speed", acceptedCost: "less certainty", defensible: true, defectCodes: [] },
      { index: 1, legitimateValue: "certainty", acceptedCost: "costs time", defensible: true, defectCodes: [] },
    ],
    twoValuesInTension: true,
    tensionValueA: "speed",
    tensionValueB: "certainty",
    branches: [branchReview(0), branchReview(1)],
    overallVerdict: "accept",
    defectCodes: [],
    retryInstruction: "",
    ...over,
  } as SemanticReview;
}

type Validated = ReturnType<typeof validateSemanticReview>;
const telemetry = (r: Validated) =>
  r.ok && "telemetryFindings" in r ? (r.telemetryFindings ?? []) : [];
const terminal = (r: Validated) =>
  r.ok && "terminalFindings" in r ? (r.terminalFindings ?? []) : [];

/** The first branch_action choice whose flag is false — the P1' shape. */
const MISMATCH_AT = CHOICES.find(
  (c) => c.phase === "branch_action" && c.branchIndex === 1 && c.index === 1,
)!;

const withNewCodeAtMismatch = () =>
  CHOICES.map((c) =>
    c === MISMATCH_AT ? phaseChoice(c, { defectCodes: [NEW_CODE] }) : phaseChoice(c),
  );

// ---------------------------------------------------------------------------

describe("A — visibleChoices carries the existing isActionCommitment flag", () => {
  it("every action-phase entry carries the flag of that exact source choice", () => {
    const req = buildBroadReviewRequest(C18_SCENARIO, [], {});
    const actionEntries = req.visibleChoices.filter(
      (v) => v.phase === "flat_action" || v.phase === "branch_action",
    );
    expect(actionEntries.length).toBeGreaterThan(0);
    for (const v of actionEntries) {
      const source =
        v.phase === "flat_action"
          ? C18_SCENARIO.actionDecision.choices[v.choiceIndex]
          : Object.values(C18_SCENARIO.branches!)[v.branchIndex].actionDecision.choices[v.choiceIndex];
      expect(v).toHaveProperty("isActionCommitment");
      expect((v as { isActionCommitment?: boolean }).isActionCommitment).toBe(source.isActionCommitment);
    }
  });

  it("non-action entries do not carry the key at all", () => {
    const req = buildBroadReviewRequest(C18_SCENARIO, [], {});
    for (const v of req.visibleChoices.filter((x) => x.phase !== "flat_action" && x.phase !== "branch_action")) {
      expect(Object.prototype.hasOwnProperty.call(v, "isActionCommitment")).toBe(false);
    }
  });

  it("the raw branches[].action and flatAction projections are unchanged", () => {
    const req = buildBroadReviewRequest(C18_SCENARIO, [], {});
    expect(req.flatAction).toEqual(C18_SCENARIO.actionDecision.choices);
    const b = Object.entries(C18_SCENARIO.branches!);
    for (const [k, branch] of b) {
      expect((req.branches[k] as { action: unknown }).action).toEqual(branch.actionDecision.choices);
    }
  });
});

describe("B/K — the strict response schema admits the observation code", () => {
  it("PHASE_CHOICE_DEFECT_CODES contains commitment_flag_mismatch", () => {
    expect([...PHASE_CHOICE_DEFECT_CODES]).toContain(NEW_CODE);
  });
});

describe("C/L — coordinate-bearing telemetry, never terminal", () => {
  it("produces MODEL_DEFECT_CODE telemetry at the exact phase/branchIndex/choiceIndex", () => {
    expect([...PHASE_CHOICE_DEFECT_CODES]).toContain(NEW_CODE);
    const r = validateSemanticReview(review({ phaseChoices: withNewCodeAtMismatch() }), CTX);
    expect(r.ok).toBe(true);
    const found = telemetry(r).find((f) => f.code === NEW_CODE);
    expect(found).toBeDefined();
    expect(found!.provenance).toBe(CONTENT_PROVENANCE.modelDefectCode);
    expect(found!.gate).toBe("phase_choice_review");
    expect(found!.disposition).toBe("telemetry");
    expect(found!.coordinate).toEqual({
      phase: MISMATCH_AT.phase,
      branchIndex: MISMATCH_AT.branchIndex,
      choiceIndex: MISMATCH_AT.index,
    });
    expect(terminal(r).map((f) => f.code)).not.toContain(NEW_CODE);
  });
});

describe("D/E/P — telemetry cannot decide, reject, or drive retry", () => {
  const telemetryFinding: Finding = {
    code: NEW_CODE, gate: "phase_choice_review", channel: "content", disposition: "telemetry",
    phase: "branch_action", branchIndex: 1, choiceIndex: 1,
  };

  it("D — a telemetry finding cannot become primaryCode", () => {
    expect(resolveRejection([telemetryFinding])).toBeNull();
  });

  it("E — a telemetry finding cannot reject an otherwise clean draft", () => {
    const r = validateSemanticReview(review({ phaseChoices: withNewCodeAtMismatch() }), CTX);
    expect(r.ok && "verdict" in r ? r.verdict : null).toBe("accept");
  });

  it("P — it never enters the terminal reviewFindings path the service builds", () => {
    const r = validateSemanticReview(review({ phaseChoices: withNewCodeAtMismatch() }), CTX);
    // The service builds reviewFindings from terminalFindings ONLY, then resolveRejection on those.
    const reviewFindings: Finding[] = terminal(r).map((f) => ({
      code: f.code, gate: f.gate ?? "semantic_review", channel: "content", disposition: f.disposition,
    }));
    expect(reviewFindings.map((f) => f.code)).not.toContain(NEW_CODE);
    // No resolved rejection => no retryFeedback, no extra attempt, no terminalOutcome change,
    // in correction-disabled and correction-enabled alike (both gate on `resolved`).
    expect(resolveRejection(reviewFindings)).toBeNull();
  });
});

describe("F — retention declares the fields it already carries", () => {
  it("the contentTelemetry item type names coordinate and disposition", () => {
    const src = readSrc(`${ARENA_LIB}/retentionRecord.ts`);
    // The declaration may be one line or a block; take from the field to the end of its Array<{...}>.
    const start = src.indexOf("contentTelemetry?:");
    expect(start, "contentTelemetry declaration not found").toBeGreaterThan(-1);
    const end = src.indexOf("}>;", start);
    const decl = end > -1 ? src.slice(start, end) : src.slice(start, src.indexOf("\n", start));
    for (const field of ["code", "provenance", "coordinate", "disposition"]) {
      expect(decl, `contentTelemetry item type does not declare ${field}`).toContain(field);
    }
  });

  it("RETENTION_SCHEMA_VERSION does not move for an additive optional field", () => {
    const src = readSrc(`${ARENA_LIB}/retentionRecord.ts`);
    expect(src).toContain('export const RETENTION_SCHEMA_VERSION = "arena_experiment_retention_v1"');
  });
});

describe("G/J — agreeing flags stay clean and pre-existing behavior is unchanged", () => {
  it("G — a review whose flags and constructions agree emits no observation", () => {
    const r = validateSemanticReview(review(), CTX);
    expect(telemetry(r).map((f) => f.code)).not.toContain(NEW_CODE);
    expect(terminal(r).map((f) => f.code)).not.toContain(NEW_CODE);
  });

  it("J — an equivalent canned non-mismatch fixture keeps its exact prior defect-code result", () => {
    // Deterministic contract only. This does NOT claim a live model emits identical output.
    const withPriorDefect = CHOICES.map((c) =>
      c === MISMATCH_AT ? phaseChoice(c, { vagueReassurance: true }) : phaseChoice(c),
    );
    const r = validateSemanticReview(review({ phaseChoices: withPriorDefect }), CTX);
    const codes = [...telemetry(r), ...terminal(r)].map((f) => f.code).sort();
    expect(codes).toEqual(["vague_reassurance"]);
    expect(codes).not.toContain(NEW_CODE);
  });
});

describe("H — the tracked prompt and generation guidance encode the contract", () => {
  it("the reviewer prompt defines the observation and its false-only trigger", () => {
    expect(REVIEW_SYSTEM_PROMPT).toContain(NEW_CODE);
    expect(REVIEW_SYSTEM_PROMPT).toContain("isActionCommitment");
  });

  it("the reviewer prompt forbids treating true as a correctness signal", () => {
    const p = REVIEW_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain("not evidence");
    for (const w of ["correct", "preferred", "safer", "more ethical", "more competent", "superior"]) {
      expect(p).toContain(w);
    }
  });

  it("generation guidance keeps the commitment-false option concrete AND not the committed action", () => {
    const g = buildGenerationSystemPrompt("en", []);
    expect(g).toContain("isActionCommitment");
    const low = g.toLowerCase();
    expect(low).toContain("cost-bearing");
    expect(low).toContain("must not itself");
  });

  it("both surfaces use the tracked four-term boundary and do not broaden it", () => {
    // `isActionCommitment` is defined in types.ts as commitment AS OPPOSED TO
    // waiting / preparing / observing / deferring. The contract text must not invent a wider set.
    const guidance = buildGenerationSystemPrompt("en", []);
    const reviewerLine = REVIEW_SYSTEM_PROMPT.split("\n").filter((l) => l.includes(NEW_CODE) || l.includes("isActionCommitment")).join(" ");
    for (const surface of [reviewerLine, guidance]) {
      for (const term of ["waiting", "preparing", "observing", "deferring"]) {
        expect(surface.toLowerCase(), `missing tracked term: ${term}`).toContain(term);
      }
    }
    // The inserted contract text must not broaden the definition.
    const inserted = REVIEW_SYSTEM_PROMPT.split("\n").filter((l) => l.includes("COMMITMENT FLAG CONSISTENCY") || l.includes(NEW_CODE) || l.includes("isActionCommitment=true")).join(" ")
      + " " + guidance.split("\n").filter((l) => l.includes("The flag must MATCH")).join(" ");
    for (const banned of ["consulting", "sequencing", "scoping"]) {
      expect(inserted.toLowerCase(), `broadened the boundary with: ${banned}`).not.toContain(banned);
    }
  });
});

describe("M — the original 14 members are preserved, plus exactly one new member", () => {
  it("every original member is still present and unchanged", () => {
    for (const code of ORIGINAL_14) expect([...PHASE_CHOICE_DEFECT_CODES]).toContain(code);
  });

  it("exactly one member was added, and it is the authorized one", () => {
    const added = [...PHASE_CHOICE_DEFECT_CODES].filter((c) => !ORIGINAL_14.includes(c as never));
    expect(added).toEqual([NEW_CODE]);
  });

  it("no original member was removed", () => {
    expect(PHASE_CHOICE_DEFECT_CODES.length).toBe(ORIGINAL_14.length + 1);
  });
});

describe("N — the contract manifest moves, the artifact schema version does not", () => {
  it("N1 — the all-phase review contract digest leaves its parent value", () => {
    const m = buildContractManifest("0".repeat(40), "probe-model") as unknown as {
      components: Record<string, string>;
    };
    expect(m.components.allPhaseReviewContract).not.toBe(PARENT_ALL_PHASE_DIGEST);
  });

  it("N2 — artifactSchemaVersion is unchanged", () => {
    expect(ARTIFACT_SCHEMA_VERSION).toBe("r2.52.1");
  });
});

describe("O — top-level open defectCodes remains a non-path", () => {
  it("a string present only in top-level defectCodes creates no ContentFinding", () => {
    const r = validateSemanticReview(review({ defectCodes: ["zzz_top_level_only_probe"] }), CTX);
    const all = [...telemetry(r), ...terminal(r)].map((f) => f.code);
    expect(all).not.toContain("zzz_top_level_only_probe");
  });
});

describe("Q — the retry coupling stays latent", () => {
  it("isRetryableCode still has no production control-flow caller", () => {
    const files = [
      `${ARENA_DRAFT}/semanticReview.ts`,
      `${ARENA_LIB}/arenaScenarioGenerationService.ts`,
      `${ARENA_DRAFT}/gatePrecedence.ts`,
      `${ARENA_DRAFT}/contentAuthority.ts`,
      `${ARENA_LIB}/reviewRequestProjection.ts`,
      `${ARENA_LIB}/retentionRecord.ts`,
    ];
    for (const rel of files) {
      const src = readSrc(rel);
      // The declaration itself lives in semanticReview.ts; a CALL is `isRetryableCode(`.
      const calls = src
        .split("\n")
        .filter((l) => l.includes("isRetryableCode(") && !l.includes("export function isRetryableCode("));
      expect(calls, `${rel} gained a production caller of isRetryableCode`).toEqual([]);
    }
  });
});
