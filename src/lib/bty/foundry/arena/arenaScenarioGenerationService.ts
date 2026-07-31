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
export type GenObservation = { outcome: string; code?: string; finishReason?: string; rawLength?: number; rawSample?: string };
let genObserver: ((o: GenObservation) => void) | null = null;
/** Install/clear the evaluation sink. Test/eval harness only — never called by product code. */
export function __setGenObserver(fn: ((o: GenObservation) => void) | null): void {
  genObserver = fn;
}

function logGenOutcome(outcome: string, code?: string, extra?: Omit<GenObservation, "outcome" | "code">): void {
  console.info(`[arenaScenarioGen] ${outcome}${code ? ` code=${code}` : ""}`);
  genObserver?.({ outcome, code, ...extra });
}

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Minimal, PII-free structured context for the provider. */
function buildLlmMessages(input: ScenarioGenInput, constraints: PracticeBoundary["constraints"]): LlmChatMessage[] {
  const { locale, facts, guided } = input;
  const isKo = locale === "ko";

  const constraintLines = constraints.length
    ? [
        "CONFIRMED NON-NEGOTIABLE CONSTRAINTS — mandatory rules the Manager confirmed. EVERY primary, tradeoff, and action choice, on EVERY branch, MUST fully obey ALL of them. You may NOT delete, weaken, reinterpret, or replace any constraint:",
        ...constraints.map((c) => `- [${c.id}] ${c.statement}`),
        "Do NOT balance compliance against non-compliance. Never present skipping, bypassing, delaying past, hiding, or disclosing-against a constraint as a defensible option. Put the difficult tradeoff ONLY around HOW to comply — sequencing, communication timing, scope, staffing reassignment, escalation order, schedule recovery, who acts first — with the constraint naturally embedded in the scene, not a lecture. Every path still satisfies every constraint. If no legitimate difficult choice exists inside the safe boundary, return exactly {\"noSafeJudgmentSpace\": true}.",
        "Also return a top-level `constraintAssessments` object keyed by EVERY choice id (primary, flat, and every branch tradeoff/action). For each choice, an array with one entry per constraint id: {\"constraintId\": string, \"status\": \"satisfied\", \"rationale\": short string}. This is internal metadata; do NOT put it in any learner-facing label.",
      ]
    : [];

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
    '{"title": string, "opening": string, "primary": {"choices": [{"id": string, "label": string}] }, "tradeoff": {"escalationText": string, "choices": [{"id": string, "label": string}] }, "actionDecision": {"prompt": string, "choices": [{"id": string, "label": string, "isActionCommitment": boolean}] }, "branches": { "<primaryChoiceId>": {"resultingWorldState": string, "escalationText": string, "tradeoffChoices": [{"id": string, "label": string}], "actionDecision": {"prompt": string, "choices": [{"id": string, "label": string, "isActionCommitment": boolean}] } } } }',
    "isActionCommitment marks the immediate-action option for INTERNAL use only — it must not read as the 'correct' option.",
    "primary: 2-4 choices. tradeoff: 2-3 choices. actionDecision: 2-3 choices. branches: EXACTLY one key per primary choice id, no extra keys, no missing keys; each branch tradeoffChoices 2-3 and actionDecision choices 2-3 with >=1 isActionCommitment. Choice ids are short stable slugs, unique within their phase/branch. No empty labels. Ground everything in the training context and the two host answers; invent no real names, organizations, patient details, numbers, or private data.",
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

  return [
    { role: "system", content: system },
    { role: "user", content: contextLines.join("\n") },
  ];
}

type LlmOutcome =
  | { ok: true; draft: ArenaScenarioDraft; warnings: string[] }
  | { ok: false; reason: "generation_failed" | "generation_rejected" | "no_safe_judgment_space" };

/**
 * One bounded provider attempt. Distinguishes a TRANSPORT failure (no usable content —
 * generation_failed) from CONTENT returned but rejected (generation_rejected), and honors
 * the provider signalling that no safe judgment space exists. `constraints` are the CONFIRMED
 * structured rules; when present, the provider's per-choice `constraintAssessments` are
 * validated deterministically (then discarded — never persisted, never learner-facing).
 */
