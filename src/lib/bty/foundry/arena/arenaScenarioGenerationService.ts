import { getLlmClient, getLlmModel, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import { parseArenaScenarioDraft } from "@/domain/foundry/arena-draft/validate";
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
    "You design ONE short behavioral practice scenario for a leadership training tool.",
    "The scenario has EXACTLY three phases: PRIMARY (a realistic opening situation with behavioral choices), TRADEOFF (a harder escalation that follows), and ACTION DECISION (a direct decision about taking a concrete real-world action).",
    "Ground everything in the training context and the two host answers provided. Invent no real names, organizations, patient details, numbers, or private data.",
    "Do NOT write reflection or essay questions. Do NOT make the action choice morally obvious. At least one Action Decision choice must be a real observable action commitment; at least one may be waiting/preparing/deferring.",
    `Write all learner-facing text in ${isKo ? "Korean" : "English"}.`,
    "Return ONLY a compact JSON object, no markdown or code fences, with EXACTLY this shape:",
    '{"title": string, "opening": string, "primary": {"choices": [{"id": string, "label": string}] }, "tradeoff": {"escalationText": string, "choices": [{"id": string, "label": string}] }, "actionDecision": {"prompt": string, "choices": [{"id": string, "label": string, "isActionCommitment": boolean}] } }',
    "primary: 2-4 choices. tradeoff: 2-3 choices. actionDecision: 2-3 choices. Every choice id must be a short unique stable slug (e.g. \"primary_1\"). No id may repeat across phases. No empty labels.",
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
    return { draft: result.value, warnings: result.warnings };
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
  // The template is authored to validate; re-run to surface any sensitive-info
  // warnings that came from the guided answers (host free text).
  const check = parseArenaScenarioDraft(draft);
  return { draft, source: "template", warnings: check.ok ? check.warnings : [] };
}

export type { Locale };
