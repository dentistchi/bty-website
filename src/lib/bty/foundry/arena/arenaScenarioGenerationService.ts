import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import { parseArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
import { validateDifficultChoice } from "@/domain/foundry/arena-draft/quality";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";
import {
  buildTemplateScenarioDraft,
  hardestWhenPhrase,
  type Locale,
  type ScenarioGenInput,
} from "./arenaScenarioTemplate";

/**
 * Foundry Guided Arena Builder — scenario generation (service).
 *
 * The AI DRAFTS; the domain validator decides validity; the deterministic template
 * guarantees a result. One provider attempt (bounded timeout); on unavailable,
 * timeout, network error, unparseable JSON, or a validator rejection, the template
 * renders a valid draft from the SAME grounding. The provider never sees attachment
 * bytes or PII — only the minimum structured module context + the two guided
 * answers. AI output is always re-validated before it can be used.
 *
 * The AI never decides runtime consequences, XP, verification, or standards — it
 * only re-expresses the practice moment as learner-facing text and choices.
 */

export type GeneratedDraft = {
  draft: ArenaScenarioDraft;
  /** How the draft was produced. */
  source: "ai" | "template";
  /** Advisory sensitive-info codes surfaced by the validator (never blocks). */
  warnings: string[];
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
    `Write all learner-facing text in ${isKo ? "Korean" : "English"}.`,
    "Return ONLY a compact JSON object, no markdown or code fences, with EXACTLY this shape:",
    '{"title": string, "opening": string, "primary": {"choices": [{"id": string, "label": string}] }, "tradeoff": {"escalationText": string, "choices": [{"id": string, "label": string}] }, "actionDecision": {"prompt": string, "choices": [{"id": string, "label": string, "isActionCommitment": boolean}] } }',
    "isActionCommitment marks the immediate-action option for INTERNAL use only — it must not read as the 'correct' option.",
    "primary: 2-4 choices. tradeoff: 2-3 choices. actionDecision: 2-3 choices. Every choice id must be a short unique stable slug (e.g. \"primary_1\"). No id may repeat across phases. No empty labels. Ground everything in the training context and the two host answers; invent no real names, organizations, patient details, numbers, or private data.",
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
    const quality = validateDifficultChoice(result.value);
    if (!quality.ok) {
      logGenOutcome("provider_low_quality", quality.errors[0]);
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
 * Generate one valid three-phase draft. Always resolves to a valid draft: the LLM
 * result if it validates, otherwise the deterministic template. Callers persist the
 * result and the `source` for observability.
 */
export async function generateArenaScenarioDraft(input: ScenarioGenInput): Promise<GeneratedDraft> {
  const llm = await generateWithLlm(input);
  if (llm) {
    logGenOutcome("generated_valid");
    return { draft: llm.draft, source: "ai", warnings: llm.warnings };
  }
  logGenOutcome("fallback_used");
  const draft = buildTemplateScenarioDraft(input);
  // The template is authored to satisfy BOTH the structural validator and the
  // difficult-choice gate; re-run both to surface any sensitive-info or quality
  // warnings that came from the guided answers (host free text).
  const check = parseArenaScenarioDraft(draft);
  const quality = validateDifficultChoice(draft);
  const warnings = [...(check.ok ? check.warnings : []), ...quality.warnings];
  return { draft, source: "template", warnings };
}

export type { Locale };
