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
