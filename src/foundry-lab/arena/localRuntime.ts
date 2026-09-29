/**
 * BTY FOUNDRY LAB — local runtime preflight (M0).
 *
 * MEASURED DEFECT (first local smoke, run 20260929T050441Z): Ollama served `gemma4:31b` with its
 * server-default 4096-token context. The generator's prompt is ~4.8k tokens, and both provider
 * calls reported `prompt_tokens: 4096` exactly — the prompt was silently TRUNCATED, and the
 * resulting refusal described a clipped prompt, not the Training Builder. Nothing failed loudly.
 *
 * So before a local run the harness asks the runtime what context it will actually use, records
 * it in the run identity, and refuses a context too small to hold the prompt plus the generator's
 * own output budget. After every call it also flags a prompt that filled the window exactly.
 * Ollama's OpenAI-compatible endpoint cannot take `num_ctx` per request, so the fix is a derived
 * local model (`PARAMETER num_ctx …`), never a change to the generator.
 */

/** Generator prompt (~4.8k tokens) + its MAX_TOKENS (2600) + headroom. */
export const MIN_CONTEXT_TOKENS = 12_288;

export type LocalRuntime = {
  kind: "ollama" | "unknown";
  version: string | null;
  /** The context the model will actually be served with, when the runtime says so. */
  num_ctx: number | null;
  /** The model's maximum supported context, for information. */
  model_context_length: number | null;
};

export function nativeBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
}

/** Pure: read Ollama's `/api/show` answer. `parameters` is a whitespace table of name/value lines. */
export function parseOllamaShow(show: unknown): { num_ctx: number | null; model_context_length: number | null } {
  const s = (show ?? {}) as { parameters?: unknown; model_info?: Record<string, unknown> };
  const params = typeof s.parameters === "string" ? s.parameters : "";
  const m = params.match(/^\s*num_ctx\s+(\d+)\s*$/m);
  const ctxKey = Object.keys(s.model_info ?? {}).find((k) => k.endsWith(".context_length"));
  const mcl = ctxKey ? Number((s.model_info as Record<string, unknown>)[ctxKey]) : NaN;
  return { num_ctx: m ? Number(m[1]) : null, model_context_length: Number.isFinite(mcl) ? mcl : null };
}

export async function probeLocalRuntime(baseUrl: string, model: string, fetchImpl: typeof fetch = fetch): Promise<LocalRuntime> {
  const base = nativeBase(baseUrl);
  try {
    const [v, show] = await Promise.all([
      fetchImpl(`${base}/api/version`).then((r) => (r.ok ? r.json() : null)),
      fetchImpl(`${base}/api/show`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model }) }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (!v || !show) return { kind: "unknown", version: null, num_ctx: null, model_context_length: null };
    return { kind: "ollama", version: typeof (v as { version?: unknown }).version === "string" ? (v as { version: string }).version : null, ...parseOllamaShow(show) };
  } catch {
    return { kind: "unknown", version: null, num_ctx: null, model_context_length: null };
  }
}

/**
 * Refuse a context that cannot hold the generator's prompt. An Ollama model with NO explicit
 * `num_ctx` runs at the server default (4096 was observed), so it is refused too — the operator
 * must choose a context deliberately. A non-Ollama runtime cannot be asked; it is allowed, and the
 * per-call truncation flag below still applies.
 */
export function contextProblem(rt: LocalRuntime): string | null {
  if (rt.kind !== "ollama") return null;
  if (rt.num_ctx === null) return `model has no explicit num_ctx (server default applies; 4096 was observed). Create a derived model with PARAMETER num_ctx >= ${MIN_CONTEXT_TOKENS}`;
  if (rt.num_ctx < MIN_CONTEXT_TOKENS) return `num_ctx ${rt.num_ctx} < ${MIN_CONTEXT_TOKENS} required for the generator prompt and output budget`;
  return null;
}

/** A call whose prompt exactly filled (or exceeded) the window was almost certainly truncated. */
export function promptLikelyTruncated(promptTokens: unknown, numCtx: number | null): boolean {
  if (typeof promptTokens !== "number") return false;
  if (numCtx !== null) return promptTokens >= numCtx;
  return [2048, 4096, 8192].includes(promptTokens);
}
