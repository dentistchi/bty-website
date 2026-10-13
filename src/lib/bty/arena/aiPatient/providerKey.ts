/**
 * AI Patient uses its own OpenAI project and API key, never the BTY-wide
 * OPENAI_API_KEY, LLM_API_KEY or LLM_BASE_URL. Missing key = unavailable.
 * This is server-only. Never pass the key to client code or logs.
 */
export function aiPatientOpenAIKey(): string {
  return process.env.AI_PATIENT_OPENAI_API_KEY?.trim() ?? "";
}
