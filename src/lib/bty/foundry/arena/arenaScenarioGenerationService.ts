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
        | "safety_boundary_unresolved"; // mandatory-vs-judgment boundary cannot be determined safely
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

/** Bounded provider timeout — generation must never hang the host's flow. */
const LLM_TIMEOUT_MS = 15_000;

function logGenOutcome(outcome: string, code?: string): void {
  console.info(`[arenaScenarioGen] ${outcome}${code ? ` code=${code}` : ""}`);
}

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Minimal, PII-free structured context for the provider. */
function buildLlmMessages(input: ScenarioGenInput, constraints: string[]): LlmChatMessage[] {
  const { locale, facts, guided } = input;
  const isKo = locale === "ko";

  const constraintLines = constraints.length
    ? [
        "NON-NEGOTIABLE CONSTRAINTS — mandatory rules the training establishes. EVERY primary, tradeoff, and action choice, on EVERY branch, MUST fully obey ALL of them:",
        ...constraints.map((c) => `- ${c}`),
        "Do NOT balance compliance against non-compliance. Never present skipping, bypassing, delaying past, hiding, or disclosing-against a constraint as a defensible option. Put the difficult tradeoff ONLY around HOW to comply — sequencing, patient/stakeholder communication, room/scope, staffing reassignment, escalation, or schedule recovery — with the constraint naturally embedded in the scene, not as a lecture. Every path still satisfies every constraint. If no legitimate difficult choice exists inside the safe boundary, return an empty object {}.",
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
  | { ok: false; reason: "generation_failed" | "generation_rejected" };

/**
 * One bounded provider attempt. Distinguishes a TRANSPORT failure (no usable content —
 * generation_failed) from CONTENT that was returned but rejected by the gates
 * (generation_rejected). `constraints` (mixed-safety content) are injected into the prompt
 * and enforced deterministically on the output.
 */
async function generateWithLlm(input: ScenarioGenInput, constraints: string[]): Promise<LlmOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages: buildLlmMessages(input, constraints),
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: 1100,
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      logGenOutcome("provider_failed", "empty_output"); // transport-ish: no usable content
      return { ok: false, reason: "generation_failed" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      logGenOutcome("provider_rejected", "malformed_shape");
      return { ok: false, reason: "generation_rejected" };
    }
    const result = parseArenaScenarioDraft(parsed);
    if (!result.ok) {
      logGenOutcome("provider_rejected", result.errors[0]);
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
    const qualityWarnings = validateBranchedScenario(result.value).warnings;
    return { ok: true, draft: result.value, warnings: [...result.warnings, ...qualityWarnings] };
  } catch {
    logGenOutcome(controller.signal.aborted ? "provider_timeout" : "provider_error");
    return { ok: false, reason: "generation_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * KNOW-only classification kept for back-compat (Slice 3.2I-R2). True iff the eligibility
 * classifier returns `know_only`. Prefer `classifyPracticeEligibility` for the full set.
 */
export function isFixedAnswerTraining(facts: ModuleSourceFacts): boolean {
  return eligibilityOf(facts).kind === "know_only";
}

/**
 * Generate one live, branch-aware, incident-specific, CONSTRAINT-SAFE draft — LIVE MODEL
 * ONLY (Slice 3.2I-R2/R3). Practice eligibility is classified first: KNOW-only declines;
 * an unresolved safety boundary fails safe; mixed content generates only inside the safe
 * decision space (constraints enforced in the prompt AND on the output). It NEVER returns a
 * generic deterministic scenario.
 */
export async function generateArenaScenarioDraft(input: ScenarioGenInput): Promise<GenerationResult> {
  const eligibility = eligibilityOf(input.facts);
  if (eligibility.kind === "know_only") {
    logGenOutcome("declined_fixed_answer");
    return { ok: false, reason: "fixed_answer_knowledge" };
  }
  if (eligibility.kind === "unresolved_safety_boundary") {
    logGenOutcome("declined_safety_unresolved");
    return { ok: false, reason: "safety_boundary_unresolved" };
  }
  if (!isLlmAvailable()) {
    logGenOutcome("unavailable");
    return { ok: false, reason: "generation_unavailable" };
  }
  const llm = await generateWithLlm(input, eligibility.constraints);
  if (!llm.ok) {
    // generateWithLlm already logged the specific outcome; it distinguishes a transport
    // failure (generation_failed) from returned-but-rejected content (generation_rejected).
    return { ok: false, reason: llm.reason };
  }
  logGenOutcome("generated_valid");
  return { ok: true, value: { draft: llm.draft, source: "ai", warnings: llm.warnings } };
}

export type { Locale };