async function generateWithLlm(input: ScenarioGenInput, constraints: PracticeBoundary["constraints"]): Promise<LlmOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_GEN_TIMEOUT_MS);
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages: buildLlmMessages(input, constraints),
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: LLM_GEN_MAX_TOKENS,
        // Provider-supported structured output. The canonical shape keys `branches` by the
        // model-authored primary choice id, which OpenAI strict `json_schema` cannot express
        // (strict mode requires every property named with additionalProperties:false), so the
        // supported constraint here is JSON object mode — the system prompt already instructs
        // the exact shape. This eliminates the "valid text, invalid JSON" failure class; it does
        // NOT relax any downstream schema, safety or quality gate.
        response_format: { type: "json_object" },
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
    const result = parseArenaScenarioDraft(parsed);
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
        (parsed as { constraintAssessments?: unknown }).constraintAssessments,
      );
      if (!assess.ok) {
        logGenOutcome("provider_assessment_invalid", assess.errors[0]);
        return { ok: false, reason: "generation_rejected" };
      }
    }
    const qualityWarnings = validateBranchedScenario(result.value).warnings;
    return { ok: true, draft: result.value, warnings: [...result.warnings, ...qualityWarnings] };
  } catch {
    logGenOutcome(controller.signal.aborted ? "provider_timeout" : "provider_error");
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
  | { kind: "violation" }
  | { kind: "no_safe_space" }
  | { kind: "malformed" }
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
      "You are a strict SAFETY REVIEWER for a leadership practice scenario. You are given CONFIRMED non-negotiable constraints and a generated scenario's learner-facing choices.",
      "For EVERY choice, decide whether it obeys every constraint — including INDIRECT or implied violations, and whether any branch consequence assumes a violation occurred, or the dilemma falsely balances compliance against non-compliance, or no legitimate judgment space remains.",
      "Return ONLY JSON: {\"ok\": boolean, \"violations\": [{\"phase\": string, \"choiceId\": string, \"constraintId\": string, \"reason\": string}], \"noSafeJudgmentSpace\": boolean}. ok=false if any violation exists.",
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
        max_tokens: 700,
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { kind: "transport_failed" };
    let review: SemanticReview;
    try {
      review = JSON.parse(stripJsonFences(raw)) as SemanticReview;
    } catch {
      return { kind: "malformed" };
    }
    if (typeof review.ok !== "boolean" || typeof review.noSafeJudgmentSpace !== "boolean" || !Array.isArray(review.violations)) {
      return { kind: "malformed" };
    }
    if (review.noSafeJudgmentSpace) return { kind: "no_safe_space" };
    if (!review.ok || review.violations.length > 0) return { kind: "violation" };
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

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const llm = await generateWithLlm(input, constraints);
    if (!llm.ok) {
      // Transport / no-safe-space are terminal; a correctable rejection may regenerate once.
      if (llm.reason === "generation_failed" || llm.reason === "no_safe_judgment_space") return { ok: false, reason: llm.reason };
      if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected" };
      continue;
    }
    // Confirmed constraints → prove no INDIRECT crossing with an independent semantic review.
    if (constraints.length > 0) {
      const review = await reviewConstraintCompliance(input, constraints, llm.draft);
      if (review.kind === "transport_failed") return { ok: false, reason: "generation_failed" };
      if (review.kind === "no_safe_space") return { ok: false, reason: "no_safe_judgment_space" };
      if (review.kind === "malformed") return { ok: false, reason: "generation_rejected" };
      if (review.kind === "violation") {
        if (attempt >= MAX_GENERATION_ATTEMPTS) return { ok: false, reason: "generation_rejected" };
        continue; // regenerate once
      }
    }
    logGenOutcome("generated_valid");
    return { ok: true, value: { draft: llm.draft, source: "ai", warnings: llm.warnings } };
  }
  return { ok: false, reason: "generation_rejected" };
}

export type { Locale };
