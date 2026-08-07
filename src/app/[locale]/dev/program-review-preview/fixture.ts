import {
  deriveEvidenceCeiling,
  deriveInstructionalContent,
  outcomeClaimIndex,
  type ProgramContracts,
  type ProgramProposal,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import type { JourneyElementKind } from "@/domain/foundry/module/journey";

/**
 * THE PHYSICAL PREVIEW FIXTURE — one authentic proposal, replayed (Slice 3.2L-R8.1).
 *
 * WHY THIS FILE WAS REBUILT. The R8 preview carried the live v5 behaviour, scenario and
 * application values inside an INVENTED shift-handover narrative left over from R5: the
 * title said "Handing over what isn't finished", WHY THIS MATTERS was about a shift ending,
 * and the assumptions were about predictable shift changes — while THE STANDARD spoke about
 * projects and tasks. So the gate could not prove the repaired rendering of the live
 * proposal; it proved the repaired rendering of a chimera, and it read like one.
 *
 * Everything visible now derives from ONE object, `V5_LIVE`, below. Nothing else on this
 * page supplies a proposal value.
 *
 * WHAT `V5_LIVE` CAN AND CANNOT CONTAIN — worth stating exactly, because it bounds the
 * gate. BTY deliberately stores NO raw model prose (Slice 3.2L-R7 privacy rule): the ledger
 * row for this generation holds token counts, a byte count and a SHA-256 of the response,
 * and nothing else. The authentic v5 sentences therefore survive ONLY where the Founder's
 * physical recording showed them. So:
 *
 *   - the title, the behaviour contract, the scenario values, the application moment and
 *     the two WHY THIS MATTERS fragments are recorded values, reproduced verbatim;
 *   - the full WHY THIS MATTERS prose is an EXCERPT, marked as one, because the middle of
 *     it was never stored anywhere and inventing it would be the exact defect this
 *     revision exists to remove;
 *   - the assumptions and warnings are EMPTY, because that proposal's own assumptions and
 *     warnings were not recorded either — and carrying the old shift-change assumptions
 *     forward is precisely what made the last preview incoherent.
 */

/** Short, safe, shown on the page so a recording carries its own fixture identity. */
export const FIXTURE_IDENTITY = "R7 V5 live result c9718bd3";

/**
 * The authentic values, verbatim from the recorded v5 result. IMMUTABLE INPUT: every
 * displayed proposal value below is derived from this object and from nothing else.
 */
export const V5_LIVE = {
  displayTitle: "Improving Handoff Consistency",
  /**
   * The recorded fragments, joined with a visible elision. Both ends are authentic; the
   * ellipsis marks what was never stored rather than filling it in.
   */
  whyItMattersRecorded:
    "Establishing a consistent handoff standard … ultimately affects project success and team collaboration.",
  behavior: {
    actor: "each team member",
    trigger: "At the end of each project or task",
    observableAction: "state each unfinished item and identify its next owner",
    completion: {
      confirmedBy: "the next owner",
      confirmationAction: "confirm they understand what they are taking on",
    },
  },
  /**
   * The v5 scenario as it was returned — two fields, and the second one names its own
   * occasion. `contextDetail` no longer exists in the v7 contract, which is the whole
   * repair; it is kept here as recorded EVIDENCE, and `previewProposal()` proves it is
   * refused rather than rendered.
   */
  scenarioV5: {
    pressureOrConstraint: "a tight deadline is approaching and team members are waiting for information",
    contextDetail: "during a team meeting just before a project deadline",
  },
  applicationMoment: "at the next project handoff",
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  followUpContract: { reviewFocus: "what_you_said", confirmer: "self_report" },
  /** Not recorded, and not invented. See the file header. */
  assumptions: [] as string[],
  warnings: [] as string[],
} as const;

/**
 * HONEST OVERCLAIM HANDLING (G2). The recorded narrative ends in an outcome promise that
 * the R8 validator now refuses — "ultimately affects project success and team
 * collaboration". The preview neither displays it nor pretends v5 never said it: the
 * sentence is cut at the phrase the validator itself matches on, and what is removed is
 * stated on the page.
 */
export function withoutOutcomeClaim(text: string): string {
  const i = outcomeClaimIndex(text);
  if (i < 0) return text;
  const head = text.slice(0, i).replace(/[\s,;:—–-]+$/u, "");
  // The elision marker is terminal punctuation of its own — appending a stop after it
  // would read "handoff standard ….", and would also hide that something is missing.
  return /[.…?!]$/u.test(head) ? head : `${head}.`;
}

export const WHY_IT_MATTERS_SHOWN = withoutOutcomeClaim(V5_LIVE.whyItMattersRecorded);

/**
 * The training shape that produces this program's seven sections. These are PREVIEW
 * answers, not the Founder's draft: no draft id, no Host prose and nothing private reaches
 * this page. They are deliberately about the same operating problem as the fixture, so the
 * program reads as one training rather than two (Part 6).
 */
export const PREVIEW_ANSWERS: BuilderAnswers = {
  problem: "Unfinished work is handed on without saying what is left or who has it.",
  audienceType: "everyone",
  observableBehavior: "Name what is unfinished and who owns it next.",
  successEvidence: "Handoff note",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://example.invalid/preview",
  completionPrompt: "What will you say at your next handoff that you did not say before?",
  arenaRecommended: true,
  followUpDays: 7,
};

/**
 * The v7 contracts, derived from `V5_LIVE`.
 *
 * THE SCENARIO NORMALIZATION IS THE POINT. v5's `contextDetail` names an occasion, so v7
 * has nowhere to put it — the contract carries the pressure CONDITION only, and the moment
 * comes from the behaviour trigger. That is why the stitched "During a team meeting …. Even
 * then, at the end of each project or task …" cannot be produced from these values.
 */
export const PREVIEW_CONTRACTS: ProgramContracts = {
  behavior: {
    actor: V5_LIVE.behavior.actor,
    trigger: V5_LIVE.behavior.trigger,
    observableAction: V5_LIVE.behavior.observableAction,
    completion: { ...V5_LIVE.behavior.completion },
  },
  scenario: { pressureCondition: V5_LIVE.scenarioV5.pressureOrConstraint, pressureDetail: "" },
  application: { applicationMoment: V5_LIVE.applicationMoment },
  completion: { ...V5_LIVE.completionContract },
  followUp: { ...V5_LIVE.followUpContract },
  construct: null,
  followUpDays: PREVIEW_ANSWERS.followUpDays ?? 0,
};

const RATIONALE: Partial<Record<JourneyElementKind, string>> = {
  why_it_matters: "The problem the host described, with the outcome promise removed.",
  observable_standard: "Who acts, when, what is visible, and who confirms it.",
  scenario: "The same required moment, under the pressure that usually defeats it.",
  action_decision: "Commits to an action rather than inviting reflection.",
  field_application: "The first real instance of the required moment.",
  completion_check: "Verifies a concrete application plan.",
  follow_up: "States plainly what a self-report can and cannot show.",
};

const ORDER: JourneyElementKind[] = [
  "why_it_matters",
  "observable_standard",
  "scenario",
  "action_decision",
  "field_application",
  "completion_check",
  "follow_up",
];

/**
 * The proposal the preview renders. Every instructional section is produced by the SAME
 * `deriveInstructionalContent` the review surface and Apply use — so this fixture cannot
 * show sentences the product would not produce from these contracts.
 */
export function previewProposal(): ProgramProposal {
  return {
    displayTitle: V5_LIVE.displayTitle,
    elements: ORDER.map((kind) => ({
      kind,
      content: deriveInstructionalContent(kind, PREVIEW_CONTRACTS) ?? WHY_IT_MATTERS_SHOWN,
      rationale: RATIONALE[kind] ?? "",
    })),
    assumptions: [...V5_LIVE.assumptions],
    warnings: [...V5_LIVE.warnings],
    evidenceLanguage: deriveEvidenceCeiling(PREVIEW_ANSWERS),
    behaviorContract: PREVIEW_CONTRACTS.behavior,
    scenarioContract: PREVIEW_CONTRACTS.scenario,
    applicationContract: PREVIEW_CONTRACTS.application,
    completionContract: PREVIEW_CONTRACTS.completion,
    followUpContract: PREVIEW_CONTRACTS.followUp,
    operationalConstruct: null,
  };
}

export const PREVIEW_PROPOSAL: ProgramProposal = previewProposal();

/**
 * The API also returns a ceiling. It is the SAME `deriveEvidenceCeiling(answers)` the
 * proposal carries — kept here only so the preview exercises the real prop, and rendered
 * once (Part 4).
 */
export const PREVIEW_EVIDENCE_CEILING = deriveEvidenceCeiling(PREVIEW_ANSWERS);
