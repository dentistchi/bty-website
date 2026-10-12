/**
 * AI PATIENT — the ONE provider credential every paid AI Patient call uses.
 *
 * WHY. The per-user KV limiter undercounts bursts (production, 2026-10-12: 42 calls counted as 23),
 * so it cannot be the spending ceiling. The ceiling is the provider's own: AI Patient runs on a
 * dedicated OpenAI project key, `AI_PATIENT_OPENAI_API_KEY`, and that project carries an ENFORCED
 * hard monthly spend limit (requests then fail with 429 `project_spend_limit_exceeded`). Nothing else
 * in BTY uses this key, and AI Patient uses nothing else.
 *
 * Covers conversation, coaching feedback, the safety screen, transcription and speech.
 *
 * FAIL CLOSED. In deployed environments (BTY_ENV staging/production) there is no fallback to the
 * shared OPENAI_API_KEY: without the dedicated key the feature answers "not configured" and spends
 * nothing. Local/test may fall back to OPENAI_API_KEY so development needs no extra variable.
 *
 * Always the OpenAI endpoint: AI Patient's models are OpenAI models, so the LLM_BASE_URL switch for
 * local chat models does not apply here. The key is never logged or returned to a client.
 */

import { LlmClient } from "@/lib/bty/llm/client";

export const AI_PATIENT_OPENAI_BASE = "https://api.openai.com/v1";

function isDeployedEnv(): boolean {
  const env = process.env.BTY_ENV;
  return env === "production" || env === "staging";
}

/** The dedicated key, or null when AI Patient must not run. */
export function aiPatientApiKey(): string | null {
  const dedicated = process.env.AI_PATIENT_OPENAI_API_KEY?.trim();
  if (dedicated) return dedicated;
  if (isDeployedEnv()) return null;
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export const isAiPatientProviderConfigured = (): boolean => aiPatientApiKey() !== null;

export class AiPatientProviderUnconfigured extends Error {
  readonly name = "AiPatientProviderUnconfigured";
}

/** Chat completions on the dedicated key. Throws when the dedicated key is not configured. */
export function aiPatientLlm(): LlmClient {
  const key = aiPatientApiKey();
  if (!key) throw new AiPatientProviderUnconfigured("AI patient provider key is not configured");
  return new LlmClient(`${AI_PATIENT_OPENAI_BASE}/chat/completions`, key);
}
