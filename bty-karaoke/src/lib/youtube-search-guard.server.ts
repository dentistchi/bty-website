// BUILD R2.5 — abuse containment for the public YouTube search endpoint.
//
// THE HOLE THIS CLOSES. `GET /api/youtube/search` is public, anonymous and cookieless, and the KV
// cache is keyed on the biased query — so it defends against REPEATS and offers nothing against
// NOVELTY. ~1,000 unique cold queries drain the entire daily Search Queries grant, which costs an
// attacker one shell loop. Google's 429 breaker only trips after the grant is already gone.
//
// TWO GUARDS, DELIBERATELY DIFFERENT IN STRENGTH:
//
//   1. PER-IP LIMIT (KV, best-effort). Cheap, colo-local, and non-atomic: a burst can overshoot
//      its own window slightly. That is acceptable because it is not the thing standing between an
//      attacker and the grant — it is the thing that makes a drain expensive and slow.
//
//   2. DAILY BUDGET RESERVATION (Postgres, EXACT). Cloudflare KV has no atomic increment and is
//      eventually consistent between colos, so a KV ceiling could be overshot by an unbounded
//      amount under exactly the distributed burst it exists to stop — and a counter that cannot be
//      trusted at its threshold is worse than none, because it reads as protection. The
//      reservation is one row-locked statement, proven exact under concurrency.
//
// NEITHER GUARD MAY EVER BLOCK A CACHE HIT. A hit costs zero quota, so refusing it would punish
// guests for an attack without protecting anything.
//
// PRIVACY: no raw IP is stored or logged. The per-IP key is an HMAC pseudonym built by the same
// construction the PIN limiter has always used, under the same dedicated secret. The budget table
// stores a date and a count — no identifier of any kind.

import { pseudonymizeIp, rateLimitSecret, type RateLimitKv } from './rate-limit.server';

/** Per-IP window. Generous: a singer choosing songs all night stays far below it. */
export const SEARCH_IP_MAX = 20;
export const SEARCH_IP_WINDOW_SECONDS = 600; // 10 minutes

/**
 * Daily outbound ceiling, of the 1,000/day grant. The remaining 150 are a deliberate HARD RESERVE:
 * if a drain (or an unusually busy night) reaches the soft ceiling, an operator and genuine
 * late-evening rooms still have room to work with, and the reserve can be released by hand.
 */
export const SEARCH_DAILY_SOFT_CEILING = 850;

/** Scope string for the pseudonym, so a search key can never collide with a PIN/auth key. */
const IP_SCOPE = 'youtube-search';

/** KV key for one pseudonymized client. Pure — unit-tested. */
export function searchRateLimitKey(ipHash: string): string {
  return `ytrl:${ipHash}`;
}

/**
 * The client IP as Cloudflare reports it. `cf-connecting-ip` is set BY the edge and cannot be
 * spoofed by the client; `x-forwarded-for` CAN be, so it is deliberately not used as a fallback —
 * a limiter keyed on an attacker-chosen value is not a limiter. Absent header (local dev, direct
 * origin hit) yields null and the limit is skipped rather than bucketing every such request into
 * one shared key, which would let one client lock out everybody.
 */
export function cloudflareClientIp(headers: { get(name: string): string | null }): string | null {
  const ip = headers.get('cf-connecting-ip');
  return ip && ip.trim() ? ip.trim() : null;
}

async function resolveKv(): Promise<RateLimitKv | null> {
  try {
    const mod = await import('@opennextjs/cloudflare');
    const env = mod.getCloudflareContext().env as Record<string, unknown>;
    return (env?.KARAOKE_SEARCH_KV as RateLimitKv) ?? null;
  } catch {
    return null;
  }
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Attempts already counted in this window, or null when the limiter is not in effect. */
  count: number | null;
}

const ALLOW: RateLimitVerdict = { allowed: true, count: null };

/**
 * Count one search attempt against this client's window.
 *
 * FAIL-OPEN, matching the house rule for every non-auth limiter in this repo: a missing secret, a
 * missing KV binding, an unreadable counter, or an absent edge IP all mean "allowed". The reason
 * is that this guard is not load-bearing for the grant — the exact daily reservation is — so
 * failing it closed would take guest search offline to protect something already protected.
 *
 * The window is a fixed KV counter with a TTL, so it is read-modify-write and NOT atomic. A
 * simultaneous burst from one IP can therefore admit a few more than SEARCH_IP_MAX. That is
 * bounded, and the daily reservation catches what leaks through.
 */
export async function checkSearchRateLimit(ip: string | null): Promise<RateLimitVerdict> {
  if (!ip) return ALLOW;
  const secret = rateLimitSecret();
  if (!secret) return ALLOW;
  try {
    const kv = await resolveKv();
    if (!kv) return ALLOW;
    const key = searchRateLimitKey(await pseudonymizeIp(secret, IP_SCOPE, ip));
    const current = Number(await kv.get(key)) || 0;
    if (current >= SEARCH_IP_MAX) return { allowed: false, count: current };
    await kv.put(key, String(current + 1), { expirationTtl: SEARCH_IP_WINDOW_SECONDS });
    return { allowed: true, count: current + 1 };
  } catch {
    return ALLOW; // never let a limiter outage become a search outage
  }
}

export interface BudgetVerdict {
  granted: boolean;
  /** Slots taken today (Pacific), or null when the reservation could not be consulted. */
  reserved: number | null;
}

/**
 * Reserve ONE slot of today's outbound budget, immediately before a real `search.list` request.
 *
 * A slot is taken BEFORE the request is issued, so `reserved` is always >= the calls actually made
 * — if a reserved request then fails before reaching Google, the slot stays spent. The error is in
 * the safe direction, and BUILD R2's call table remains the truth for what was really consumed.
 *
 * FAIL-OPEN on an unreachable database. A DB outage is independent of an attack, and refusing every
 * cold search during one would be a self-inflicted outage; Google's own 429 and the existing
 * circuit breaker remain the last line in that window.
 */
export async function reserveSearchBudget(
  ceiling: number = SEARCH_DAILY_SOFT_CEILING,
): Promise<BudgetVerdict> {
  try {
    const mod = await import('./supabase.server');
    const client = mod.karaokeDb() as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    };
    const { data, error } = await client.rpc('karaoke_reserve_youtube_search', { p_ceiling: ceiling });
    // supabase-js RETURNS `{ error }` rather than throwing, so a bare try/catch would read a
    // failed reservation as a refusal and start blocking every cold search.
    if (error || !data || typeof data !== 'object') return { granted: true, reserved: null };
    const d = data as { granted?: boolean; reserved?: number };
    return { granted: d.granted !== false, reserved: typeof d.reserved === 'number' ? d.reserved : null };
  } catch {
    return { granted: true, reserved: null };
  }
}
