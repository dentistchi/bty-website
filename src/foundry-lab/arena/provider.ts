/**
 * BTY FOUNDRY LAB — model/provider identity and safety (M0).
 *
 * The production generator reads its provider from the environment (`src/lib/bty/llm/client.ts`):
 * `LLM_BASE_URL` set → that OpenAI-compatible endpoint; unset → api.openai.com with
 * `LLM_API_KEY ?? OPENAI_API_KEY`. Two consequences the lab must guard against, because a developer
 * machine commonly has `OPENAI_API_KEY` exported for other work:
 *
 *   * with no base URL, a benchmark would SILENTLY spend on the paid provider;
 *   * with a local base URL, the client would still send `OPENAI_API_KEY` as the Bearer token to
 *     the local server.
 *
 * So the lab configures the environment itself, strips provider keys in local mode, and refuses
 * a paid provider unless it is explicitly allowed. Model choice is runtime configuration only —
 * no benchmark case names a model.
 */

export type ProviderMode = "local" | "frontier" | "mock";

export type ProviderConfig = {
  mode: ProviderMode;
  /** OpenAI-compatible base URL (…/v1). Local mode only. */
  baseUrl: string | null;
  model: string;
};

/** What a run records about its provider. Never a key, never a header, never a full URL. */
export type ProviderIdentity = {
  provider_mode: "local" | "frontier" | "mock" | "unknown";
  base_url_class: "loopback" | "private_network" | "public" | "absent";
  base_url_host: string | null;
  model: string;
};

const PRIVATE_V4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

export function classifyBaseUrl(baseUrl: string | null | undefined): ProviderIdentity["base_url_class"] {
  if (!baseUrl || !baseUrl.trim()) return "absent";
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return "public";
  }
  if (host === "localhost" || host === "::1" || host === "[::1]" || /^127\./.test(host)) return "loopback";
  if (PRIVATE_V4.test(host) || host.endsWith(".local") || host.endsWith(".ts.net")) return "private_network";
  return "public";
}

export function providerIdentity(cfg: ProviderConfig): ProviderIdentity {
  let host: string | null = null;
  if (cfg.baseUrl) {
    try {
      host = new URL(cfg.baseUrl).hostname;
    } catch {
      host = null;
    }
  }
  return {
    provider_mode: cfg.mode,
    base_url_class: classifyBaseUrl(cfg.baseUrl),
    base_url_host: cfg.mode === "local" ? host : null,
    model: cfg.model,
  };
}

const PROVIDER_ENV_KEYS = ["LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY", "OPENAI_API_KEY"] as const;

export class PaidProviderNotAllowed extends Error {
  readonly name = "PaidProviderNotAllowed";
}

/**
 * Point the production LLM client at the chosen provider — and at nothing else.
 *
 *   local:    LLM_BASE_URL + LLM_MODEL set; every API key REMOVED (the client then sends its local
 *             placeholder). The base URL must be loopback or private-network.
 *   frontier: refused unless `allowPaid` — M0 has no authority to spend.
 *   mock:     keys removed and a non-routable base URL set, so a missing fetch stub cannot reach
 *             any real service.
 *
 * Returns the previous values so a test can restore them.
 */
export function applyProviderEnv(cfg: ProviderConfig, opts: { allowPaid?: boolean } = {}, env: NodeJS.ProcessEnv = process.env): Record<string, string | undefined> {
  const previous = Object.fromEntries(PROVIDER_ENV_KEYS.map((k) => [k, env[k]]));
  if (!cfg.model.trim()) throw new Error("model is required (runtime configuration; cases never name a model)");
  if (cfg.mode === "frontier") {
    if (!opts.allowPaid) throw new PaidProviderNotAllowed("frontier provider requires explicit --allow-paid-provider authorization");
    delete env.LLM_BASE_URL;
    env.LLM_MODEL = cfg.model;
    return previous;
  }
  for (const k of ["LLM_API_KEY", "OPENAI_API_KEY"] as const) delete env[k];
  if (cfg.mode === "local") {
    const cls = classifyBaseUrl(cfg.baseUrl);
    if (cls !== "loopback" && cls !== "private_network") throw new Error(`local provider base URL must be loopback or private-network (got ${cls})`);
    env.LLM_BASE_URL = cfg.baseUrl!;
  } else {
    env.LLM_BASE_URL = "http://127.0.0.1:9/foundry-mock/v1";
  }
  env.LLM_MODEL = cfg.model;
  return previous;
}

/** Keys that must never be persisted, whatever object they appear in. */
const SECRET_KEY_RE = /(api[_-]?key|authorization|secret|password|bearer|cookie|service[_-]?role)/i;
/** Values that look like credentials, wherever they appear. */
const SECRET_VALUE_RE = /(sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9._-]{8,})/g;

/**
 * Deep copy with credential-shaped keys removed and credential-shaped values masked. Applied to
 * every record before it touches disk. `prompt_tokens` and friends are counts, not secrets, and
 * are kept: the key rule matches names like `api_key`, never the word "token".
 */
export function redact<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(SECRET_VALUE_RE, "[REDACTED]");
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (SECRET_KEY_RE.test(k)) continue;
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
