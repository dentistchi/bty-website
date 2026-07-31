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
import { validateConstraintAssessments, type PracticeBoundary } from "@/domain/foundry/arena-draft/boundary";
import { validateBoundaryGrounding } from "@/domain/foundry/arena-draft/boundaryGrounding";
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
};

/** Discriminated generation outcome — a rejection carries a safe, stable reason. */
export type GenerationResult =
  | { ok: true; value: GeneratedDraft }
  | {
      ok: false;
      reason:
        | "generation_unavailable" // no live model configured
        | "generation_failed" // transport/exception/timeout — no usable content returned
        | "generation_rejected" // content returned but malformed / gate / safety-constraint failed
        | "fixed_answer_knowledge" // KNOW-only content — not a judgment dilemma
        | "safety_boundary_unresolved" // free-text boundary undetermined (no confirmation)
        | "boundary_confirmation_required" // a possible boundary is detected but not Manager-confirmed
        | "structured_output_unavailable" // provider rejected the strict schema — never downgraded silently
        | "no_safe_judgment_space"; // confirmed constraints leave no legitimate difficult choice
    };

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
const LLM_GEN_TIMEOUT_MS = 45_000;
const LLM_REVIEW_TIMEOUT_MS = 15_000;
/** Output ceiling for generation. Sized from the schema's worst case, not guessed. */
const LLM_GEN_MAX_TOKENS = 4_000;

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
  /** R2.19 — captured ONLY when the harness opts in. See `__setGenObserver`. */
  scenario?: unknown;
  review?: unknown;
  retryFeedback?: string;
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
function buildLlmMessages(input: ScenarioGenInput, constraints: PracticeBoundary["constraints"], retryFeedback = ""): LlmChatMessage[] {
  const { locale, facts, guided } = input;
  const isKo = locale === "ko";

  const constraintLines = constraints.length
    ? [
        "CONFIRMED NON-NEGOTIABLE CONSTRAINTS — mandatory rules the Manager confirmed. EVERY primary, tradeoff, and action choice, on EVERY branch, MUST fully obey ALL of them. You may NOT delete, weaken, reinterpret, or replace any constraint:",
        ...constraints.map((c) => `- [${c.id}] ${c.statement}`),
        "Do NOT balance compliance against non-compliance. Never present skipping, bypassing, delaying past, hiding, or disclosing-against a constraint as a defensible option. Put the difficult tradeoff ONLY around HOW to comply — sequencing, communication timing, scope, staffing reassignment, escalation order, schedule recovery, who acts first — with the constraint naturally embedded in the scene, not a lecture. Every path still satisfies every constraint. If no legitimate difficult choice exists inside the safe boundary, set noSafeJudgmentSpace to true.",
        "Every choice object carries its OWN `constraintAssessments` array — one entry per constraint id: {\"constraintId\": string, \"status\": \"satisfied\", \"rationale\": short string}. Fill it for EVERY choice (primary, flat tradeoff, flat action, and every branch tradeoff/action). This is internal metadata; do NOT put it in any learner-facing label.",
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

  const system = [
    "You design ONE short leadership DECISION-PRACTICE scenario. Its purpose is NOT to find the right answer — it is to force a difficult choice: which legitimate value to protect, and what cost to accept, under pressure.",
    "The scenario has EXACTLY three phases: PRIMARY (a realistic opening situation with strategic choices), TRADEOFF (a harder escalation that raises the stakes), and ACTION DECISION (a direct decision about a concrete next action).",
    "CONCRETE SCENE — the opening must read like an actual moment, not a training description. In 2-4 natural sentences establish: WHO (the learner's role/responsibility), WHAT specifically just happened (a concrete incident, request, failure, or risk), WHO is affected (a concrete stakeholder — a teammate, client, patient, the team…), WHY NOW (a deadline, a waiting person, a live decision), and that two legitimate values cannot both be fully protected. NEVER write 'A realistic moment', 'A difficult situation', 'Leadership is required', '<capability> is called for', 'you cannot protect both', or interpolate a raw capability phrase into a sentence. Do not invent named organizations, real people, or specific numbers. Use the training context, target role, and audience for a plausible concrete setting.",
    "Every choice (primary, tradeoff, action) must begin with or clearly contain a CONCRETE ACTION the learner performs (tell, pause, call, verify, escalate, meet, document, disclose, delay, narrow, proceed, ask…) — not abstract intent ('protect trust', 'demonstrate leadership', 'hold the standard'). Vary phrasing; do not repeat boilerplate like 'accepting that' or 'there isn't enough time' across the opening and every branch.",
    "",
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
    "PER-PRIMARY CAUSAL BRANCHING (required): the learner's PRIMARY choice must change what happens next. For EVERY primary choice id, produce a BRANCH under `branches` keyed by that exact primary id. Each branch's escalation, tradeoff choices, and action decision must follow causally from THAT primary choice — the action it took, the facts it created, the value it protected, the cost it accepted, and the NEW pressure that path creates. Do NOT reuse one shared escalation across branches, and never let a branch reference a fact or action from a DIFFERENT branch. Each branch's tradeoff and action decision must independently satisfy the difficult-choice contract above.",
    "The flat top-level `tradeoff` / `actionDecision` remain as a branch-neutral fallback (compatible with every primary): keep them, but the branches carry the real per-choice continuations.",
    `Write all learner-facing text in ${isKo ? "Korean" : "English"}.`,
    "Return ONLY a compact JSON object, no markdown or code fences, with EXACTLY this shape:",
    '{"noSafeJudgmentSpace": boolean, "title": string, "opening": string, "primaryChoices": [{"label": string, "constraintAssessments": []}], "flatEscalationText": string, "flatTradeoffChoices": [{"label": string, "constraintAssessments": []}], "flatActionDecision": {"prompt": string, "choices": [{"label": string, "isActionCommitment": boolean, "constraintAssessments": []}]}, "branches": [{"resultingWorldState": string, "escalationText": string, "tradeoffChoices": [{"label": string, "constraintAssessments": []}], "actionDecision": {"prompt": string, "choices": [{"label": string, "isActionCommitment": boolean, "constraintAssessments": []}]}}], "boundaryGrounding": []}',
    "DO NOT invent any id field. You author the words; the server assigns every identifier.",
    "`branches` is an ARRAY, not an object. branches[i] is the continuation of primaryChoices[i] — the ORDER is the relationship. branches MUST have exactly the same length as primaryChoices.",
    "isActionCommitment is REQUIRED on every action choice (true or false, never omitted) and marks the immediate-action option for INTERNAL use only — it must not read as the 'correct' option. At least one action choice in each actionDecision must be true.",
    "primaryChoices: 2-4. flatTradeoffChoices: 2-3. every actionDecision.choices: 2-3. Each branch tradeoffChoices 2-3. No empty labels. Set noSafeJudgmentSpace to false for a normal scenario. `boundaryGrounding` is an ARRAY — one entry per confirmed constraint, or [] when there are none. Ground everything in the training context and the two host answers; invent no real names, organizations, patient details, numbers, or private data.",
    ...urgencyLines,
    ...constraintLines,
  ].join("\n");

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
  | { ok: true; draft: ArenaScenarioDraft; warnings: string[] }
  | {
      ok: false;
      reason: "generation_failed" | "generation_rejected" | "no_safe_judgment_space" | "structured_output_unavailable";
      /** R2.21 — deterministic grounding failures, so the retry states what was missing. */
      groundingDefects?: string[];
    };

/**
 * One bounded provider attempt. Distinguishes a TRANSPORT failure (no usable content —
 * generation_failed) from CONTENT returned but rejected (generation_rejected), and honors
 * the provider signalling that no safe judgment space exists. `constraints` are the CONFIRMED
 * structured rules; when present, the provider's per-choice `constraintAssessments` are
 * validated deterministically (then discarded — never persisted, never learner-facing).
 */
async function generateWithLlm(input: ScenarioGenInput, constraints: PracticeBoundary["constraints"], retryFeedback = ""): Promise<LlmOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_GEN_TIMEOUT_MS);
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages: buildLlmMessages(input, constraints, retryFeedback),
        temperature: 0.8,
        top_p: 0.9,
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
    // A provider refusal is an explicit safe refusal, never scenario content.
    if (choice?.message?.refusal) {
      logGenOutcome("provider_refused", "provider_refusal", { finishReason: choice?.finish_reason });
      return { ok: false, reason: "generation_rejected" };
    }
    // A truncated body is not malformed authoring — it is an output-budget failure. Parsing it
    // would report a misleading `malformed_shape`, so it is detected and named explicitly.
    if (choice?.finish_reason === "length") {
      logGenOutcome("provider_rejected", "truncated_output", { finishReason: choice?.finish_reason, rawLength: choice?.message?.content?.length });
      return { ok: false, reason: "generation_rejected" };
    }
    const raw = choice?.message?.content;
    if (!raw) {
      logGenOutcome("provider_failed", "empty_output");
      return { ok: false, reason: "generation_failed" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      logGenOutcome("provider_rejected", "malformed_shape", { finishReason: choice?.finish_reason, rawLength: raw.length, rawSample: raw.slice(-200) });
      return { ok: false, reason: "generation_rejected" };
    }
    if (parsed && typeof parsed === "object" && (parsed as { noSafeJudgmentSpace?: unknown }).noSafeJudgmentSpace === true) {
      logGenOutcome("no_safe_judgment_space");
      return { ok: false, reason: "no_safe_judgment_space" };
    }
    // PROVIDER DTO → CANONICAL. The model authored judgment content only; transport identity is
    // assigned here, deterministically, and ONLY after the DTO fully validates. An invalid
    // provider result can never reach canonicalization or persistence.
    const dto = validateProviderScenario(parsed);
    if (!dto.ok) {
      logGenOutcome("provider_rejected", dto.errors[0], { finishReason: choice?.finish_reason, rawLength: raw.length });
      return { ok: false, reason: "generation_rejected" };
    }
    const canonical = canonicalizeProviderScenario(dto.value);
    // Re-validate the COMPLETED canonical object — canonicalization is never trusted blindly.
    const result = parseArenaScenarioDraft(canonical.draft);
    if (!result.ok) {
      logGenOutcome("provider_rejected", result.errors[0], { finishReason: choice?.finish_reason, rawLength: raw.length });
      return { ok: false, reason: "generation_rejected" };
    }
    for (const [tag, gate] of [
      ["provider_low_quality", validateBranchedScenario(result.value)],
      ["provider_not_a_scene", validateConcreteScene(result.value)],
      ["provider_not_specific", validateIncidentSpecific(result.value)],
      ["provider_constraint_violation", validateConstraintCompliance(result.value)],
    ] as const) {
      if (!gate.ok) {
        logGenOutcome(tag, gate.errors[0]);
        return { ok: false, reason: "generation_rejected" };
      }
    }
    // Confirmed constraints → every choice must carry a valid, satisfied assessment.
    if (constraints.length > 0) {
      const assess = validateConstraintAssessments(
        result.value,
        constraints.map((c) => c.id),
        canonical.assessmentsByChoiceId,
      );
      if (!assess.ok) {
        logGenOutcome("provider_assessment_invalid", assess.errors[0]);
        return { ok: false, reason: "generation_rejected" };
      }
    }
    // BOUNDARY GROUNDING (R2.21). The per-choice assessment above only proves the model SAID
    // "satisfied" for every rule — its `status` enum cannot even express a violation. c18 passed it
    // while never mentioning its confirmed rule. This gate proves the necessary conditions the
    // assessment cannot: coverage, statement fidelity, a declared effect at a real decision stage,
    // and that the rule's own vocabulary actually reaches the learner-facing scenario. Whether it
    // genuinely constrains the judgment is decided independently by the semantic review below.
    const grounding = validateBoundaryGrounding(canonical.boundaryGrounding, constraints, result.value);
    if (!grounding.ok) {
      logGenOutcome("provider_boundary_ungrounded", grounding.errors[0]);
      return { ok: false, reason: "generation_rejected", groundingDefects: grounding.errors };
    }
    const qualityWarnings = validateBranchedScenario(result.value).warnings;
    return { ok: true, draft: result.value, warnings: [...result.warnings, ...qualityWarnings] };
  } catch (e) {
    if (controller.signal.aborted) {
      logGenOutcome("provider_timeout");
      return { ok: false, reason: "generation_failed" };
    }
    // A provider that cannot honour the strict schema must FAIL CLOSED. Downgrading to
    // unconstrained JSON here would silently restore the exact contract this slice removed.
    if (isStructuredOutputUnsupported(e)) {
      logGenOutcome("provider_rejected", "structured_output_unavailable");
      return { ok: false, reason: "structured_output_unavailable" };
    }
    logGenOutcome("provider_error");
    return { ok: false, reason: "generation_failed" };
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
  | { kind: "ok" }
  | {
      kind: "reject";
      defects: string[];
      choiceDefects: Array<{ index: number; codes: string[] }>;
      branchDefects: Array<{ index: number; codes: string[] }>;
      boundaryDefects: Array<{ boundaryId: string; statement: string; codes: string[] }>;
      urgencyDefects: Array<{ index: number; codes: string[] }>;
      instruction: string;
    }
  | { kind: "no_safe_space"; reasonCode: string }
  | { kind: "malformed"; errors: string[] }
  | { kind: "transport_failed" };

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
): Promise<ReviewOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_REVIEW_TIMEOUT_MS);
  try {
    const system = [
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
      "overallVerdict='accept' ONLY when every choice is defensible, no branch repeats the primary decision, no branch overlaps a sibling, every confirmed boundary is PRESENT and OPERATIONALIZED and obeyed at every stage, and no choice is an unsafe delay. Otherwise 'reject', with exact defectCodes and a short retryInstruction saying what must change. Your verdict must not contradict your own detail fields.",
      "Return ONLY the JSON object required by the schema.",
    ].join("\n");
    const payload = {
      constraints: constraints.map((c) => ({ id: c.id, statement: c.statement })),
      opening: draft.opening,
      primary: draft.primary.choices,
      branches: Object.fromEntries(
        Object.entries(draft.branches ?? {}).map(([k, b]) => [
          k,
          { escalation: b.escalationText, tradeoff: b.tradeoffChoices, action: b.actionDecision.choices },
        ]),
      ),
      flatTradeoff: draft.tradeoff.choices,
      flatAction: draft.actionDecision.choices,
    };
    const completion = await getLlmClient().chat.completions.create(
      {
        model: getLlmModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(payload) },
        ],
        temperature: 0,
        max_tokens: 1600,
        response_format: {
          type: "json_schema",
          json_schema: { name: SEMANTIC_REVIEW_SCHEMA_NAME, strict: true, schema: SEMANTIC_REVIEW_JSON_SCHEMA },
        },
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { kind: "transport_failed" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      return { kind: "malformed", errors: ["review_not_json"] };
    }
    const branchCount = Object.keys(draft.branches ?? {}).length;
    const v = validateSemanticReview(parsed, {
      primaryCount: draft.primary.choices.length,
      branchCount,
      constraintIds: constraints.map((c) => c.id),
    });
    // A contradictory or unsupported review is NOT a safety outcome — it is a broken review.
    if (!v.ok) return { kind: "malformed", errors: v.errors };
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
        instruction: v.value.retryInstruction,
      };
    }
    return { kind: "ok" };
  } catch {
    return { kind: "transport_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Max provider calls per generation: 2 generations + 2 reviews (1 regen on a correctable reject). */
const MAX_GENERATION_ATTEMPTS = 2;

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
type DeclineReason = "fixed_answer_knowledge" | "boundary_confirmation_required" | "safety_boundary_unresolved";
function resolveAuthority(
  input: ScenarioGenInput,
): { kind: "decline"; reason: DeclineReason } | { kind: "generate"; constraints: PracticeBoundary["constraints"] } {
  const boundary = input.boundary;
  if (boundary && boundary.confirmed) {
    if (boundary.mode === "knowledge_check") return { kind: "decline", reason: "fixed_answer_knowledge" };
    if (boundary.mode === "judgment") return { kind: "generate", constraints: [] };
    return { kind: "generate", constraints: boundary.constraints }; // judgment_with_constraints
  }
  // No confirmed boundary → free-text classifier only blocks/allows, never authors constraints.
  const eligibility = eligibilityOf(input.facts);
  if (eligibility.kind === "know_only") return { kind: "decline", reason: "fixed_answer_knowledge" };
  if (eligibility.kind === "judgment_only") return { kind: "generate", constraints: [] };
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
export async function generateArenaScenarioDraft(input: ScenarioGenInput): Promise<GenerationResult> {
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

  /** Defect-specific correction appended to the SECOND request. Empty on the first attempt. */
  let retryFeedback = "";

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const llm = await generateWithLlm(input, constraints, retryFeedback);
    if (!llm.ok) {
      // Transport / no-safe-space are terminal; a correctable rejection may regenerate once.
      // A capability gap is terminal — retrying the same unsupported schema cannot succeed, and
      // must never be retried as unconstrained JSON.
      if (
        llm.reason === "generation_failed" ||
        llm.reason === "no_safe_judgment_space" ||
        llm.reason === "structured_output_unavailable"
      ) {
        return { ok: false, reason: llm.reason };
      }
      if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected" };
      // R2.21 — a deterministic grounding failure carries actionable, boundary-specific correction
      // into the single retry. Without it the second request repeats the first, which is exactly how
      // an ungrounded scenario used to "recover" into another ungrounded one.
      if (llm.groundingDefects?.length) {
        retryFeedback = buildRetryFeedback({
          attempt,
          defects: llm.groundingDefects,
          choiceDefects: [],
          branchDefects: [],
          boundaryDefects: constraints.map((c) => ({ boundaryId: c.id, statement: c.statement, codes: llm.groundingDefects ?? [] })),
        });
      }
      continue;
    }
    // SEMANTIC REVIEW — R2.18: runs for EVERY generation, not only constrained ones.
    // c01 (honesty-vs-concealment) and c09 (branches re-asking the primary question) both carried
    // NO confirmed constraints, so under the old `constraints.length > 0` gate neither was ever
    // semantically reviewed — the deterministic gates passed both. That gap, not model luck, is
    // why defective content reached a green run.
    {
      const review = await reviewConstraintCompliance(input, constraints, llm.draft);
      if (review.kind === "transport_failed") {
        logGenOutcome("review_transport_failed");
        return { ok: false, reason: "generation_failed" };
      }
      if (review.kind === "no_safe_space") {
        // Only a review that SURVIVED the consistency gates can reach here, so this is a supported
        // refusal rather than the unsupported assertion that produced the c18 over-refusal.
        logGenOutcome("review_no_safe_space", review.reasonCode);
        return { ok: false, reason: "no_safe_judgment_space" };
      }
      if (review.kind === "malformed") {
        // Includes a contradictory or unsupported no-safe claim — a broken review, never a safety
        // outcome, so it must not terminate as no_safe_judgment_space.
        const fb = buildRetryFeedback({ attempt, defects: ["review_contradictory"], choiceDefects: [], branchDefects: [] });
        logGenOutcome("review_malformed", review.errors[0], captured({ scenario: llm.draft, review: review.errors, retryFeedback: fb }));
        if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected" };
        retryFeedback = fb;
        continue;
      }
      if (review.kind === "reject") {
        // DEFECT-SPECIFIC retry: the previous contract re-sent the identical prompt, so the model
        // never learned what failed and c09 "recovered" into an equally collapsed scenario.
        const fb = buildRetryFeedback({
          attempt,
          defects: review.defects,
          choiceDefects: review.choiceDefects,
          branchDefects: review.branchDefects,
          boundaryDefects: review.boundaryDefects,
          urgencyDefects: review.urgencyDefects,
          reviewerInstruction: review.instruction,
        });
        logGenOutcome(
          "review_reject",
          review.defects[0],
          captured({
            scenario: llm.draft,
            review: {
              defects: review.defects,
              choiceDefects: review.choiceDefects,
              branchDefects: review.branchDefects,
              boundaryDefects: review.boundaryDefects,
              urgencyDefects: review.urgencyDefects,
              instruction: review.instruction,
            },
            retryFeedback: fb,
          }),
        );
        if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected" };
        retryFeedback = fb;
        continue;
      }
    }
    logGenOutcome("generated_valid");
    return { ok: true, value: { draft: llm.draft, source: "ai", warnings: llm.warnings } };
  }
  return { ok: false, reason: "generation_rejected" };
}

export type { Locale };
