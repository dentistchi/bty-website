import {
  deriveEvidenceCeiling,
  deriveInstructionalContent,
  retainGroundedAssumptions,
  programContext,
  programContextFingerprint,
  type ProgramContracts,
  type ProgramProposal,
} from "@/domain/foundry/module/program-authorship";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";
import type { JourneyElementKind } from "@/domain/foundry/module/journey";

/**
 * THE PHYSICAL PREVIEW FIXTURE — one authentic proposal, replayed (Slice 3.2L-R9).
 *
 * This now replays the R8.1 V7 live window (parent `b6842a08`), whose instructional core
 * was physically usable and whose two remaining defects this revision repairs: a WHY THIS
 * MATTERS full of unmeasured causal promises, and a follow-up telling the actor that the
 * person on the other side "will be asked the same question".
 *
 * ONE SOURCE. Everything visible derives from `V7_LIVE` below and from the deterministic
 * renderers the product itself uses — including WHY THIS MATTERS, which is no longer prose
 * the model writes.
 *
 * WHAT IS AND IS NOT REPLAYABLE. BTY stores no raw model prose (Slice 3.2L-R7 privacy
 * rule); the ledger row carries token counts, a byte count and a SHA-256. So `V7_LIVE`
 * holds exactly what the Founder's recording showed — title, the full WHY THIS MATTERS,
 * the behaviour, scenario, application and completion values, the follow-up line and both
 * assumptions — and nothing beyond it. The recorded WHY THIS MATTERS and both assumptions
 * are kept here as EVIDENCE and are deliberately not displayed: the page shows the derived
 * rationale, and the assumptions do not survive `retainGroundedAssumptions`.
 */

/** Short, safe, shown on the page so a recording carries its own fixture identity. */
export const FIXTURE_IDENTITY = "R10-A V9 canonical instance";

/**
 * The authentic values, verbatim from the recorded v5 result. IMMUTABLE INPUT: every
 * displayed proposal value below is derived from this object and from nothing else.
 */
export const V7_LIVE = {
  displayTitle: "Creating Consistent Handoffs",
  /** The full recorded WHY THIS MATTERS — displayed nowhere now, kept as the evidence. */
  whyItMattersRecorded:
    "Establishing a shared handoff standard ensures that everyone is clear on responsibilities and prevents important tasks from falling through the cracks. This clarity supports team collaboration and improves overall workflow efficiency.",
  /** The Host's own problem, which the derived rationale is rendered from. */
  problemStatement: "Our handoffs are inconsistent.",
  behavior: {
    actor: "team members",
    trigger: "At each handoff point",
    observableAction: "state each unfinished item and identify its next owner",
    /**
     * WHAT v5 ACTUALLY RETURNED, kept as the record and no longer fed to the product
     * (Slice 3.2P-R3.4-R1). The model authored a confirmer and a confirming act; v11 has no
     * such field, so the preview renders completion from the Host's own `successEvidence`
     * below. Preserved verbatim rather than deleted — this file's whole job is to hold the
     * authentic input, and rewriting it to look v11-native would fake the history.
     */
    completionRecorded: {
      confirmedBy: "the receiving team member",
      confirmationAction: "repeat back who owns the next step",
    },
    /** v11: the Host's evidence, carried by the server. Same string as `PREVIEW_ANSWERS`. */
    completion: { criterion: "Handoff record" },
  },
  scenario: { frame: "time_is_short" },
  /*
    NO application moment (Slice 3.2L-R10-A). v8's live window died refusing the model's own
    first moment; v9 derives it from the trigger, so the fixture carries none and the
    preview proves the derivation rather than a stored string.
  */
  completionContract: { verificationTarget: "the_behaviour", responseMode: "name_the_moment" },
  /*
    v5 chose `the_other_person`, which produced the "same question" line R9 was built to fix.
    v11 removed that option with the confirmer it depended on, so the preview carries the
    nearest honest v11 value: this follow-up is a self-report.
  */
  followUpContract: { reviewFocus: "what_happened_next", confirmer: "self_report" },
  /** Both recorded assumptions; both are dropped by `retainGroundedAssumptions`. */
  assumptionsRecorded: [
    "Participants have a basic understanding of handoff processes.",
    "Participants are willing to commit to adopting new practices.",
  ],
  warningsRecorded: [] as string[],
} as const;

