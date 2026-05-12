/**
 * LLM client with env-based endpoint switching.
 * - LLM_BASE_URL set → use it (e.g. local Ollama at http://100.x.x.x:11434/v1)
 * - LLM_BASE_URL unset → fall back to OpenAI default (api.openai.com/v1)
 *
 * Uses native fetch with an OpenAI-compatible interface so the same code works
 * for both Ollama and OpenAI endpoints. Compatible with Cloudflare Workers runtime.
 */

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type LlmCreateParams = {
  model: string;
  messages: LlmChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  [key: string]: unknown;
};

type LlmCompletion = {
  choices: { message: { content: string | null }; finish_reason?: string }[];
};

type LlmCreateOptions = { signal?: AbortSignal };

class LlmChatCompletions {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly extraBody: Record<string, unknown>,
  ) {}

  async create(params: LlmCreateParams, options?: LlmCreateOptions): Promise<LlmCompletion> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...params, ...this.extraBody }),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<LlmCompletion>;
  }
}

export class LlmClient {
  readonly chat: { completions: LlmChatCompletions };

  constructor(url: string, apiKey: string, extraBody: Record<string, unknown> = {}) {
    this.chat = { completions: new LlmChatCompletions(url, apiKey, extraBody) };
  }
}

export function getLlmClient(): LlmClient {
  const baseURL = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

  if (!apiKey && !baseURL) {
    throw new Error(
      "LLM client unavailable: neither LLM_BASE_URL nor OPENAI_API_KEY set",
    );
  }

  if (baseURL) {
    const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;
    return new LlmClient(url, apiKey || "ollama", { reasoning_effort: "none" });
  }

  return new LlmClient(
    "https://api.openai.com/v1/chat/completions",
    apiKey,
  );
}

export function getLlmModel(): string {
  return process.env.LLM_MODEL ?? "gpt-4o-mini";
}

/** Returns true when running against a local/self-hosted endpoint. */
export function isLocalLlm(): boolean {
  return Boolean(process.env.LLM_BASE_URL?.trim());
}

export function isLlmAvailable(): boolean {
  return !!(process.env.LLM_BASE_URL || process.env.OPENAI_API_KEY);
}
