/**
 * In-memory rate limiter for API routes (e.g. /api/chat, /api/mentor).
 * Key by IP (or identifier). Window: 1 minute; max requests per window configurable.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_PER_WINDOW = 60; // 60 requests per minute per key

const store = new Map<string, { count: number; resetAt: number }>();

function getKey(identifier: string): string {
  return identifier.trim() || "anonymous";
}

function prune(key: string, now: number): void {
  const entry = store.get(key);
  if (entry && now >= entry.resetAt) store.delete(key);
}

/**
 * Check and consume one request for the given key.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
export function checkRateLimit(
  identifier: string,
  maxPerWindow: number = DEFAULT_MAX_PER_WINDOW
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const key = getKey(identifier);
  const now = Date.now();
  prune(key, now);

  let entry = store.get(key);
  if (!entry) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true };
  }

  if (entry.count >= maxPerWindow) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  entry.count += 1;
  return { allowed: true };
}

/**
 * Get client identifier from request (x-forwarded-for, x-real-ip, or fallback).
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous";
}

import { getCloudflareContext } from "@opennextjs/cloudflare";

// Minimal local KV interface — narrowest surface this file needs.
// Avoids project-wide inclusion of worker-configuration.d.ts which would
// surface ~1280 pre-existing strictness regressions from Cloudflare ambient types.
type RateLimitKV = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options: { expirationTtl: number }
  ): Promise<void>;
};

/**
 * Cloudflare-aware client IP extraction (preferred for auth endpoints).
 * `cf-connecting-ip` is the canonical Cloudflare-stamped client IP.
 */
export function getCfClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "anonymous";

  return "anonymous";
}

/**
 * KV-backed rate limit for auth endpoints.
 *
 * Cloudflare Workers isolate-safe (KV is global).
 * Key hashed (SHA-256 first 16 hex) — no PII in KV storage.
 * TTL = windowSeconds (KV auto-cleanup, min 60s).
 *
 * Fail policy (Env-aware):
 *   - BTY_ENV === "staging" or "production" → fail-closed (60s retryAfter)
 *   - Otherwise (local dev / test) → fail-open + warn
 */
export async function rateLimitKV(opts: {
  endpoint: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  let kv: RateLimitKV | undefined;

  try {
    const ctx = getCloudflareContext();
    kv = (ctx.env as unknown as { RATE_LIMIT_KV?: RateLimitKV }).RATE_LIMIT_KV;
  } catch {
    kv = undefined;
  }

  if (!kv) {
    const envName = process.env.BTY_ENV;
    if (envName === "staging" || envName === "production") {
      console.error(
        `[rate-limit-kv] RATE_LIMIT_KV binding MISSING in ${envName}, ` +
          `failing closed for endpoint=${opts.endpoint}`
      );
      return { allowed: false, retryAfterSeconds: 60 };
    }
    console.warn(
      `[rate-limit-kv] RATE_LIMIT_KV binding missing (env=${envName ?? "unset"}), ` +
        `failing open for endpoint=${opts.endpoint}`
    );
    return { allowed: true };
  }

  const hashed = await sha256Hex(opts.identifier);
  const key = `rl:auth:${opts.endpoint}:${hashed.slice(0, 16)}`;

  const raw = await kv.get(key);
  const now = Math.floor(Date.now() / 1000);

  let count = 0;
  let resetAt = now + opts.windowSeconds;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        count = parsed.count;
        resetAt = parsed.resetAt;
      }
    } catch {
      // Corrupt entry — restart window
    }
  }

  if (count >= opts.limit) {
    return { allowed: false, retryAfterSeconds: resetAt - now };
  }

  count += 1;
  const ttl = resetAt - now;
  await kv.put(key, JSON.stringify({ count, resetAt }), {
    expirationTtl: Math.max(ttl, 60),
  });

  return { allowed: true };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
