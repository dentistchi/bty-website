import { createHash } from "node:crypto";
import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import { parseArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
import {
  validateBranchedScenario,
  validateConcreteScene,
  validateIncidentSpecific,
} from "@/domain/foundry/arena-draft/quality";
import {
  classifyPracticeEligibility,
  validateConstraintCompliance,
  type PracticeEligibility,
} from "@/domain/foundry/arena-draft/safety";
import { validateConstraintAssessments, type ConstraintAssessment, type PracticeBoundary } from "@/domain/foundry/arena-draft/boundary";
import { MAX_ACTIVE_BOUNDARIES, resolveActiveBoundaries, type PracticeBoundaryScope } from "@/domain/foundry/arena-draft/boundaryScope";
import {
  categorizeHttpStatus,
  categorizeThrown,
  type ProviderFault,
} from "@/domain/foundry/arena-draft/generationOutcome";
import {
  assertReviewBoundaryAuthority,
  boundaryProvenanceSha256,
  buildBoundaryProvenance,
  checkBoundaryCoverage,
  noBoundaryProvenance,
  sha256 as provenanceSha256,
  type BoundaryReviewProvenance,
} from "@/domain/foundry/arena-draft/boundaryProvenance";
import { type ReviewSubject, canRerunOverSubject, reviewSubjectSha256, scenarioDigest } from "@/domain/foundry/arena-draft/reviewSubject";
import { buildReviewSubjectContract } from "./reviewSubjectContract";
import {
  MAX_REVIEW_CALLS_PER_SUBJECT,
  REVIEWER_TERMINAL_FAILURE,
  decideAfterReview,
  isContradiction,
} from "@/domain/foundry/arena-draft/reviewRerun";
import {
  accumulateBoundaryMetrics,
  emptyBoundaryMetrics,
  runBoundaryReviewStage,
  type BoundaryReviewMetrics,
} from "./boundaryReviewStage";
import { reviewBoundarySurfaces, reviewFieldRepair } from "./narrowBoundaryReviewer";
import type { CallOutcome } from "@/domain/foundry/arena-draft/generationCallSequence";
import {
  classifyThrownCall,
  isProviderCallTelemetryError,
  readCallUsage,
  withProviderCall,
  type GenerationAccounting,
  type ProviderCallScope,
} from "./generationAccounting";
import { buildBroadReviewRequest, serializeBroadReviewRequest } from "./reviewRequestProjection";
import { projectConstraintAssessments } from "@/domain/foundry/arena-draft/constraintProjection";
import { validateBoundaryGrounding } from "@/domain/foundry/arena-draft/boundaryGrounding";
import { resolveRejection, type Finding, type RejectionOutcome } from "@/domain/foundry/arena-draft/gatePrecedence";
import {
  buildCorrectionPacket,
  canonicalPacketJson,
  renderCorrectionPacket,
  type CorrectionPacket,
  type ImmutableContext,
} from "@/domain/foundry/arena-draft/correctionPacket";
import {
  detectMeasuredLabelDefects,
  enumerateChoices,
  validateChoiceConstructions,
} from "@/domain/foundry/arena-draft/choiceConstruction";
import {
  PROVIDER_SCENARIO_JSON_SCHEMA,
  PROVIDER_SCHEMA_NAME,
  canonicalizeProviderScenario,
  validateProviderScenario,
} from "@/domain/foundry/arena-draft/providerDto";
import {
  SEMANTIC_REVIEW_JSON_SCHEMA,
  SEMANTIC_REVIEW_SCHEMA_NAME,
  buildRetryFeedback,
  validateSemanticReview,
  type BoundaryAssessment as BoundaryEvidence,
  type BranchDefectCode,
  type ChoiceDefectCode,
} from "@/domain/foundry/arena-draft/semanticReview";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import { hardestWhenPhrase, type Locale, type ScenarioGenInput } from "./arenaScenarioTemplate";
import type { ModuleSourceFacts } from "./arenaScenarioSource";

/**
 * Foundry Guided Arena Builder — scenario generation (service).
 *
 * Slice 3.2I-R2: the Manager-facing runtime is LIVE-MODEL ONLY. The provider drafts a
 * branch-aware scenario; the domain gates (structural + difficult-choice + concrete-scene
 * + incident-specificity) decide validity. On no provider, provider failure, malformed
 * output, or ANY gate rejection, generation FAILS SAFE — it never falls back to a generic
 * deterministic scenario (that is a quietly-delivered product failure). The deterministic
 * `buildTemplateScenarioDraft` remains ONLY as a test/fixture factory and is not called
 * here. The provider sees no attachment bytes or PII — only structured context + the two
 * guided answers, and never decides XP/verification/standards.
 */

export type GeneratedDraft = {
  draft: ArenaScenarioDraft;
  /** Always "ai" in the runtime — deterministic output is test-only. */
  source: "ai";
  /** Advisory sensitive-info codes surfaced by the validator (never blocks). */
  warnings: string[];
  /**
   * R2.23C — per-choice constraint evidence MATERIALIZED by the server from the ACCEPTED review,
   * never authored by the generator. Compatibility projection: same shape as before, derived from
   * independent evidence. Empty when no boundary is active.
   */
  constraintEvidence: Record<string, ConstraintAssessment[]>;
};

/** Discriminated generation outcome — a rejection carries a safe, stable reason. */
/** The closed set of terminal failure reasons, named so callers can hold one. */
export type GenerationFailureReason =
  | "generation_unavailable"
  | "generation_failed"
  | "generation_rejected"
  | "fixed_answer_knowledge"
  | "safety_boundary_unresolved"
  | "boundary_confirmation_required"
  | "structured_output_unavailable"
  | "no_safe_judgment_space"
  | "practice_boundary_scope_required"
  | "too_many_active_boundaries"
  | "unknown_active_boundary"
  | "missing_required_active_boundary"
  | "active_boundary_set_changed"
  | "boundary_scope_not_confirmed"
  /** R2.25 — the reviewer failed twice over an identical frozen subject; content never judged. */
  | "reviewer_terminal_failure"
  /** R2.27 — boundary provenance was missing, incomplete or drifted. No reviewer call was made. */
  | "review_boundary_authority_failed"
  /** R2.29 — the narrow boundary reviewer could not settle a surface. Content never fully judged. */
  | "boundary_review_inconclusive"
  /** R2.29 — two unusable narrow boundary reviews over an identical frozen subject. */
  | "boundary_reviewer_terminal_failure"
  /** R2.29 — the surface map or boundary mode was unusable. No narrow provider call was made. */
  | "boundary_review_authority_failure";

export type GenerationResult =
  | { ok: true; value: GeneratedDraft }
  | {
      ok: false;
      /**
       * R5A — the provider observation behind a `generation_failed`, carried to whoever owns the
       * durable attempt row. Absent for every reason that is already unambiguous.
       */
      fault?: ProviderFault;
      /** R5A — finding codes, so a rejection can be split into malformed vs quality-refused. */
      rejectionCodes?: string[];
      /**
       * R5C-1 — the GATE that refused. A boundary CONTENT rejection exhausts its retry and returns
       * plain `generation_rejected`, identically to a quality-gate refusal, so the reason alone can
       * never separate them. This is the evidence that can, and it was previously discarded.
       */
      rejectionGate?: string;
      /** The evaluator's own headline code, preserving its ranking. */
      rejectionPrimaryCode?: string;
      reason:
        | "generation_unavailable" // no live model configured
        | "generation_failed" // transport/exception/timeout — no usable content returned
        | "generation_rejected" // content returned but malformed / gate / safety-constraint failed
        | "fixed_answer_knowledge" // KNOW-only content — not a judgment dilemma
        | "safety_boundary_unresolved" // free-text boundary undetermined (no confirmation)
        | "boundary_confirmation_required" // a possible boundary is detected but not Manager-confirmed
        | "structured_output_unavailable" // provider rejected the strict schema — never downgraded silently
        | "no_safe_judgment_space" // confirmed constraints leave no legitimate difficult choice
        // R2.23C Host SETUP outcomes — never a no-safe generation result.
        | "practice_boundary_scope_required"
        | "too_many_active_boundaries"
        | "unknown_active_boundary"
        | "missing_required_active_boundary"
        | "active_boundary_set_changed"
        | "boundary_scope_not_confirmed"
        | "reviewer_terminal_failure"
        | "review_boundary_authority_failed"
        // R2.29 narrow boundary-review stage outcomes — never a broad-review verdict.
        | "boundary_review_inconclusive"
        | "boundary_reviewer_terminal_failure"
        | "boundary_review_authority_failure";
    };

/** Deterministic digest of the correction an attempt received. Evidence, not configuration. */
export const packetDigest = (packet: CorrectionPacket): string =>
  createHash("sha256").update(canonicalPacketJson(packet)).digest("hex");

/** Everything a retry may NOT change, pinned verbatim from the original input. */
function immutableContext(input: ScenarioGenInput, constraints: PracticeBoundary["constraints"]): ImmutableContext {
  return {
    facts: [input.facts.problem, input.facts.observableBehavior, input.facts.successEvidence].filter((x): x is string => Boolean(x)),
    role: input.facts.audienceType ?? "",
    locale: input.locale,
    boundaries: constraints.map((c) => ({ id: c.id, statement: c.statement })),
  };
}

/** The training input as one string — read only by the measured false-reassurance rule. */
function factsTextOf(input: ScenarioGenInput): string {
  return [input.facts.problem, input.facts.observableBehavior, input.facts.successEvidence, input.guided.avoidancePressure.text]
    .filter(Boolean)
    .join(" ");
}

/** Map module facts → the pure safety classifier's minimal input. */
function eligibilityOf(facts: ModuleSourceFacts): PracticeEligibility {
  return classifyPracticeEligibility({
    problem: facts.problem,
    observableBehavior: facts.observableBehavior,
    successEvidence: facts.successEvidence,
    learningNeeds: facts.learningNeeds,
  });
}

/**
 * Bounded provider timeouts — generation must never hang the host's flow.
 *
 * Slice 3.2I-R2.15 (measured): the first full live run rejected 14/20 cases with the model
 * genuinely responding (14.9–25.3 s). Generation must emit the flat phases PLUS one full branch
 * per primary choice PLUS a `constraintAssessments` entry for every choice id — a worst case near
 * 4,000 output tokens. The previous 1,400-token ceiling truncated that mid-object, so `JSON.parse`
 * failed and the outcome was recorded as `malformed_shape`. Raising the ceiling without also
 * raising the generation timeout would simply convert truncation into aborts, so both move
 * together. The small semantic-review call keeps its own tight budget.
 */
/**
 * R2.23 MEASURED. Live latency in R2.19 ran 14.9-25.3 s for ~3k-token outputs — roughly 8.4 s per
 * 1,000 output tokens. The measured canary-shape maximum is ~9.9k tokens (Korean), which needs
 * ~85 s. 45 s would have converted the corrected token budget straight into aborts.
 */
const LLM_GEN_TIMEOUT_MS = 120_000;
/**
 * The reviewer's own budget. R2.22 grew its schema from a primary-only verdict to one entry per
 * VISIBLE CHOICE (up to 33 at maximum cardinality) plus per-branch progression, per-boundary
 * grounding, urgency and a cross-branch comparison. R2.15 established what happens when a ceiling
 * sits below a schema's worst case: the body truncates mid-object and the outcome is misreported.
 * Both reviewer numbers move with the schema, and truncation is now detected explicitly.
 */
const LLM_REVIEW_TIMEOUT_MS = 120_000;
/**
 * R2.23 MEASURED output ceilings — see `tokenBudget.ts` and PART 5/6 of the slice report.
 *
 * 4,000 was set in R2.15, before boundary grounding (R2.21) and a construction record on every
 * choice (R2.22). Measured against the CURRENT schema at the canary operating shape (2 primary
 * choices, 2+2 choices, 1 confirmed boundary): generation needs 6,683 tokens in English and 9,939
 * in Korean; the review needs 7,918 / 11,460. Both budgets were below their own requirement, so
 * every Korean case and most English ones were one verbose response away from truncating.
 *
 * 16,000 is the largest value the configured model class (gpt-4o-mini, 16,384-token output cap) can
 * honour. It clears the canary shape with ~1.6x headroom.
 *
 * IT DOES NOT cover the schema's permitted MAXIMUM cardinality — 4 primary choices with 3+3 choices
 * per branch measures 20,298 tokens in English and 29,296 in Korean, past the model's own cap, not
 * merely past our ceiling. That is a real product decision (cap the cardinality, or move to a model
 * with a larger output window), and it is deliberately NOT resolved by quietly shrinking the schema.
 * Until it is, truncation at high cardinality FAILS CLOSED via `truncated_output` / `review_truncated`
 * and is never parsed as content.
 */
const LLM_GEN_MAX_TOKENS = 16_000;
const LLM_GEN_TEMPERATURE = 0.8;
const LLM_GEN_TOP_P = 0.9;
/** The reviewer is a judge, not an author: determinism is stated, never left to a provider default. */
const LLM_REVIEW_TEMPERATURE = 0;
const LLM_REVIEW_TOP_P = 1;
const LLM_REVIEW_MAX_TOKENS = 16_000;

/**
 * MEASURED sampling inventory (Slice 3.2I-R5B1A.1-R2.22 Part 11).
 *
 * Every value the generation contract samples with, in one place. Previously `0.8`, `0.9`, `0` and
 * `1600` were inline literals at the call sites and the reviewer's `top_p` was unset — a hidden
 * provider default in the one call that must be deterministic.
 *
 * The retry reuses the GENERATION settings by construction: it is the same `generateWithLlm` call
 * with correction text appended, so there is no second, divergent sampling path.
 *
 * Only the endpoint, key and model come from the environment (`LLM_BASE_URL`, `LLM_API_KEY` /
 * `OPENAI_API_KEY`, `LLM_MODEL`). No temperature, top_p, token ceiling or timeout is
 * environment-dependent — verified by test, so a deploy cannot silently change generation
 * behaviour. Tuning is deliberately NOT performed here; the next slice measures whether it is needed
 * once the content contract is complete.
 */
export const PRACTICE_SAMPLING = {
  generation: { temperature: LLM_GEN_TEMPERATURE, topP: LLM_GEN_TOP_P, maxTokens: LLM_GEN_MAX_TOKENS, timeoutMs: LLM_GEN_TIMEOUT_MS },
  review: { temperature: LLM_REVIEW_TEMPERATURE, topP: LLM_REVIEW_TOP_P, maxTokens: LLM_REVIEW_MAX_TOKENS, timeoutMs: LLM_REVIEW_TIMEOUT_MS },
  retry: { maxAttempts: 2, inheritsGenerationSampling: true },
  /** Environment-controlled sampling knobs. Measured: none. */
  environmentOverrides: [] as readonly string[],
} as const;

/**
 * EVALUATION-ONLY observability (Slice 3.2I-R2.15).
 *
 * The first full live run recorded only `generation_rejected` per case, so which stage actually
 * rejected each one — JSON validity, truncation, schema, identifier, safety or quality — could not
 * be read from the artifact. This sink lets the evaluation harness collect the exact stage without
 * production ever emitting raw generated content.
 *
 * It is OFF unless the harness installs a sink, and it records NO credential, NO Authorization
 * header, NO request headers and NO provider account identifier.
 */
export type GenObservation = {
  outcome: string;
  code?: string;
  finishReason?: string;
  rawLength?: number;
  rawSample?: string;
  /** R2.23 — ranked rejection evidence: gate level, primary code, complete defect list. */
  gate?: string;
  level?: number;
  defectCodes?: string[];
  findings?: unknown;
  evidenceSources?: Record<string, string[]>;
  correctionPacket?: unknown;
  correctionPacketSha256?: string;
  /** R2.19 — captured ONLY when the harness opts in. See `__setGenObserver`. */
  scenario?: unknown;
  review?: unknown;
  retryFeedback?: string;
  /** R2.25 — frozen-subject identity, carried by every review-related observation. */
  reviewSubjectSha256?: string;
  scenarioSha256?: string;
  reviewContractSha256?: string;
  /** True when a reviewer terminal failure meant the scenario content was never judged. */
  scenarioUnjudged?: boolean;
  /** R2.27 — canonical boundary record and its digest, on every review-related observation. */
  boundaryProvenanceSha256?: string;
  boundaryProvenance?: unknown;
  /** The exact boundary projection the reviewer request carried. */
  reviewRequestBoundaries?: Array<{ id: string; statement: string }>;
  /** Whether the reviewer answered about exactly the active set. */
  boundaryCoverage?: { ok: boolean; codes: string[]; boundaryIdsConsidered: string[]; assessmentIds: string[] };
  /** R2.29 — narrow boundary-review stage evidence. */
  boundaryReviewSubjectSha256?: string;
  surfaceMapSha256?: string;
  surfaceCount?: number;
  activeBoundaryIds?: string[];
  boundaryMode?: string;
  boundaryReviewOutcome?: string;
  boundaryReviewCalls?: number;
  boundaryReviewReruns?: number;
  /** Every narrow call's complete parsed DTO and derived verdict, in order. */
  boundaryReviewEvidence?: unknown;
  violations?: unknown;
  uncertainties?: unknown;
  because?: string;
  boundaryMetrics?: BoundaryReviewMetrics;
  /** Whether the broad semantic reviewer was permitted to run after the boundary stage. */
  broadReviewStarted?: boolean;
};
let genObserver: ((o: GenObservation) => void) | null = null;
/**
 * R2.19 — rejected-attempt CONTENT capture, off by default.
 *
 * The R2.18 canary recorded only `bad_faith_option` then `moral_decoy` for c01: the rejection gate
 * worked, but the rejected scenarios, the reviewer's per-choice verdict and the retry correction
 * were all lost, so the root cause could not be discriminated. With `captureContent` the harness
 * additionally receives the rejected canonical scenario, the structured review and the exact retry
 * message. Production never sets it, so production logging is unchanged.
 */
let genCaptureContent = false;
export function __setGenObserver(fn: ((o: GenObservation) => void) | null, opts?: { captureContent?: boolean }): void {
  genObserver = fn;
  genCaptureContent = fn ? opts?.captureContent === true : false;
}
/** Evidence is attached only when the harness explicitly opted in. */
function captured(payload: Pick<GenObservation, "scenario" | "review" | "retryFeedback">): Partial<GenObservation> {
  return genCaptureContent ? payload : {};
}

/** A Level 1/2 short-circuit still produces a ranked outcome, so every rejection has a level. */
const singleFinding = (code: string, gate: string): RejectionOutcome =>
  resolveRejection([{ code, gate }])!;

function logGenOutcome(outcome: string, code?: string, extra?: Omit<GenObservation, "outcome" | "code">): void {
  console.info(`[arenaScenarioGen] ${outcome}${code ? ` code=${code}` : ""}`);
  genObserver?.({ outcome, code, ...extra });
}

/**
 * Does this transport error mean the endpoint/model cannot honour a strict JSON Schema?
 * OpenAI-compatible providers answer 400 with a response_format/json_schema complaint. Matching is
 * deliberately narrow — an unrelated 400 must stay `generation_failed`, not be mistaken for a
 * capability gap.
 */
function isStructuredOutputUnsupported(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (!/\b(400|404|422)\b/.test(msg)) return false;
  return /response_format|json_schema|structured output|schema/i.test(msg);
}

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Minimal, PII-free structured context for the provider. */
export function buildGenerationSystemPrompt(locale: Locale, constraints: PracticeBoundary["constraints"]): string {
  const isKo = locale === "ko";

  const constraintLines = constraints.length
    ? [
        "CONFIRMED NON-NEGOTIABLE CONSTRAINTS — mandatory rules the Manager confirmed. EVERY primary, tradeoff, and action choice, on EVERY branch, MUST fully obey ALL of them. You may NOT delete, weaken, reinterpret, or replace any constraint:",
        ...constraints.map((c) => `- [${c.id}] ${c.statement}`),
        "Do NOT balance compliance against non-compliance. Never present skipping, bypassing, delaying past, hiding, or disclosing-against a constraint as a defensible option. Put the difficult tradeoff ONLY around HOW to comply — sequencing, communication timing, scope, staffing reassignment, escalation order, schedule recovery, who acts first — with the constraint naturally embedded in the scene, not a lecture. Every path still satisfies every constraint. If no legitimate difficult choice exists inside the safe boundary, set noSafeJudgmentSpace to true.",
        "GROUND EVERY CONSTRAINT — silence about a rule is NOT compliance. A scenario that simply never mentions the rule is REJECTED even if no choice happens to break it. For each constraint: (1) make it OPERATIVE in the opening or immediate context, in natural language a person in this role would really use — never a policy quotation or a lecture; (2) let it visibly rule out the tempting non-compliant option, so the learner sees it excluded rather than offered; (3) keep it in force through EVERY branch, tradeoff and action decision — no phase may reopen, waive or quietly drop it; (4) put the real difficulty in the judgment that survives inside it.",
        "TEST YOURSELF: if the constraint were deleted, would your scenario read exactly the same? If yes, it is decorative — rewrite it so the rule actually changes what can be chosen.",
        "Also return `boundaryGrounding`: one entry per constraint id — {\"boundaryId\": the exact id, \"boundaryStatement\": the confirmed rule restated faithfully (never weakened), \"scenarioPresence\": where and how the rule is made operative in the learner-facing text, \"operationalEffect\": what it forces or forbids in the decisions, \"affectedDecisionStages\": which of opening/primary/flat_tradeoff/flat_action/branch_tradeoff/branch_action it constrains (it MUST constrain at least one decision stage, not just the opening), \"prohibitedAlternativeExcluded\": the tempting option the rule takes off the table, \"remainingJudgmentDimensions\": the judgment that genuinely remains}. This is internal metadata; never put it in a learner-facing label.",
      ]
    : [];

  /**
   * URGENCY SAFETY (R2.21) — domain-neutral. c18 produced a primary option that delayed urgent care
   * with foreseeable deterioration. The correction is a competent alternative, NOT a refusal to
   * generate, and NOT clinical guidance: Practice evaluates leadership judgment, never treatment.
   */
  const urgencyLines = [
    "URGENT / TIME-SENSITIVE SITUATIONS — when the situation carries time-sensitive harm, NO option may knowingly delay urgent action for convenience, appearance or speed of paperwork, and no option may create avoidable foreseeable deterioration. Never offer vague reassurance in place of an operational action.",
    "Legitimate options under urgency include: taking the short pause a mandatory safety check REQUIRES, escalating staffing or supervision, sequencing work so both the urgent need and the mandatory check are honoured, redirecting or referring when safe capacity is unavailable, and managing recovery after a delay. Use only resources the training context actually supports — do not invent teams, people or capacity.",
    "Do not fabricate urgency, clinical risk or medical detail that the training context does not contain, and never write treatment guidance. The decision under practice is a LEADERSHIP decision.",
  ];

  return [
    "You design ONE short leadership DECISION-PRACTICE scenario. Its purpose is NOT to find the right answer — it is to force a difficult choice: which legitimate value to protect, and what cost to accept, under pressure.",
    "The scenario has EXACTLY three phases: PRIMARY (a realistic opening situation with strategic choices), TRADEOFF (a harder escalation that raises the stakes), and ACTION DECISION (a direct decision about a concrete next action).",
    "CONCRETE SCENE — the opening must read like an actual moment, not a training description. In 2-4 natural sentences establish: WHO (the learner's role/responsibility), WHAT specifically just happened (a concrete incident, request, failure, or risk), WHO is affected (a concrete stakeholder — a teammate, client, patient, the team…), WHY NOW (a deadline, a waiting person, a live decision), and that two legitimate values cannot both be fully protected. NEVER write 'A realistic moment', 'A difficult situation', 'Leadership is required', '<capability> is called for', 'you cannot protect both', or interpolate a raw capability phrase into a sentence. Do not invent named organizations, real people, or specific numbers. Use the training context, target role, and audience for a plausible concrete setting.",
    "Every choice (primary, tradeoff, action) must begin with or clearly contain a CONCRETE ACTION the learner performs (tell, pause, call, verify, escalate, meet, document, disclose, delay, narrow, proceed, ask…) — not abstract intent ('protect trust', 'demonstrate leadership', 'hold the standard'). Vary phrasing; do not repeat boilerplate like 'accepting that' or 'there isn't enough time' across the opening and every branch.",
    "",
    "EXACTLY TWO STRATEGIES AT EVERY DECISION. The learner is offered two options at each point, and the difficulty comes from how good BOTH of them are — not from how many there are. Each of the two must protect a DIFFERENT legitimate value, accept a DIFFERENT real cost, and lead somewhere causally different. Two options a competent person could genuinely argue for beats four that nobody would choose.",
    "DIFFICULT-CHOICE CONTRACT — every selectable option MUST satisfy ALL of:",
    "- a competent, well-intentioned person could reasonably choose it;",
    "- it protects a legitimate value (e.g. speed, accuracy, transparency, relationship, fairness, safety, autonomy, stability, credibility);",
    "- it names a concrete action, with an immediate benefit AND a meaningful cost, risk, or sacrifice;",
    "- it is NOT written to be the obvious wrong answer.",
    "Put at least TWO legitimate values in genuine tension (e.g. speed vs accuracy, transparency vs controlled verification, team protection vs accountability). NEVER frame it as responsibility vs irresponsibility, honesty vs lying, caring vs not caring, or action vs laziness.",
    "NO option may be a passive throwaway (do nothing / ignore it / pretend / defer to someone else / wait a bit longer with no stated cost). Waiting, verifying, or narrowing scope is allowed ONLY if it names the concrete cost it accepts.",
    "Keep options BALANCED: comparable length, specificity, professionalism, and tone. Do not write one thoughtful option beside one curt or careless one.",
    "BRANCH COHERENCE: the runtime shows ONE shared escalation and ONE shared action decision to the learner, whichever Primary choice they picked. So the escalation must raise the cost in a way that is TRUE for EVERY Primary choice — it must NOT presuppose a specific prior action (never write 'your delay', 'your message', 'now that you've gone public', 'the commitment you made', 'because you waited'). Prefer a NEW independent pressure (a new stakeholder, deadline, or fact) that applies regardless of the path taken; never merely restate the opening.",
    "Tradeoff and Action choices must not reference an artifact a path may not have produced (never 'stand by your original message', 'continue the announcement you started'). Refer back only in branch-neutral terms ('your first move', 'your earlier call', 'the approach you took').",
    "PARITY: never pair legitimizing wording with condemning wording (e.g. 'uphold the complaint on its merits' vs 'partly discount the grievance', 'take responsibility' vs 'avoid responsibility'). Write both as competing strategies with real, comparable rationale.",
    "ACTION DECISION: both options must be specific, realistic next actions that each carry a visible cost. Acting now must carry risk; verifying/narrowing must also give something up. It must NOT reduce to 'do the right thing now' vs 'avoid it'.",
    "FORBIDDEN in ALL learner-facing text: correct/incorrect, right/wrong answer, best/ideal/poor choice, 'the right thing', 'you should have', moral praise or blame, or any hint of a preferred answer. Do not write reflection or essay questions.",
    "Some behaviors have a fixed correct action (safety, privacy, compliance). Do NOT invent a fake wrong version of the fact. Instead make the tension the COST of upholding the standard under pressure (e.g. upholding the rule vs speed, relationship, or cost).",
    "Plan internally the value each option protects and the cost it accepts — but DO NOT write those labels into the learner-facing copy.",
    "PER-PRIMARY CAUSAL BRANCHING (required): the learner's PRIMARY choice must change what happens next. Produce EXACTLY TWO branches — one per primary choice, in the same order. Each branch's escalation, tradeoff choices, and action decision must follow causally from THAT primary choice — the action it took, the facts it created, the value it protected, the cost it accepted, and the NEW pressure that path creates. Do NOT reuse one shared escalation across branches, and never let a branch reference a fact or action from a DIFFERENT branch. Each branch's tradeoff and action decision must independently satisfy the difficult-choice contract above.",
    "The flat top-level `tradeoff` / `actionDecision` remain as a branch-neutral fallback (compatible with every primary): keep them, but the branches carry the real per-choice continuations.",
    `Write all learner-facing text in ${isKo ? "Korean" : "English"}.`,
    "Return ONLY a compact JSON object, no markdown or code fences, with EXACTLY this shape:",
    '{"noSafeJudgmentSpace": boolean, "title": string, "opening": string, "primaryChoices": [{"label": string, "construction": {}}], "flatEscalationText": string, "flatTradeoffChoices": [{"label": string, "construction": {}}], "flatActionDecision": {"prompt": string, "choices": [{"label": string, "isActionCommitment": boolean, "construction": {}}]}, "branches": [{"resultingWorldState": string, "escalationText": string, "tradeoffChoices": [{"label": string, "construction": {}}], "actionDecision": {"prompt": string, "choices": [{"label": string, "isActionCommitment": boolean, "construction": {}}]}}], "boundaryGrounding": []}',
    "",
    "CONSTRUCT EVERY CHOICE — each choice object (primary, flat tradeoff, flat action, and every branch tradeoff/action) carries its own `construction`: {\"legitimateValue\": the concrete value it protects, \"acceptedCost\": the real downside it accepts, \"competentIntent\": why a capable well-intentioned person could choose it, \"concreteAction\": what the person actually does, \"boundaryCompliance\": the confirmed boundary ids it obeys (empty when there are none), \"urgencySafetyBasis\": why any delay it introduces is safe (required whenever it waits, pauses or defers), \"whyNotDominated\": what it gives up that its sibling keeps, \"distinguishesFromSibling\": the different value/cost profile, not different wording}. This is internal metadata; never put it in a learner-facing label.",
    "If you cannot state a legitimate value and a real cost for an option, it is not a choice — replace it. Siblings may not share the same value/cost/intent profile. NEVER justify an option by concealment, deflection, stalling or false reassurance.",
    "NO VAGUE REASSURANCE: never offer an option that promises progress with no owner, action, threshold or next step, that says 'as soon as possible' or 'trust the timeline' while withholding what is known, that pacifies or deflects instead of deciding, or that asserts something the situation contradicts (claiming work is on schedule when it has already slipped). A concise update with clear ownership and a next checkpoint, a limited disclosure required by privacy or incomplete verification, and a pause that protects accuracy are all fine — they name an action and a basis.",
    "BRANCH PROGRESSION: inside each branch the tradeoff must pose a NEW question the primary choice did not answer, and the action decision must commit on a FURTHER new dimension. Never offer the same option twice in one branch, however reworded, and never re-open the primary decision.",
    "BRANCH DIVERSITY: each branch is the consequence of ITS OWN primary choice — a different resulting world, a different new pressure, a different next decision. If two branches could be swapped without becoming incoherent, the primary choice changed nothing. Do NOT make every branch about what to tell someone and when. A shared stakeholder is fine; a shared decision axis is not.",
    "BE CONCISE. Every field has a hard length limit and over-length output is REJECTED, never trimmed: a title is a short phrase, an opening is 2-4 sentences, a choice label is one readable line, an escalation is 1-3 sentences, and each `construction` field is one short clause. Write what a busy person would actually read.",
    "DO NOT invent any id field. You author the words; the server assigns every identifier.",
    "`branches` is an ARRAY, not an object. branches[i] is the continuation of primaryChoices[i] — the ORDER is the relationship. There are exactly two of each.",
    "isActionCommitment is REQUIRED on every action choice (true or false, never omitted) and marks the immediate-action option for INTERNAL use only — it must not read as the 'correct' option. At least one action choice in each actionDecision must be true.",
    "EXACTLY 2 primaryChoices. EXACTLY 2 flatTradeoffChoices. EXACTLY 2 choices in every actionDecision. EXACTLY 2 branches. EXACTLY 2 tradeoffChoices in every branch. Not three, not four — two. No empty labels. Set noSafeJudgmentSpace to false for a normal scenario. `boundaryGrounding` is an ARRAY — one entry per confirmed constraint, or [] when there are none. Ground everything in the training context and the two host answers; invent no real names, organizations, patient details, numbers, or private data.",
    ...urgencyLines,
    ...constraintLines,
  ].join("\n");
}

/** Minimal, PII-free structured context for the provider. */
function buildLlmMessages(input: ScenarioGenInput, constraints: PracticeBoundary["constraints"], retryFeedback = ""): LlmChatMessage[] {
  const { locale, facts, guided } = input;
  const system = buildGenerationSystemPrompt(locale, constraints);
  const contextLines = [
    facts.problem ? `Training problem: ${facts.problem}` : null,
    facts.observableBehavior ? `Expected observable behavior: ${facts.observableBehavior}` : null,
    facts.successEvidence ? `What success looks like: ${facts.successEvidence}` : null,
    facts.learningNeeds.length ? `Learning needs: ${facts.learningNeeds.join(", ")}` : null,
    `When it is hardest (host answer 1): ${hardestWhenPhrase(guided, locale)}`,
    `Pressure that makes people avoid it (host answer 2): ${guided.avoidancePressure.text}`,
  ].filter(Boolean);

  const user = retryFeedback.trim()
    ? `${contextLines.join("\n")}\n\n${retryFeedback.trim()}`
    : contextLines.join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

type LlmOutcome =
  | { ok: true; draft: ArenaScenarioDraft; warnings: string[]; constructions: Record<string, unknown> }
  | {
      ok: false;
      reason: "generation_failed" | "generation_rejected" | "no_safe_judgment_space" | "structured_output_unavailable";
      /** R2.23 — the ranked, aggregated finding set. Absent for Level 1/2 short-circuits. */
      rejection?: RejectionOutcome;
      /**
       * R5A — what the provider boundary actually observed. `generation_failed` was the one
       * reason that could mean four different things; this is the field that separates them, and
       * it is the only provider detail that leaves this function.
       */
      fault?: ProviderFault;
    };

/**
 * One bounded provider attempt. Distinguishes a TRANSPORT failure (no usable content —
 * generation_failed) from CONTENT returned but rejected (generation_rejected), and honors
 * the provider signalling that no safe judgment space exists. `constraints` are the CONFIRMED
 * structured rules; when present, the provider's per-choice `constraintAssessments` are
 * validated deterministically (then discarded — never persisted, never learner-facing).
 */
async function generateWithLlm(
  input: ScenarioGenInput,
  constraints: PracticeBoundary["constraints"],
  retryFeedback = "",
  /** R5C-2B — the submission's ONE accounting context. Absent for runner-only callers. */
  accounting?: GenerationAccounting | null,
): Promise<LlmOutcome> {
  // Built BEFORE the child row exists. A missing credential is not a provider call, and recording
  // one would corrupt the invocation count this whole table exists to make trustworthy.
  let client: ReturnType<typeof getLlmClient>;
  try {
    client = getLlmClient();
  } catch (e) {
    logGenOutcome("provider_error");
    return { ok: false, reason: "generation_failed", fault: { kind: "transport", category: categorizeThrown(e, false) } };
  }
  return withProviderCall(
    accounting,
    {
      kind: "generation",
      model: getLlmModel(),
      providerTimeoutMs: LLM_GEN_TIMEOUT_MS,
      maxTokens: LLM_GEN_MAX_TOKENS,
      temperature: LLM_GEN_TEMPERATURE,
      topP: LLM_GEN_TOP_P,
      structuredOutputMode: "json_schema_strict",
      locale: input.locale,
    },
    async (call) => generateWithLlmCall(client, call, input, constraints, retryFeedback),
  );
}

/** The instrumented body: exactly one provider call, with every exit naming that call's outcome. */
async function generateWithLlmCall(
  client: ReturnType<typeof getLlmClient>,
  call: ProviderCallScope,
  input: ScenarioGenInput,
  constraints: PracticeBoundary["constraints"],
  retryFeedback: string,
): Promise<LlmOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_GEN_TIMEOUT_MS);
  try {
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages: buildLlmMessages(input, constraints, retryFeedback),
        temperature: LLM_GEN_TEMPERATURE,
        top_p: LLM_GEN_TOP_P,
        max_tokens: LLM_GEN_MAX_TOKENS,
        // STRICT structured output (Slice 3.2I-R2.16). The provider-facing DTO is array-based
        // with no model-authored identifiers and no dynamic keys, so — unlike the canonical
        // shape — it CAN be expressed as a strict JSON Schema. A provider that rejects the
        // schema fails closed as `structured_output_unavailable`; it is never silently
        // downgraded to unconstrained JSON.
        response_format: {
          type: "json_schema",
          json_schema: { name: PROVIDER_SCHEMA_NAME, strict: true, schema: PROVIDER_SCENARIO_JSON_SCHEMA },
        },
      },
      { signal: controller.signal },
    );
    const choice = completion.choices[0];
    // ---- RESPONSE IDENTITY (R5C-2B Part 11) --------------------------------
    // Captured HERE: after extraction, before `stripJsonFences`, before `JSON.parse`, before any
    // normalization. The digest is of what the provider actually sent — not of what survived
    // parsing — so two calls are comparable even when only one of them parsed.
    const rawContent = choice?.message?.content ?? null;
    const finishReason = choice?.finish_reason ?? null;
    const usage = readCallUsage(completion);
    /** Name this CALL's outcome. Never a judgment about the content a later gate may refuse. */
    const settle = (outcome: CallOutcome, withContent = true) =>
      call.settle({ outcome, modelContent: withContent ? rawContent : null, finishReason, ...usage });

    // A provider refusal is an explicit safe refusal, never scenario content.
    if (choice?.message?.refusal) {
      // The envelope arrived, but carried no generated content to digest.
      await settle("empty_output", false);
      logGenOutcome("provider_refused", "provider_refusal", { finishReason: choice?.finish_reason });
      return { ok: false, reason: "generation_rejected", rejection: singleFinding("provider_refusal", "provider_envelope") };
    }
    // A truncated body is not malformed authoring — it is an output-budget failure. Parsing it
    // would report a misleading `malformed_shape`, so it is detected and named explicitly.
    if (choice?.finish_reason === "length") {
      await settle("malformed_output");
      logGenOutcome("provider_rejected", "truncated_output", { finishReason: choice?.finish_reason, rawLength: choice?.message?.content?.length });
      return { ok: false, reason: "generation_rejected", rejection: singleFinding("truncated_output", "provider_envelope") };
    }
    const raw = rawContent;
    if (!raw) {
      await settle("empty_output", false);
      logGenOutcome("provider_failed", "empty_output");
      // R5A — a 2xx with nothing usable in it is NOT the same event as an abort or a transport
      // rejection. Naming it here is what stops the three collapsing into one attempt outcome.
      return { ok: false, reason: "generation_failed", fault: { kind: "empty" } };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      await settle("malformed_output");
      logGenOutcome("provider_rejected", "malformed_shape", { finishReason: choice?.finish_reason, rawLength: raw.length, rawSample: raw.slice(-200) });
      return { ok: false, reason: "generation_rejected", rejection: singleFinding("malformed_shape", "provider_envelope") };
    }
    if (parsed && typeof parsed === "object" && (parsed as { noSafeJudgmentSpace?: unknown }).noSafeJudgmentSpace === true) {
      // The provider delivered the structured output it was asked for. That the answer is "no safe
      // judgment space" is a product decision about the case, not a failed call.
      await settle("success");
      logGenOutcome("no_safe_judgment_space");
      return { ok: false, reason: "no_safe_judgment_space" };
    }
    // PROVIDER DTO → CANONICAL. The model authored judgment content only; transport identity is
    // assigned here, deterministically, and ONLY after the DTO fully validates. An invalid
    // provider result can never reach canonicalization or persistence.
    const dto = validateProviderScenario(parsed);
    if (!dto.ok) {
      await settle("schema_invalid");
      logGenOutcome("provider_rejected", dto.errors[0], { finishReason: choice?.finish_reason, rawLength: raw.length });
      return { ok: false, reason: "generation_rejected", rejection: resolveRejection(dto.errors.map((code) => ({ code, gate: "provider_dto" })))! };
    }
    // ---- THE CALL SUCCEEDED (R5C-2B Part 6) --------------------------------
    // The provider returned extractable content and the structured output this site required.
    // Everything below is SERVER work — canonicalization, deterministic quality gates, boundary
    // grounding. If any of it refuses the scenario, that refusal belongs to the parent attempt's
    // attribution; this call still delivered what it was asked for and stays `success`.
    await settle("success");
    const canonical = canonicalizeProviderScenario(dto.value);
    // Re-validate the COMPLETED canonical object — canonicalization is never trusted blindly.
    const result = parseArenaScenarioDraft(canonical.draft);
    if (!result.ok) {
      logGenOutcome("provider_rejected", result.errors[0], { finishReason: choice?.finish_reason, rawLength: raw.length });
      return { ok: false, reason: "generation_rejected", rejection: resolveRejection(result.errors.map((code) => ({ code, gate: "canonical_validator" })))! };
    }
    // ---- LEVEL 3-6 — COLLECT, THEN RANK (R2.23) ---------------------------
    // Every deterministic content gate used to return on its own first error, so whichever ran
    // first owned the reported reason. c01's lying option was reported as
    // `construction_contradicts_label` because the construction gate precedes the measured-label
    // gate that names it `false_reassurance`; c09's repeated branch choice was reported as
    // `provider_low_quality` for the same reason. Both codes were true, only one survived, and the
    // retry saw one defect out of several.
    //
    // Now every applicable gate runs, findings are pooled, and `resolveRejection` picks the primary
    // code by documented precedence — so a boundary or safety finding can never be hidden behind a
    // lower-level quality code by execution order alone.
    const findings: Finding[] = [];
    const push = (gate: string, codes: string[]) => {
      for (const code of codes) findings.push({ code, gate });
    };
    for (const [gateName, gate] of [
      ["branched_quality", validateBranchedScenario(result.value)],
      ["concrete_scene", validateConcreteScene(result.value)],
      ["incident_specific", validateIncidentSpecific(result.value)],
      ["constraint_compliance", validateConstraintCompliance(result.value)],
    ] as const) {
      if (!gate.ok) push(gateName, gate.errors);
    }
    // BOUNDARY GROUNDING (R2.21). The per-choice assessment above only proves the model SAID
    // "satisfied" for every rule — its `status` enum cannot even express a violation.
    const grounding = validateBoundaryGrounding(canonical.boundaryGrounding, constraints, result.value);
    if (!grounding.ok) push("boundary_grounding", grounding.errors);
    // CHOICE CONSTRUCTION (R2.22) and the measured label rules.
    const factsText = factsTextOf(input);
    const construction = validateChoiceConstructions(result.value, canonical.constructionsByChoiceId, {
      constraintIds: constraints.map((c) => c.id),
      factsText,
    });
    if (!construction.ok) push("choice_construction", construction.errors);
    const measured = detectMeasuredLabelDefects(result.value, factsText);
    if (!measured.ok) push("measured_labels", measured.errors);

    const rejection = resolveRejection(findings);
    if (rejection) {
      logGenOutcome(`gate_level_${rejection.primaryLevel}`, rejection.primaryCode, {
        gate: rejection.primaryGate,
        level: rejection.primaryLevel,
        defectCodes: rejection.defectCodes,
        findings: rejection.findings,
        evidenceSources: rejection.evidenceSources,
      });
      return { ok: false, reason: "generation_rejected", rejection };
    }
    const qualityWarnings = validateBranchedScenario(result.value).warnings;
    return { ok: true, draft: result.value, warnings: [...result.warnings, ...qualityWarnings], constructions: canonical.constructionsByChoiceId };
  } catch (e) {
    // A telemetry failure is NOT a provider failure. It must never be classified as one, and it
    // must not be swallowed into a product result — the submission cannot be accounted for.
    if (isProviderCallTelemetryError(e)) throw e;
    const cls = classifyThrownCall(e, controller.signal.aborted);
    await call.settle({
      outcome: cls.outcome,
      providerHttpStatus: cls.providerHttpStatus,
      providerErrorCategory: cls.providerErrorCategory,
    });
    if (controller.signal.aborted) {
      logGenOutcome("provider_timeout");
      return { ok: false, reason: "generation_failed", fault: { kind: "timeout" } };
    }
    // A provider that cannot honour the strict schema must FAIL CLOSED. Downgrading to
    // unconstrained JSON here would silently restore the exact contract this slice removed.
    if (isStructuredOutputUnsupported(e)) {
      logGenOutcome("provider_rejected", "structured_output_unavailable");
      return { ok: false, reason: "structured_output_unavailable" };
    }
    // An HTTP response existed: keep its STATUS, never its body — an upstream error body can
    // quote the prompt back, which is the one thing telemetry must never hold.
    // Read the status STRUCTURALLY rather than by class. The transport error crosses a module
    // boundary, and an `instanceof` here would also force every existing test that mocks the llm
    // client to re-export the class — coupling telemetry to how the client happens to be built.
    const rawStatus = (e as { status?: unknown } | null)?.status;
    const status = typeof rawStatus === "number" && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : null;
    const fault: ProviderFault =
      status !== null ? { kind: "http", status } : { kind: "transport", category: categorizeThrown(e, false) };
    logGenOutcome("provider_error", status !== null ? categorizeHttpStatus(status) : undefined);
    return { ok: false, reason: "generation_failed", fault };
  } finally {
    clearTimeout(timer);
  }
}

