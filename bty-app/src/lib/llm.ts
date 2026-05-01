/**
 * LLM endpoint resolver.
 * Set LLM_BASE_URL (e.g. http://100.x.x.x:11434/v1) to route all LLM calls
 * to a local OpenAI-compatible endpoint (Ollama/Gemma4 via Tailscale).
 * Falls back to OPENAI_API_KEY + api.openai.com when LLM_BASE_URL is unset.
 */

export type LlmEndpoint = {
  url: string;
  apiKey: string;
  model: string;
  isLocal: boolean;
};

export function getLlmEndpoint(overrideModel?: string): LlmEndpoint {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  if (baseUrl) {
    return {
      url: baseUrl.replace(/\/$/, "") + "/chat/completions",
      apiKey: process.env.LLM_API_KEY ?? "ollama",
      model: overrideModel ?? process.env.LLM_MODEL ?? "gemma4:31b",
      isLocal: true,
    };
  }
  return {
    url: "https://api.openai.com/v1/chat/completions",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: overrideModel ?? "gpt-4o-mini",
    isLocal: false,
  };
}

export function isLlmAvailable(): boolean {
  return !!(process.env.LLM_BASE_URL || process.env.OPENAI_API_KEY);
}

/** Ollama 전용 추가 파라미터. LLM_BASE_URL 미설정 시 빈 객체 반환 (OpenAI 호환). */
export function getLlmExtraOptions(): Record<string, unknown> {
  if (process.env.LLM_BASE_URL) {
    return { reasoning_effort: "none" };
  }
  return {};
}
