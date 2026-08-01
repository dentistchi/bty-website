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

/**
 * OpenAI-compatible completion envelope. `finish_reason` and `refusal` are part of the contract
 * and are NOT decorative: `finish_reason: "length"` means the body was truncated (parsing it would
 * misreport a malformed shape), and a non-null `refusal` is an explicit safe refusal that must
 * never be treated as generated content (Slice 3.2I-R2.15).
 */
type LlmCompletion = {
  choices: {
    message: { content: string | null; refusal?: string | null };
    finish_reason?: string;
  }[];
};

type LlmCreateOptions = { signal?: AbortSignal };

/**
 * A provider HTTP failure, with the status STRUCTURED rather than encoded in a message.
 *
 * R2.33 measured the cost of the previous shape: the client threw `Error("LLM API error: 401 ...")`,
 * the status existed only inside the string, and a caller's `catch { }` discarded it. Classification
 * then had to guess. These fields let a caller classify from structured evidence and fall back to
 * message parsing only when it must — and say which it did.
 *
 * `body` is the provider's error payload when it parsed; never a request, never a header.
 */
export class LlmHttpError extends Error {
  readonly name = "LlmHttpError";
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown = null,
    readonly retryAfterSeconds: number | null = null,
    readonly requestId: string | null = null,
  ) {
    super(`LLM API error: ${status} ${statusText}`);
  }
}

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
      // Read the provider's error payload when it offers one. A failure here must never mask the
      // status, so parsing is best-effort and the status is carried regardless.
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const retryAfterRaw = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterRaw && /^\d+$/.test(retryAfterRaw.trim()) ? Number(retryAfterRaw.trim()) : null;
      throw new LlmHttpError(
        response.status,
        response.statusText,
        body,
        retryAfterSeconds,
        response.headers.get("x-request-id"),
      );
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
  // Honor every credential getLlmClient() accepts — including the LLM_API_KEY alias
  // (Slice 3.2I-R2: the alias-only case previously read as "unavailable").
  return !!(process.env.LLM_BASE_URL || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);
}