export type SemanticReview = {
  ok: boolean;
  violations: Array<{ phase: string; choiceId?: string; constraintId: string; reason: string }>;
  noSafeJudgmentSpace: boolean;
};
type ReviewOutcome =
  | { kind: "ok"; boundaryEvidence: BoundaryEvidence[] }
  | {
      kind: "reject";
      defects: string[];
      choiceDefects: Array<{ index: number; codes: string[] }>;
      branchDefects: Array<{ index: number; codes: string[] }>;
      boundaryDefects: Array<{ boundaryId: string; statement: string; codes: string[] }>;
      urgencyDefects: Array<{ index: number; codes: string[] }>;
      /** R2.22 — exact phase/branch/choice coordinates for every all-phase defect. */
      phaseDefects: Array<{ phase: string; branchIndex: number; choiceIndex: number; codes: string[] }>;
      instruction: string;
    }
  | { kind: "no_safe_space"; reasonCode: string }
  /**
   * R2.25 — parsed cleanly, then disagreed with ITSELF. Split out of `malformed` because the two
   * demand opposite responses: a contradiction is recoverable by rerunning the reviewer over the
   * frozen scenario, while a truncated or unparseable response is an infrastructure problem that a
   * rerun would only guess at.
   */
  | { kind: "contradiction"; errors: string[]; evidence: ReviewEvidence }
  | { kind: "malformed"; errors: string[]; evidence?: ReviewEvidence }
  | { kind: "transport_failed" };

