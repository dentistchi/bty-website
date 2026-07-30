import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import { parseArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
import {
  validateBranchedScenario,
  validateConcreteScene,
  validateIncidentSpecific,
} from "@/domain/foundry/arena-draft/quality";
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
        | "generation_failed" // provider error/timeout/malformed
        | "generation_rejected" // structurally/quality gate rejected
        | "fixed_answer_knowledge"; // KNOW/COMPLIANCE — not a judgment dilemma
    };

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
function buildLlmMessages(input: ScenarioGenInput): LlmChatMessage[] {
  const { locale, facts, guided } = input;
  const isKo = locale === "ko";

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

async function generateWithLlm(input: ScenarioGenInput): Promise<{ draft: ArenaScenarioDraft; warnings: string[] } | null> {
  if (!isLlmAvailable()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const client = getLlmClient();
    const completion = await client.chat.completions.create(
      {
        model: getLlmModel(),
        messages: buildLlmMessages(input),
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: 900,
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      logGenOutcome("provider_invalid", "empty_output");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      logGenOutcome("provider_invalid", "malformed_shape");
      return null;
    }
    const result = parseArenaScenarioDraft(parsed);
    if (!result.ok) {
      logGenOutcome("provider_invalid", result.errors[0]);
      return null;
    }
    // Difficult-choice gate (Slice 3.2H): a structurally-valid but OBVIOUS-ANSWER draft
    // is rejected here so it can never be silently used. Rejection → the caller falls
    // back to the authored template (which passes the same gate). Advisory quality
    // warnings ride through to the host without blocking.
    const quality = validateBranchedScenario(result.value);
    if (!quality.ok) {
      logGenOutcome("provider_low_quality", quality.errors[0]);
      return null;
    }
    // Concrete-scene gate (Slice 3.2I-R1): reject a difficult-but-abstract scenario.
    const scene = validateConcreteScene(result.value);
    if (!scene.ok) {
      logGenOutcome("provider_not_a_scene", scene.errors[0]);
      return null;
    }
    // Incident-specificity gate (Slice 3.2I-R2): require true, non-paraphrased branches.
    const specific = validateIncidentSpecific(result.value);
    if (!specific.ok) {
      logGenOutcome("provider_not_specific", specific.errors[0]);
      return null;
    }
    return { draft: result.value, warnings: [...result.warnings, ...quality.warnings] };
  } catch {
    logGenOutcome(controller.signal.aborted ? "provider_timeout" : "provider_error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * KNOW / COMPLIANCE classification (Slice 3.2I-R2). A training whose only learning need is
 * to KNOW a fact is not a judgment dilemma — forcing a difficult-choice scenario would
 * either fabricate a false tradeoff or offer an unsafe selectable path. Such a training
 * declines Arena generation. `decide` / `practice` / `shared_standard` are judgment needs.
 */
export function isFixedAnswerTraining(facts: ModuleSourceFacts): boolean {
  const needs = facts.learningNeeds ?? [];
  return needs.length > 0 && needs.every((n) => n === "know");
}

/**
 * Generate one live, branch-aware, incident-specific draft — LIVE MODEL ONLY (Slice
 * 3.2I-R2). Returns a discriminated result; on no provider / provider failure / malformed
 * output / any gate rejection it FAILS SAFE with a stable reason. It NEVER returns a generic
 * deterministic scenario — a low-quality fallback is a quietly-delivered product failure.
 */
export async function generateArenaScenarioDraft(input: ScenarioGenInput): Promise<GenerationResult> {
  if (isFixedAnswerTraining(input.facts)) {
    logGenOutcome("declined_fixed_answer");
    return { ok: false, reason: "fixed_answer_knowledge" };
  }
  if (!isLlmAvailable()) {
    logGenOutcome("unavailable");
    return { ok: false, reason: "generation_unavailable" };
  }
  const llm = await generateWithLlm(input);
  if (!llm) {
    // generateWithLlm already logged the specific outcome (error/timeout/malformed/gate).
    return { ok: false, reason: "generation_rejected" };
  }
  logGenOutcome("generated_valid");
  return { ok: true, value: { draft: llm.draft, source: "ai", warnings: llm.warnings } };
}

export type { Locale };