/**
 * The training shape that produces this program's seven sections. These are PREVIEW
 * answers, not the Founder's draft: no draft id, no Host prose and nothing private reaches
 * this page. They are deliberately about the same operating problem as the fixture, so the
 * program reads as one training rather than two (Part 6).
 */
export const PREVIEW_ANSWERS: BuilderAnswers = {
  problem: "Our handoffs are inconsistent.",
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://example.invalid/preview",
  completionPrompt: "What specific elements will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
};

/**
 * The v7 contracts, derived from `V7_LIVE`.
 *
 * THE SCENARIO NORMALIZATION IS THE POINT. v5's `contextDetail` names an occasion, so v7
 * has nowhere to put it — the contract carries the pressure CONDITION only, and the moment
 * comes from the behaviour trigger. That is why the stitched "During a team meeting …. Even
 * then, at the end of each project or task …" cannot be produced from these values.
 */
export const PREVIEW_CONTRACTS: ProgramContracts = {
  problemStatement: V7_LIVE.problemStatement,
  // Slice 3.2R-R2.3 — this fixture reproduces a v7 window whose Host authored no completion
  // question, so BEFORE YOU FINISH stays the governed derivation, exactly as it rendered live.
  locale: "en" as const,
  /*
    THE HOST'S TWO SENTENCES (Slice R4-R5C14A) — sourced from the same answers the rest of this
    fixture reproduces, so the preview cannot show a standard the Host never wrote.
  */
  hostBehavior: PREVIEW_ANSWERS.observableBehavior as string,
  hostEvidence: PREVIEW_ANSWERS.successEvidence as string,
  completionPrompt: null,
  behavior: {
    actor: V7_LIVE.behavior.actor,
    trigger: V7_LIVE.behavior.trigger,
    observableAction: V7_LIVE.behavior.observableAction,
    completion: { ...V7_LIVE.behavior.completion },
  },
  scenario: { ...V7_LIVE.scenario },
  // Derived from `behavior.trigger` at render time — never stored (Slice 3.2L-R10-A).
  application: null,
  completion: { ...V7_LIVE.completionContract },
  followUp: { ...V7_LIVE.followUpContract },
  construct: null,
  followUpDays: PREVIEW_ANSWERS.followUpDays ?? 0,
};

const RATIONALE: Partial<Record<JourneyElementKind, string>> = {
  why_it_matters: "The problem you described, and the one visible thing this program asks for.",
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
    displayTitle: V7_LIVE.displayTitle,
    elements: ORDER.map((kind) => ({
      kind,
      /*
        Seven sections are DERIVED by BTY; two are CARRIED from the Host (Slice R4-R5C14A).
        THE STANDARD is their `observableBehavior` and WHAT SUCCESS LOOKS LIKE is their
        `successEvidence`, placed on the element by the server exactly as reproduced here — so
        this fixture still cannot show a sentence the product would not produce.
      */
      content:
        kind === "observable_standard"
          ? PREVIEW_CONTRACTS.hostBehavior
          : kind === "evidence"
            ? PREVIEW_CONTRACTS.hostEvidence
            : deriveInstructionalContent(kind, PREVIEW_CONTRACTS) ?? "",
      rationale: RATIONALE[kind] ?? "",
    })),
    // The recorded assumptions, put through the same filter the validator applies.
    assumptions: retainGroundedAssumptions([...V7_LIVE.assumptionsRecorded]),
    warnings: [...V7_LIVE.warningsRecorded],
    evidenceLanguage: deriveEvidenceCeiling(PREVIEW_ANSWERS),
    behaviorContract: PREVIEW_CONTRACTS.behavior,
    scenarioContract: PREVIEW_CONTRACTS.scenario,
    applicationContract: null,
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

/**
 * The Host-input authority this fixture stands for. The preview compares it with itself,
 * so the stale gate is inert here and the Apply boundary can be exercised (Slice 3.2L-R11).
 */
export const PREVIEW_FINGERPRINT = programContextFingerprint(programContext(PREVIEW_ANSWERS)!);