/**
 * Everything needed to identify the EXACT field that contradicted the verdict.
 *
 * R2.23D-R4 reduced a malformed review to `["review_verdict_contradicts_details"]` — 38 bytes — and
 * the derived defect list was discarded on the failure branch, so the contradicting field is
 * permanently unknowable for that run. Nothing is reduced before it is captured here.
 */
export type ReviewEvidence = {
  reviewAttempt: number;
  reviewSubjectSha256: string;
  /** R2.27 — the exact boundary projection this request carried, and how the reviewer covered it. */
  reviewRequestBoundaries?: Array<{ id: string; statement: string }>;
  boundaryIdsConsidered?: string[];
  boundaryAssessmentIds?: string[];
  boundaryCoverage?: { ok: boolean; codes: string[] };
  /** The parsed reviewer DTO, in full: per-choice, per-phase, per-branch, cross-branch, urgency, boundary. */
  parsed: unknown;
  overallVerdict: string | null;
  /** The defect list the server DERIVED from the reviewer's own detail fields. */
  derivedDefects: string[];
  consistency: "consistent" | "verdict_contradicts_details" | "reject_without_defect" | "invalid";
  finishReason: string | null;
  truncated: boolean;
  latencyMs: number;
  errors: string[];
};

/**
 * The reviewer contract, hoisted so it can be digested into the generation-contract manifest
 * (R2.23). It depends on no input, so its digest changes only when the contract itself changes.
 */
