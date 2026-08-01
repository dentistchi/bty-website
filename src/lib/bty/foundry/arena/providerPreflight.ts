/**
 * PROVIDER PREFLIGHT (Slice 3.2I-R5B1A.1-R2.23D-R2).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D-R1 runner passed all 22 contract checks, read the credential, and then died before it
 * could send anything:
 *
 *   /eval.ts:1:48: ERROR: Top-level await is currently not supported with the "cjs" output format
 *
 * `package.json` declares no `"type"`, so tsx compiles to CommonJS, and CommonJS cannot represent a
 * top-level `await`. Measured, and worth stating precisely: a tracked `.ts` FILE fails identically.
 * Moving off `tsx -e` is not the fix — wrapping the work in an `async main()` is.
 *
 * WHAT THIS MODULE IS
 *
 * The two capability checks, as a pure function over an injected client. Keeping them here rather
 * than in the CLI is what makes them testable without a provider: the runner ran a program nobody
 * had ever executed, which is exactly how a transform error reached an operator who had already
 * typed a credential.
 *
 * It never prints a key, a header, a request body or a provider response body.
 */

/** The minimal shape both checks need — satisfied by the real OpenAI-compatible client. */
export type PreflightClient = {
  chat: { completions: { create: (params: Record<string, unknown>, opts?: unknown) => Promise<unknown> } };
};

export type PreflightConfig = {
  model: string;
  timeoutMs: number;
};

export const PREFLIGHT_CODES = [
  "credential_or_model_unavailable",
  "structured_output_unavailable",
  "provider_refusal",
  "malformed_provider_response",
  "provider_timeout",
] as const;
export type PreflightCode = (typeof PREFLIGHT_CODES)[number];

export type PreflightResult =
  | { ok: true; checks: { capability: true; strictSchema: true }; model: string }
  | { ok: false; code: PreflightCode; failedCheck: "capability" | "strict_schema"; status: number | null };

/**
 * The smallest strict schema that still proves the endpoint honours `json_schema` strict mode:
 * every property named, `additionalProperties:false`, and no scenario content requested.
 */
export const PREFLIGHT_STRICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
} as const;
export const PREFLIGHT_SCHEMA_NAME = "bty_practice_preflight_v1";

/**
 * Extract an HTTP status without touching the message.
 *
 * A provider SDK error can carry request headers on `error.request`, so nothing but a numeric
 * status ever leaves this function. The message is never read, logged or returned.
 */
function statusOf(e: unknown): number | null {
  const s = (e as { status?: unknown })?.status;
  return typeof s === "number" ? s : null;
}

const isTimeout = (e: unknown): boolean => {
  const name = (e as { name?: unknown })?.name;
  return name === "AbortError" || name === "TimeoutError" || (e as { code?: unknown })?.code === "ETIMEDOUT";
};

/**
 * Run BOTH capability checks against an injected client.
 *
 * They stay separate on purpose: a valid credential proves nothing about strict structured output,
 * and the whole generation contract depends on strict `json_schema` being honoured. A run that
 * reported success on credential validity alone would be the same false assurance this arc has
 * spent several slices removing.
 */
export async function runProviderPreflight(client: PreflightClient, config: PreflightConfig): Promise<PreflightResult> {
  // --- A. credential / model capability -------------------------------------
  // The smallest request that proves the credential works and the configured model exists. It asks
  // for one token and no scenario content, so it can never produce Practice material.
  try {
    const res = await withTimeout(
      client.chat.completions.create({
        model: config.model,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 1,
      }),
      config.timeoutMs,
    );
    if (!isObj(res) || !Array.isArray((res as { choices?: unknown }).choices)) {
      return { ok: false, code: "malformed_provider_response", failedCheck: "capability", status: null };
    }
    if (refusalOf(res)) return { ok: false, code: "provider_refusal", failedCheck: "capability", status: null };
  } catch (e) {
    if (isTimeout(e)) return { ok: false, code: "provider_timeout", failedCheck: "capability", status: statusOf(e) };
    return { ok: false, code: "credential_or_model_unavailable", failedCheck: "capability", status: statusOf(e) };
  }

  // --- B. strict structured output ------------------------------------------
  try {
    const res = await withTimeout(
      client.chat.completions.create({
        model: config.model,
        messages: [{ role: "user", content: "Return {\"ok\": true}." }],
        max_tokens: 16,
        response_format: {
          type: "json_schema",
          json_schema: { name: PREFLIGHT_SCHEMA_NAME, strict: true, schema: PREFLIGHT_STRICT_SCHEMA },
        },
      }),
      config.timeoutMs,
    );
    if (!isObj(res) || !Array.isArray((res as { choices?: unknown }).choices)) {
      return { ok: false, code: "malformed_provider_response", failedCheck: "strict_schema", status: null };
    }
    if (refusalOf(res)) return { ok: false, code: "provider_refusal", failedCheck: "strict_schema", status: null };
  } catch (e) {
    if (isTimeout(e)) return { ok: false, code: "provider_timeout", failedCheck: "strict_schema", status: statusOf(e) };
    return { ok: false, code: "structured_output_unavailable", failedCheck: "strict_schema", status: statusOf(e) };
  }

  return { ok: true, checks: { capability: true, strictSchema: true }, model: config.model };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function refusalOf(res: unknown): boolean {
  const first = (res as { choices?: Array<{ message?: { refusal?: unknown } }> })?.choices?.[0];
  const refusal = first?.message?.refusal;
  return typeof refusal === "string" && refusal.length > 0;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const e = new Error("provider preflight timed out");
      e.name = "TimeoutError";
      reject(e);
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * The one line a preflight prints. Codes and a numeric status only — never a message, a header, a
 * key or a response body.
 */
export function formatPreflightResult(r: PreflightResult): string {
  if (r.ok) return `PROVIDER PREFLIGHT PASS · capability=ok · strict_schema=ok · model=${r.model}`;
  const status = r.status === null ? "none" : String(r.status);
  return `PROVIDER PREFLIGHT FAIL · check=${r.failedCheck} · code=${r.code} · status=${status}`;
}