export const REVIEW_SYSTEM_PROMPT: string = [
  "You are a strict REVIEWER of a leadership DECISION-PRACTICE scenario. You EVALUATE only — never rewrite, never author replacement content.",
  "",
  "NO-SAFE-JUDGMENT CONTRACT (read carefully — this is the most misused field).",
  "Set noSafeJudgmentSpace=true ONLY when one of these is established:",
  "  (a) every plausible action would violate a CONFIRMED non-negotiable boundary → all_options_violate_confirmed_boundary;",
  "  (b) the learner is being asked to choose among unsafe or prohibited actions → prohibited_choice_only;",
  "  (c) a required safety boundary is unresolved and must be confirmed first → unresolved_boundary_requires_confirmation.",
  "Otherwise set noSafeJudgmentSpace=false with noSafeReasonCode=judgment_space_remains.",
  "A CONFIRMED RULE NARROWS THE CHOICE SPACE; IT DOES NOT ELIMINATE JUDGMENT. Legitimate judgment still remains when the learner can decide about sequencing, timing, communication, escalation, verification order, staffing, documentation, supervision, recovery, referral, delay management or resource allocation. In that case you MUST return false and list those dimensions in remainingJudgmentDimensions.",
  "Never claim no-safe merely because the decision is constrained, risky, clinical, urgent, or difficult.",
  "When noSafeJudgmentSpace=true, remainingJudgmentDimensions MUST be empty and violatedBoundaryIds or boundaryIdsConsidered must support the claim. When false, remainingJudgmentDimensions MUST be non-empty.",
  "",
  "DIFFICULT-CHOICE REVIEW — for EVERY primary choice, by array index, state the concrete legitimate value it protects and the real cost it accepts, and whether a competent, well-intentioned person could choose it.",
  "Mark defensible=false and give a defect code when a choice: protects no legitimate value (no_legitimate_value); depends on lying, concealment, negligence, bad faith or knowingly unsafe action (bad_faith_option, moral_decoy, unsafe_option); is vague evasion (vague_evasion); accepts no real cost so it dominates the alternatives (dominated_choice); reads as the intended answer (obvious_correct_answer); or merely duplicates another option's tradeoff (duplicate_tradeoff).",
  "A dilemma framed as honesty versus concealment, responsibility versus irresponsibility, or care versus indifference is ALWAYS defective — flag moral_decoy.",
  "Also report whether two legitimate values are genuinely in tension, naming both.",
  "",
  "BRANCH REVIEW — for EVERY branch, by array index, the branch is the world AFTER that primary choice was already made.",
  "State: what the learner already chose, the resulting world state, the new concrete constraint or pressure it introduced, and the NEXT decision dimension it creates.",
  "Set repeatsPrimaryDecision=true when the branch asks the learner to decide the SAME question the primary choice already answered (for example: primary asked 'notify now vs verify first' and the branch asks it again).",
  "Set overlapsOtherBranchIndex to the index of any sibling branch whose consequence or next decision means the same thing (synonyms and reordered wording still count as the same); otherwise -1. Set branchDistinct accordingly.",
  "",
  "",
  "ALL-PHASE CHOICE REVIEW — return ONE phaseChoices entry for EVERY entry in visibleChoices, matched by phase + branchIndex + choiceIndex, exactly once, and none that is not there. A good primary choice does NOT license a defective tradeoff or action: the same standard applies to primary, flat tradeoff, flat action, branch tradeoff and branch action alike.",
  "For each: the legitimate value it protects, the real cost it accepts, whether a competent well-intentioned person could choose it, whether it names a concrete action, and whether it is dominated by a sibling, bad faith, vague reassurance, a non-commitment decoy, or unsafe.",
  "Each visibleChoices entry carries the generator's own `construction` record. You must CONFIRM or DISPUTE it: set constructionAgrees=false and say what you dispute in constructionDispute when the claimed value, cost or intent is not actually true of the visible label. Never inherit it silently.",
  "",
  "VAGUE REASSURANCE — a response that reduces a stakeholder's concern without making a real decision. Set vagueReassurance=true when an option promises progress with no owner, action, threshold or next step; says 'soon', 'as soon as possible' or 'trust the timeline' while withholding actionable information; pacifies or deflects instead of deciding; or delays responsibility without protecting a legitimate value. Use false_reassurance when it asserts something the situation contradicts (for example claiming work is on schedule after the schedule has already slipped).",
  "Set nonCommitmentDecoy=true for an option that exists only to be rejected — waiting or deferring with no stated cost and no protected value.",
  "Do NOT flag: a concise update with clear ownership and a next checkpoint; a deliberately limited disclosure required by privacy or incomplete verification; a temporary communication plan with an explicit action and threshold; or a justified pause that protects accuracy or safety. Those are legitimate strategies.",
  "",
  "SAME-BRANCH PROGRESSION — a branch runs: primary choice already made → resulting world → tradeoff decision → action commitment. For each branch state tradeoffDecisionDimension and actionDecisionDimension, and whether each phase actually advances the scenario. List in repeatedMeaningPairs any two choices in that branch that MEAN the same thing, even when worded differently. Set progressionValid=false when the tradeoff re-asks the primary question, the action re-asks the tradeoff, a later phase reverses the primary decision without a new causal event, or the action phase contains no commitment.",
  "",
  "CROSS-BRANCH CAUSAL DIVERSITY — each branch must be the consequence of a DIFFERENT primary choice. For each branch state selectedPrimaryEffect, affectedStakeholders, resourceOrRelationshipChange, causalLink, boundaryState and urgencyState. Then in crossBranch report overlapping resulting worlds, overlapping next-decision axes, overlapping stakeholders and repeated action meanings as index pairs like '0-1'.",
  "Set branchesInterchangeable=true when branch content could be swapped between primary choices without becoming incoherent. Set allBranchesSameGenericAxis=true when every branch reduces to one generic problem — most often 'what do we tell people, and when'.",
  "A SHARED STAKEHOLDER IS NOT A DEFECT: the same client or manager may appear in every branch when the causal state and the next decision genuinely differ. Do not demand vocabulary variety; demand causal difference.",
  "",
  "CONFIRMED-BOUNDARY GROUNDING — return ONE boundaryAssessments entry for EVERY confirmed boundary id you were given, exactly once, and never an id you were not given.",
  "SILENCE ABOUT A RULE IS NOT COMPLIANCE. Judge each boundary on two separate questions:",
  "  presentInScenario — is the rule actually established in the learner-facing text (opening or immediate context), in natural language, so the learner knows it holds? A rule that appears nowhere is ABSENT, however compliant the choices happen to be: set false and use confirmed_boundary_absent.",
  "  operationalized — does the rule CHANGE the decisions? Ask: if this rule were deleted, would the scenario still read exactly the same? If yes it is decorative — set false and use boundary_not_operationalized or vacuous_boundary_compliance.",
  "List in affectedStages every stage the rule actually constrains. A rule that affects only the opening and no decision stage is vacuous.",
  "Then check compliance stage by stage: allPrimaryChoicesComply, allTradeoffChoicesComply, allActionChoicesComply, allBranchesPreserve. Name the offending labels in violatedChoiceReferences / violatedBranchReferences and use choice_bypasses_boundary, action_reopens_boundary or branch_drops_boundary. A branch that quietly stops honouring the rule after the primary consequence is branch_drops_boundary.",
  "prohibitedAlternativeExcluded — is the tempting non-compliant option visibly OFF the table rather than offered as a choice? If the rule reads as advisory, set false.",
  "remainingJudgmentDimensions — name the judgment that genuinely survives inside the rule (sequencing, notification order, staffing, escalation, supervision, documentation, delay recovery, resource allocation…). This must be non-empty whenever a scenario is expected.",
  "",
  "URGENCY SAFETY — you are NOT choosing clinical treatment and must not invent medical guidance. You are judging whether LEADERSHIP choices respect safety and escalation boundaries.",
  "Set urgencyPresent only when the situation itself carries time-sensitive harm, and name urgencySource. If there is no urgency, set urgencyPresent=false, timeSensitiveHarmPossible=false, leave every foreseeableHarm empty and set overallUrgencyVerdict='not_applicable'. NEVER fabricate clinical or safety risk that the situation does not contain.",
  "For EVERY primary choice by index: does it introduce delay, what is the delay FOR, what SAFETY OR VERIFICATION BASIS makes it legitimate, what concrete foreseeable harm it creates, whether it uses escalation, and whether a competent leader could responsibly choose it.",
  "REJECT a choice that knowingly delays urgent action for convenience (unsafe_delay, convenience_over_safety), creates avoidable foreseeable deterioration (avoidable_foreseeable_harm), substitutes vague reassurance for operational action, leaves an unsafe capacity situation un-escalated (missing_required_escalation), or treats a confirmed safety rule as optional (boundary_treated_as_optional).",
  "ACCEPT a choice that takes a short operational pause REQUIRED by a confirmed safety rule, escalates staffing while preserving the rule, redirects or refers when safe capacity is unavailable, seeks supervision, or sequences work so both the urgency and the mandatory check are honoured. Time cost alone is NOT a defect — do not mark a required safety pause unsafe merely because it takes time.",
  "",
  "overallVerdict='accept' ONLY when EVERY visible choice at EVERY phase is defensible, no branch loops or repeats a decision, no branch is interchangeable with a sibling, every confirmed boundary is PRESENT and OPERATIONALIZED and obeyed at every stage, and no choice is an unsafe delay or vague reassurance. Otherwise 'reject', with exact defectCodes and a short retryInstruction saying what must change. Your verdict must not contradict your own detail fields.",
  "Return ONLY the JSON object required by the schema.",
].join("\n");

/**
 * Independent SEMANTIC constraint review (Slice 3.2I-R4) — a second provider pass that reads
 * only the confirmed constraints + the candidate's learner-facing text and returns structured
 * JSON. It catches INDIRECT / implied violations the lexical gate cannot. Its output never
 * reaches the learner. Distinguishes transport failure from a malformed/violating verdict.
 */
async function reviewConstraintCompliance(
  input: ScenarioGenInput,
  constraints: PracticeBoundary["constraints"],
  draft: ArenaScenarioDraft,
  constructions: Record<string, unknown> = {},
  /** R2.25 — the frozen subject both attempts share, and which attempt this is. */
  subject?: { sha256: string; attempt: number },
  /** R5C-2B — the submission's ONE accounting context. Absent for runner-only callers. */
  accounting?: GenerationAccounting | null,
): Promise<ReviewOutcome> {
  let client: ReturnType<typeof getLlmClient>;
  try {
    client = getLlmClient();
  } catch {
    // No credential means no call was made; no child row may claim otherwise.
    return { kind: "transport_failed" };
  }
  return withProviderCall(
    accounting,
    {
      kind: "semantic_review",
      model: getLlmModel(),
      providerTimeoutMs: LLM_REVIEW_TIMEOUT_MS,
      maxTokens: LLM_REVIEW_MAX_TOKENS,
      temperature: LLM_REVIEW_TEMPERATURE,
      topP: LLM_REVIEW_TOP_P,
      structuredOutputMode: "json_schema_strict",
      locale: input.locale,
    },
    async (call) => reviewConstraintComplianceCall(client, call, input, constraints, draft, constructions, subject),
  );
}

/** The instrumented body: exactly one semantic-review provider call. */
async function reviewConstraintComplianceCall(
  client: ReturnType<typeof getLlmClient>,
  call: ProviderCallScope,
  input: ScenarioGenInput,
  constraints: PracticeBoundary["constraints"],
  draft: ArenaScenarioDraft,
  constructions: Record<string, unknown>,
  subject?: { sha256: string; attempt: number },
): Promise<ReviewOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_REVIEW_TIMEOUT_MS);
  const startedAt = Date.now();
  const subjectSha = subject?.sha256 ?? "";
  const reviewAttempt = subject?.attempt ?? 1;
  try {
    const system = REVIEW_SYSTEM_PROMPT;
    // R2.27 — the ACTIVE boundary projection, with its count made explicit so the reviewer cannot
    // silently answer about a subset. The judgment instructions themselves are unchanged.
    // R2.29 Part 15 — built by the SHARED projection, so the replay path cannot drift from it again.
    const activeBoundaries = constraints.map((c) => ({ id: c.id, statement: c.statement }));
    const payload = buildBroadReviewRequest(draft, activeBoundaries, constructions);
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: serializeBroadReviewRequest(payload) },
        ],
        temperature: LLM_REVIEW_TEMPERATURE,
        top_p: LLM_REVIEW_TOP_P,
        max_tokens: LLM_REVIEW_MAX_TOKENS,
        response_format: {
          type: "json_schema",
          json_schema: { name: SEMANTIC_REVIEW_SCHEMA_NAME, strict: true, schema: SEMANTIC_REVIEW_JSON_SCHEMA },
        },
      },
      { signal: controller.signal },
    );
    const rc = completion.choices[0];
    // R2.22 — the reviewer schema grew with the all-phase contract. A truncated verdict must be
    // named, not parsed and misreported as unstructured nonsense.
    const finishReason = rc?.finish_reason ?? null;
    const evidence = (over: Partial<ReviewEvidence>): ReviewEvidence => ({
      reviewAttempt,
      reviewSubjectSha256: subjectSha,
      reviewRequestBoundaries: activeBoundaries,
      parsed: null,
      overallVerdict: null,
      derivedDefects: [],
      consistency: "invalid",
      finishReason,
      truncated: finishReason === "length",
      latencyMs: Date.now() - startedAt,
      errors: [],
      ...over,
    });
    // Response identity captured after extraction, before fence-stripping and parsing.
    const rawContent = rc?.message?.content ?? null;
    const usage = readCallUsage(completion);
    const settle = (outcome: CallOutcome, withContent = true) =>
      call.settle({ outcome, modelContent: withContent ? rawContent : null, finishReason, ...usage });

    if (finishReason === "length") {
      await settle("malformed_output");
      return { kind: "malformed", errors: ["review_truncated"], evidence: evidence({ errors: ["review_truncated"] }) };
    }
    const raw = rawContent;
    if (!raw) {
      await settle("empty_output", false);
      return { kind: "transport_failed" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      await settle("malformed_output");
      return { kind: "malformed", errors: ["review_not_json"], evidence: evidence({ errors: ["review_not_json"] }) };
    }
    const branchCount = Object.keys(draft.branches ?? {}).length;
    const v = validateSemanticReview(parsed, {
      primaryCount: draft.primary.choices.length,
      branchCount,
      constraintIds: constraints.map((c) => c.id),
      // R2.22 — the real visible-choice inventory. "Reviewed exactly once" is measured against it,
      // so a review that skipped the tradeoff or action phase can no longer accept.
      choices: enumerateChoices(draft),
    });
    // ---- THE CALL'S OUTCOME (R5C-2B Part 10) -------------------------------
    // `validateSemanticReview` IS this site's required-output check. Passing it means the provider
    // delivered the structured verdict it was asked for — so `reject`, `no_safe` and an
    // inconclusive verdict are all `success`, and only the parent names the refusal. Failing it
    // means the structured output was not the one required, which is a call-level failure.
    await settle(v.ok ? "success" : "schema_invalid");
    // A contradictory or unsupported review is NOT a safety outcome — it is a broken review.
    // R2.25 splits the two responses it can deserve. Everything is captured BEFORE reduction.
    // R2.27 — did the reviewer answer about EXACTLY the active set? Coverage only; whether its
    // judgment is right is a separate question this slice deliberately does not touch.
    const dto = (v.ok ? v.value : v.value) as { boundaryIdsConsidered?: string[]; boundaryAssessments?: Array<{ boundaryId?: string }> } | undefined;
    const considered = dto?.boundaryIdsConsidered ?? [];
    const assessmentIds = (dto?.boundaryAssessments ?? []).map((a) => String(a?.boundaryId ?? ""));
    const coverage = checkBoundaryCoverage(activeBoundaries.map((b) => b.id), considered, assessmentIds);
    const coverageEvidence = {
      boundaryIdsConsidered: considered,
      boundaryAssessmentIds: assessmentIds,
      boundaryCoverage: coverage.ok ? { ok: true, codes: [] as string[] } : { ok: false, codes: coverage.codes as string[] },
    };

    if (!v.ok) {
      const ev = evidence({
        ...coverageEvidence,
        parsed: v.value ?? parsed,
        overallVerdict: (v.value?.overallVerdict as string | undefined) ?? null,
        derivedDefects: v.derivedDefects ?? [],
        consistency:
          v.errors[0] === "review_verdict_contradicts_details"
            ? "verdict_contradicts_details"
            : v.errors[0] === "review_reject_without_defect"
              ? "reject_without_defect"
              : "invalid",
        errors: v.errors,
      });
      // Parsed cleanly and disagreed with itself → rerunnable. Anything else → infrastructure.
      return isContradiction(v.errors)
        ? { kind: "contradiction", errors: v.errors, evidence: ev }
        : { kind: "malformed", errors: v.errors, evidence: ev };
    }
    if (v.verdict === "no_safe") return { kind: "no_safe_space", reasonCode: v.reasonCode };
    if (v.verdict === "reject") {
      return {
        kind: "reject",
        defects: v.defects,
        choiceDefects: v.value.primaryChoices
          .filter((c) => !c.defensible || c.defectCodes.length > 0)
          .map((c) => ({ index: c.index, codes: c.defectCodes.length ? c.defectCodes : ["bad_faith_option"] })),
        branchDefects: v.value.branches
          .filter((b) => b.repeatsPrimaryDecision || !b.branchDistinct || b.defectCodes.length > 0)
          .map((b) => ({
            index: b.index,
            codes: [
              ...(b.repeatsPrimaryDecision ? ["branch_repeats_primary"] : []),
              ...(!b.branchDistinct || b.overlapsOtherBranchIndex >= 0 ? ["branch_semantic_collapse"] : []),
              ...b.defectCodes,
            ],
          })),
        boundaryDefects: v.value.boundaryAssessments
          .map((b) => {
            const codes = [
              ...(!b.presentInScenario ? ["confirmed_boundary_absent"] : []),
              ...(!b.operationalized ? ["boundary_not_operationalized"] : []),
              ...(!b.allPrimaryChoicesComply || !b.allTradeoffChoicesComply || b.violatedChoiceReferences.length > 0 ? ["choice_bypasses_boundary"] : []),
              ...(!b.allActionChoicesComply ? ["action_reopens_boundary"] : []),
              ...(!b.allBranchesPreserve || b.violatedBranchReferences.length > 0 ? ["branch_drops_boundary"] : []),
              ...(!b.prohibitedAlternativeExcluded ? ["boundary_treated_as_optional"] : []),
              ...b.defectCodes,
            ];
            // The CONFIRMED statement, never the reviewer's or the model's restatement — a retry must
            // not be able to narrow the rule the Manager actually confirmed.
            const statement = constraints.find((c) => c.id === b.boundaryId)?.statement ?? "";
            return { boundaryId: b.boundaryId, statement, codes: [...new Set(codes)] };
          })
          .filter((b) => b.codes.length > 0),
        urgencyDefects: v.value.urgency.choices
          .map((c) => ({
            index: c.index,
            codes: [
              ...new Set([
                ...(c.introducesDelay && !c.safetyBasis.trim() ? ["unsafe_delay"] : []),
                ...(c.foreseeableHarm.trim() && !c.safetyBasis.trim() ? ["avoidable_foreseeable_harm"] : []),
                ...(!c.defensible && c.defectCodes.length === 0 ? ["unsafe_delay"] : []),
                ...c.defectCodes,
              ]),
            ],
          }))
          .filter((c) => c.codes.length > 0),
        phaseDefects: v.value.phaseChoices
          .map((c) => {
            const codes = new Set<string>(c.defectCodes);
            if (c.badFaith) codes.add("bad_faith_option");
            if (c.dominatedBySibling) codes.add("dominated_choice");
            if (c.unsafe) codes.add("unsafe_option");
            if (c.vagueReassurance) codes.add("vague_reassurance");
            if (c.nonCommitmentDecoy) codes.add("non_commitment_decoy");
            if (!c.actionable) codes.add("vague_evasion");
            return { phase: c.phase, branchIndex: c.branchIndex, choiceIndex: c.choiceIndex, codes: [...codes] };
          })
          .filter((c) => c.codes.length > 0),
        instruction: v.value.retryInstruction ?? "",
      };
    }
    return { kind: "ok", boundaryEvidence: v.value.boundaryAssessments };
  } catch (e) {
    // A telemetry failure is not a transport failure and must not be reported as one.
    if (isProviderCallTelemetryError(e)) throw e;
    const cls = classifyThrownCall(e, controller.signal.aborted);
    await call.settle({
      outcome: cls.outcome,
      providerHttpStatus: cls.providerHttpStatus,
      providerErrorCategory: cls.providerErrorCategory,
    });
    return { kind: "transport_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Max provider calls per generation: 2 generations + 2 reviews (1 regen on a correctable reject). */
const MAX_GENERATION_ATTEMPTS = PRACTICE_SAMPLING.retry.maxAttempts;

/**
 * KNOW-only classification kept for back-compat. True iff eligibility is `know_only`.
 */
export function isFixedAnswerTraining(facts: ModuleSourceFacts): boolean {
  return eligibilityOf(facts).kind === "know_only";
}

/**
 * Decide the generation authority from the Manager-CONFIRMED boundary, falling back to
 * free-text eligibility ONLY to block-until-confirmed (Slice 3.2I-R4). A confirmed boundary
 * always overrides inference. Pure w.r.t. its inputs.
 */
type DeclineReason =
  | "fixed_answer_knowledge"
  | "boundary_confirmation_required"
  | "safety_boundary_unresolved"
  /** R2.23C — the Host must scope 4+ confirmed rules down to at most three ACTIVE ones. */
  | "practice_boundary_scope_required"
  | "too_many_active_boundaries"
  | "unknown_active_boundary"
  | "missing_required_active_boundary"
  | "active_boundary_set_changed"
  | "boundary_scope_not_confirmed"
  /** R2.25 — the reviewer failed twice over an identical frozen subject; content never judged. */
  | "reviewer_terminal_failure";
/**
 * R2.27 — the canonical input is the ONLY thing entitled to say "no boundaries apply".
 *
 * Every `generate` result now carries an explicit provenance record, so downstream code never has
 * to interpret an empty array. `sourceSha256` digests the canonical input that authorised the
 * answer, which is what makes the claim checkable later.
 */
function inputSourceDigest(input: ScenarioGenInput): string {
  return provenanceSha256(JSON.stringify({ facts: input.facts, guided: input.guided, boundary: input.boundary ?? null, scope: input.boundaryScope ?? null }));
}

function resolveAuthority(
  input: ScenarioGenInput,
): { kind: "decline"; reason: DeclineReason } | { kind: "generate"; constraints: PracticeBoundary["constraints"]; provenance: BoundaryReviewProvenance } {
  const boundary = input.boundary;
  const src = inputSourceDigest(input);
  const ref = boundary?.mode ? `boundary:${boundary.mode}` : "boundary:none";
  if (boundary && boundary.confirmed) {
    if (boundary.mode === "knowledge_check") return { kind: "decline", reason: "fixed_answer_knowledge" };
    // `judgment` mode is a POSITIVE statement that no confirmed rule constrains this practice.
    if (boundary.mode === "judgment") return { kind: "generate", constraints: [], provenance: noBoundaryProvenance(ref, src) };
    // R2.23C — ACTIVE boundaries for THIS situation. With 4+ confirmed the Host must choose at most
    // three; the system never picks a default set, never merges and never silently drops a rule the
    // Manager confirmed. Every unselected rule stays available for another Practice situation.
    const scoped = resolveActiveBoundaries(boundary, input.boundaryScope);
    if (scoped.kind === "scope_required") return { kind: "decline", reason: scoped.code };
    return {
      kind: "generate",
      constraints: scoped.constraints,
      provenance: buildBoundaryProvenance({
        // `judgment_with_constraints` DECLARES that confirmed rules apply. An empty constraint list
        // under that mode is a contradiction, not a no-boundary case, and must fail closed.
        declaredBearing: true,
        // The AVAILABLE set is every confirmed rule, not just the active subset — dropping it is
        // how "the Host narrowed this" became indistinguishable from "a rule went missing".
        available: boundary.constraints,
        activeIds: scoped.constraints.map((c) => c.id),
        scopeConfirmed: input.boundaryScope?.confirmed ?? boundary.constraints.length <= MAX_ACTIVE_BOUNDARIES,
        sourceKind: input.boundaryScope?.confirmed ? "host_confirmed_scope" : "canonical_case_input",
        sourceReference: ref,
        sourceSha256: src,
      }),
    };
  }
  // No confirmed boundary → free-text classifier only blocks/allows, never authors constraints.
  const eligibility = eligibilityOf(input.facts);
  if (eligibility.kind === "know_only") return { kind: "decline", reason: "fixed_answer_knowledge" };
  if (eligibility.kind === "judgment_only") return { kind: "generate", constraints: [], provenance: noBoundaryProvenance(ref, src) };
  // mixed_with_non_negotiables or unresolved → a possible boundary exists but is NOT confirmed.
  return { kind: "decline", reason: "boundary_confirmation_required" };
}

/**
 * Generate one live, branch-aware, incident-specific, CONSTRAINT-SAFE draft — LIVE MODEL
 * ONLY (Slice 3.2I). The Manager-confirmed boundary is the generation authority; an
 * unconfirmed possible boundary blocks (boundary_confirmation_required). Confirmed
 * constraints are passed exactly, enforced on the output (lexical + per-choice assessment),
 * and proven by an independent semantic review. Bounded to `MAX_GENERATION_ATTEMPTS`
 * generation + review cycles. Never returns a generic deterministic scenario.
 */
export async function generateArenaScenarioDraft(
  input: ScenarioGenInput,
  /**
   * R5C-2B — the submission's ONE provider-call accounting context, created by the caller AFTER the
   * parent attempt row is durable. All four call sites below share it, so a single global sequence
   * describes the real execution order across generation, boundary review, repair and semantic
   * review. Runner-only callers pass nothing and create no child rows.
   */
  accounting?: GenerationAccounting | null,
): Promise<GenerationResult> {
  const authority = resolveAuthority(input);
  if (authority.kind === "decline") {
    logGenOutcome("declined", authority.reason);
    return { ok: false, reason: authority.reason };
  }
  if (!isLlmAvailable()) {
    logGenOutcome("unavailable");
    return { ok: false, reason: "generation_unavailable" };
  }
  const constraints = authority.constraints;
  const boundaryProvenance = authority.provenance;

  /** Defect-specific correction appended to the SECOND request. Empty on the first attempt. */
  let retryFeedback = "";
  /** The correction packet the second attempt received — recorded as evidence, with its digest. */
  let lastPacket: CorrectionPacket | null = null;
  /** R2.29 — narrow boundary-review counters, accumulated across generation attempts. */
  let boundaryMetrics: BoundaryReviewMetrics = emptyBoundaryMetrics();

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const llm = await generateWithLlm(input, constraints, retryFeedback, accounting);
    if (!llm.ok) {
      // Transport / no-safe-space are terminal; a correctable rejection may regenerate once.
      // A capability gap is terminal — retrying the same unsupported schema cannot succeed, and
      // must never be retried as unconstrained JSON.
      if (
        llm.reason === "generation_failed" ||
        llm.reason === "no_safe_judgment_space" ||
        llm.reason === "structured_output_unavailable"
      ) {
        return { ok: false, reason: llm.reason, fault: llm.fault, rejectionCodes: llm.rejection?.findings?.map((f) => f.code) };
      }
      if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected" };
      // R2.21 — a deterministic grounding failure carries actionable, boundary-specific correction
      // into the single retry. Without it the second request repeats the first, which is exactly how
      // an ungrounded scenario used to "recover" into another ungrounded one.
      // R2.23 — ONE ordered correction packet from the ranked findings, so the second attempt
      // receives every actionable defect rather than whichever gate happened to run first.
      if (llm.rejection) {
        const packet = buildCorrectionPacket(attempt, llm.rejection.primaryCode, llm.rejection.findings, immutableContext(input, constraints));
        lastPacket = packet;
        retryFeedback = renderCorrectionPacket(packet);
        logGenOutcome("correction_packet", llm.rejection.primaryCode, {
          correctionPacketSha256: packetDigest(packet),
          defectCodes: packet.defectCodes,
          ...(genCaptureContent ? { correctionPacket: packet } : {}),
        });
      }
      continue;
    }
    // SEMANTIC REVIEW — R2.18: runs for EVERY generation, not only constrained ones.
    // c01 (honesty-vs-concealment) and c09 (branches re-asking the primary question) both carried
    // NO confirmed constraints, so under the old `constraints.length > 0` gate neither was ever
    // semantically reviewed — the deterministic gates passed both. That gap, not model luck, is
    // why defective content reached a green run.
    let reviewEvidence: BoundaryEvidence[] = [];
    {
      // ---------------------------------------------------------------------
      // R2.25 — FREEZE THE SUBJECT, THEN REVIEW IT (at most twice).
      //
      // The scenario, the confirmed boundaries, the active scope and the review contract are frozen
      // here and digested. Both review attempts must carry the same `reviewSubjectSha256`, so a
      // "recovered" verdict is provably a verdict about the same thing.
      // ---------------------------------------------------------------------
      const contract = buildReviewSubjectContract();
      const frozen: ReviewSubject = {
        scenario: llm.draft,
        scenarioSha256: scenarioDigest(llm.draft),
        generationAttemptId: `gen${attempt}`,
        // No case id exists on the generation input, so the case is identified by a digest of the
        // source facts — the thing that actually determines which scenario this is.
        caseId: scenarioDigest(input.facts),
        boundaryProvenance,
        confirmedBoundaries: constraints.map((c) => ({ id: c.id, statement: c.statement })),
        activeBoundaryIds: constraints.map((c) => c.id),
        language: input.locale,
        generationModel: getLlmModel(),
        generationSampling: PRACTICE_SAMPLING.generation,
        generationFinishReason: null,
        canonicalValidatorResult: llm.warnings ?? null,
        deterministicGateResult: null,
        reviewContractSha256: contract.sha256,
      };
      const subjectSha = reviewSubjectSha256(frozen);
      const provenanceSha = boundaryProvenanceSha256(boundaryProvenance);
      logGenOutcome("review_subject_frozen", undefined, {
        reviewSubjectSha256: subjectSha,
        scenarioSha256: frozen.scenarioSha256,
        reviewContractSha256: contract.sha256,
        boundaryProvenanceSha256: provenanceSha,
        boundaryProvenance,
        ...captured({ scenario: llm.draft }),
      });

      // ---------------------------------------------------------------------
      // R2.27 — FAIL CLOSED BEFORE THE REVIEWER REQUEST IS BUILT.
      //
      // R2.26 measured a boundary-bearing c18 subject reaching the reviewer with an empty rule set:
      // the reviewer answered `boundaryIdsConsidered: []`, every boundary derivation was inert, and
      // the accept looked like a reviewer verdict when the question had never been asked. This gate
      // runs before the request is constructed and before any provider call, so a boundary failure
      // can never be spent as a review call or mistaken for a model failure.
      // ---------------------------------------------------------------------
      const authorityCheck = assertReviewBoundaryAuthority(boundaryProvenance, provenanceSha);
      if (!authorityCheck.ok) {
        logGenOutcome("review_boundary_authority_failed", authorityCheck.codes[0], {
          reviewSubjectSha256: subjectSha,
          boundaryProvenanceSha256: provenanceSha,
          boundaryProvenance,
          defectCodes: authorityCheck.codes,
          ...captured({ scenario: llm.draft }),
        });
        return { ok: false, reason: "review_boundary_authority_failed" };
      }

      // ---------------------------------------------------------------------
      // R2.29 — NARROW BOUNDARY REVIEW FIRST. THE BROAD REVIEWER IS SECONDARY.
      //
      // R2.28 measured the broad reviewer receiving `c1_verify`, writing "One patient is treated
      // without verification, risking safety" into its own detail fields, and returning
      // `boundaryCompliant: true` with `overallVerdict: accept`. Four booleans carried fourteen
      // choices and nothing carried the two resulting world states, so no derivation could see it.
      //
      // The narrow stage asks one question per (boundary × surface) pair, requires a same-surface
      // evidence excerpt for every answer, and derives the verdict on the SERVER. The broad reviewer
      // does not run at all unless this passes, so it can never convert a boundary reject into an
      // accept.
      // ---------------------------------------------------------------------
      const boundaryStage = await runBoundaryReviewStage(
        {
          // R2.52 — `surfaceRefs` is no longer dropped, and the ONE permitted repair is the field
          // PATCH reviewer. R2.51 measured this caller supplying neither.
          // R5C-2B — the SAME accounting context reaches both boundary call sites through these
          // closures, so `boundary_review` and `boundary_repair` count independently while sharing
          // the submission's one global sequence. The stage itself is untouched.
          review: (s, a, surfaceRefs) => reviewBoundarySurfaces(s, a, surfaceRefs, undefined, accounting),
          repair: (s, plan, a) => reviewFieldRepair(s, plan, a, undefined, accounting),
          log: (outcome, code, extra) => logGenOutcome(outcome, code, extra),
        },
        {
          draft: llm.draft,
          constructions: llm.constructions,
          boundaries: frozen.confirmedBoundaries,
          boundaryProvenance,
          boundaryProvenanceSha256: provenanceSha,
          scenarioSha256: frozen.scenarioSha256,
          reviewSubjectSha256: subjectSha,
          language: input.locale,
          generationAttemptId: `gen${attempt}`,
          caseId: frozen.caseId,
        },
      );
      boundaryMetrics = accumulateBoundaryMetrics(boundaryMetrics, boundaryStage);
      logGenOutcome("boundary_review_stage", boundaryStage.codes[0], {
        reviewSubjectSha256: subjectSha,
        boundaryProvenanceSha256: provenanceSha,
        boundaryMode: boundaryProvenance.boundaryMode,
        boundaryReviewOutcome: boundaryStage.outcome,
        boundaryReviewSubjectSha256: boundaryStage.boundaryReviewSubjectSha256 ?? undefined,
        surfaceMapSha256: boundaryStage.surfaceMapSha256 ?? undefined,
        boundaryReviewCalls: boundaryStage.calls,
        boundaryReviewReruns: boundaryStage.reruns,
        boundaryMetrics,
        broadReviewStarted: boundaryStage.broadReviewAllowed,
        ...(genCaptureContent ? { boundaryReviewEvidence: boundaryStage.evidences, violations: boundaryStage.violations, uncertainties: boundaryStage.uncertainties } : {}),
      });

      if (boundaryStage.outcome === "boundary_review_reject") {
        // A GROUNDED violation is a generator content defect. The server authors the correction from
        // the per-surface findings; the reviewer never writes a retry instruction.
        const resolved = resolveRejection(boundaryStage.findings)!;
        const packet = buildCorrectionPacket(attempt, resolved.primaryCode, resolved.findings, immutableContext(input, constraints));
        const fb = renderCorrectionPacket(packet);
        lastPacket = packet;
        logGenOutcome(`gate_level_${resolved.primaryLevel}`, resolved.primaryCode, {
          gate: resolved.primaryGate,
          level: resolved.primaryLevel,
          defectCodes: resolved.defectCodes,
          findings: resolved.findings,
          evidenceSources: resolved.evidenceSources,
          correctionPacketSha256: packetDigest(packet),
          boundaryReviewSubjectSha256: boundaryStage.boundaryReviewSubjectSha256 ?? undefined,
          ...captured({ scenario: llm.draft, retryFeedback: fb }),
          ...(genCaptureContent ? { correctionPacket: packet, violations: boundaryStage.violations } : {}),
        });
        // R5C-1 — name the gate; without it this is indistinguishable from a quality refusal.
        if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected", rejectionGate: resolved.primaryGate, rejectionPrimaryCode: resolved.primaryCode, rejectionCodes: resolved.defectCodes };
        retryFeedback = fb;
        continue;
      }
      if (boundaryStage.outcome === "boundary_review_inconclusive") return { ok: false, reason: "boundary_review_inconclusive" };
      if (boundaryStage.outcome === "boundary_reviewer_terminal_failure") return { ok: false, reason: "boundary_reviewer_terminal_failure" };
      if (boundaryStage.outcome === "boundary_review_authority_failure") return { ok: false, reason: "boundary_review_authority_failure" };

      let review: ReviewOutcome | null = null;
      let terminal: { reason: GenerationFailureReason } | null = null;
      const reviewEvidences: ReviewEvidence[] = [];

      for (let rAttempt = 1; rAttempt <= MAX_REVIEW_CALLS_PER_SUBJECT; rAttempt++) {
        if (rAttempt > 1) {
          // FAIL CLOSED before spending the second call: the subject must be byte-identical.
          const current: ReviewSubject = { ...frozen, scenarioSha256: scenarioDigest(llm.draft) };
          const gate = canRerunOverSubject(frozen, current);
          if (!gate.ok) {
            logGenOutcome("review_subject_drift", gate.drift[0], {
              reviewSubjectSha256: subjectSha,
              defectCodes: gate.drift,
              ...captured({ scenario: llm.draft, review: reviewEvidences }),
            });
            return { ok: false, reason: REVIEWER_TERMINAL_FAILURE };
          }
        }

        review = await reviewConstraintCompliance(
          input,
          constraints,
          llm.draft,
          llm.constructions,
          { sha256: subjectSha, attempt: rAttempt },
          accounting,
        );
        if (review.kind === "contradiction" || (review.kind === "malformed" && review.evidence)) {
          reviewEvidences.push(review.evidence as ReviewEvidence);
        }
        // R2.17 observability: every reviewer outcome remains individually observable.
        if (review.kind === "contradiction") {
          logGenOutcome("review_malformed", review.errors[0], {
            reviewSubjectSha256: subjectSha,
            boundaryProvenanceSha256: provenanceSha,
            reviewRequestBoundaries: review.evidence.reviewRequestBoundaries,
            boundaryCoverage: review.evidence.boundaryCoverage
              ? { ...review.evidence.boundaryCoverage, boundaryIdsConsidered: review.evidence.boundaryIdsConsidered ?? [], assessmentIds: review.evidence.boundaryAssessmentIds ?? [] }
              : undefined,
            ...captured({ scenario: llm.draft, review: reviewEvidences }),
          });
        }

        const decision = decideAfterReview(rAttempt, { kind: review.kind, errors: "errors" in review ? review.errors : undefined });

        if (decision.action === "rerun_review") {
          // The scenario is NOT regenerated and NOT counted as a generation retry. The reviewer
          // disagreed with itself; the scenario has not been judged yet.
          logGenOutcome("review_rerun", review.kind === "contradiction" ? review.errors[0] : undefined, {
            reviewSubjectSha256: subjectSha,
            boundaryProvenanceSha256: provenanceSha,
            ...captured({ scenario: llm.draft, review: reviewEvidences }),
          });
          continue;
        }
        if (decision.action === "reviewer_terminal_failure") {
          // Two contradictions over an identical frozen subject. The scenario content remained
          // UNJUDGED — this is never a generator content rejection.
          logGenOutcome(REVIEWER_TERMINAL_FAILURE, review.kind === "contradiction" ? review.errors[0] : undefined, {
            reviewSubjectSha256: subjectSha,
            boundaryProvenanceSha256: provenanceSha,
            boundaryProvenance,
            defectCodes: review.kind === "contradiction" ? review.errors : [],
            scenarioUnjudged: true,
            ...captured({ scenario: llm.draft, review: reviewEvidences }),
          });
          terminal = { reason: REVIEWER_TERMINAL_FAILURE };
          break;
        }
        if (decision.action === "reviewer_infrastructure_failure") {
          // Keep the established observation names — a transport failure and a malformed envelope
          // were observable before R2.25 and must remain so; only the RESPONSE to them changed.
          if (review.kind === "transport_failed") {
            logGenOutcome("review_transport_failed", undefined, { reviewSubjectSha256: subjectSha });
            terminal = { reason: "generation_failed" };
          } else {
            logGenOutcome("review_malformed", decision.code, {
              reviewSubjectSha256: subjectSha,
              ...captured({ scenario: llm.draft, review: reviewEvidences.length ? reviewEvidences : [decision.code] }),
            });
            terminal = { reason: REVIEWER_TERMINAL_FAILURE };
          }
          break;
        }
        break; // accept / reject_scenario / no_safe_space — handled below
      }

      if (terminal) return { ok: false, reason: terminal.reason };
      if (!review) return { ok: false, reason: REVIEWER_TERMINAL_FAILURE };

      if (review.kind === "no_safe_space") {
        // Only a review that SURVIVED the consistency gates can reach here, so this is a supported
        // refusal rather than the unsupported assertion that produced the c18 over-refusal.
        logGenOutcome("review_no_safe_space", review.reasonCode);
        return { ok: false, reason: "no_safe_judgment_space" };
      }
      if (review.kind === "ok") reviewEvidence = review.boundaryEvidence;
      if (review.kind === "reject") {
        // R2.23 — the reviewer's findings go through the SAME precedence authority as the
        // deterministic gates, so a boundary or unsafe-delay finding from the review outranks an
        // ordinary quality one regardless of the order the reviewer happened to report them in.
        const reviewFindings: Finding[] = [
          ...review.defects.map((code) => ({ code, gate: "semantic_review" })),
          ...review.phaseDefects.flatMap((d) =>
            d.codes.map((code) => ({ code, gate: "phase_choice_review", phase: d.phase, branchIndex: d.branchIndex, choiceIndex: d.choiceIndex })),
          ),
          ...review.choiceDefects.flatMap((d) => d.codes.map((code) => ({ code, gate: "primary_choice_review", phase: "primary", choiceIndex: d.index }))),
          ...review.branchDefects.flatMap((d) => d.codes.map((code) => ({ code, gate: "branch_review", branchIndex: d.index }))),
          ...review.urgencyDefects.flatMap((d) => d.codes.map((code) => ({ code, gate: "urgency_review", phase: "primary", choiceIndex: d.index }))),
          ...review.boundaryDefects.flatMap((d) => d.codes.map((code) => ({ code, gate: "boundary_review", boundaryId: d.boundaryId }))),
        ];
        const resolved = resolveRejection(reviewFindings)!;
        const packet = buildCorrectionPacket(attempt, resolved.primaryCode, resolved.findings, immutableContext(input, constraints));
        const fb = renderCorrectionPacket(packet);
        lastPacket = packet;
        logGenOutcome(
          `gate_level_${resolved.primaryLevel}`,
          resolved.primaryCode,
          {
            gate: resolved.primaryGate,
            level: resolved.primaryLevel,
            defectCodes: resolved.defectCodes,
            findings: resolved.findings,
            evidenceSources: resolved.evidenceSources,
            correctionPacketSha256: packetDigest(packet),
            ...captured({
              scenario: llm.draft,
              review: { defects: resolved.defectCodes, instruction: review.instruction },
              retryFeedback: fb,
            }),
            ...(genCaptureContent ? { correctionPacket: packet } : {}),
          },
        );
        // R5C-1 — the SEMANTIC reviewer refused content. Its gate keeps it out of the boundary bucket.
        if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected", rejectionGate: resolved.primaryGate, rejectionPrimaryCode: resolved.primaryCode, rejectionCodes: resolved.defectCodes };
        retryFeedback = fb;
        continue;
      }
    }
    // R2.23C — ONLY now, after an accepted review, is per-choice constraint evidence materialized.
    // A rejected scenario never reaches here, so it can never produce evidence of compliance.
    const projected = projectConstraintAssessments(llm.draft, constraints, reviewEvidence, true);
    if (!projected.ok) {
      logGenOutcome("projection_rejected", projected.errors[0], { defectCodes: projected.errors });
      return { ok: false, reason: "generation_rejected" };
    }
    // The projection is checked by the SAME canonical gate the generator's attestation used to face.
    if (constraints.length > 0) {
      const verify = validateConstraintAssessments(llm.draft, constraints.map((c) => c.id), projected.assessmentsByChoiceId);
      if (!verify.ok) {
        logGenOutcome("projection_rejected", verify.errors[0], { defectCodes: verify.errors });
        return { ok: false, reason: "generation_rejected" };
      }
    }
    logGenOutcome("generated_valid");
    return { ok: true, value: { draft: llm.draft, source: "ai", warnings: llm.warnings, constraintEvidence: projected.assessmentsByChoiceId } };
  }
  return { ok: false, reason: "generation_rejected" };
}

export type { Locale };
