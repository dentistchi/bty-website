// Server-only, best-effort rate limiting for Admin PIN enrollment. State lives in
// Cloudflare KV (ephemeral, TTL'd). Keys are HMAC-pseudonymized with a DEDICATED
// server secret (never the service-role key); raw IPs are never stored or logged.
// Layered: a fast per-(room,IP) limit + a slower room-wide ceiling.

import { optionalEnv } from './env.server';

export interface RateLimitKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// Thresholds / TTLs (seconds).
export const IP_MAX = 5;
export const IP_WINDOW = 900;
export const IP_LOCK = 900;
export const ROOM_MAX = 20;
export const ROOM_WINDOW = 3600;
export const ROOM_LOCK = 1800;

const enc = new TextEncoder();

/** The dedicated rate-limit secret, or null when unconfigured (enrollment disabled). */
export function rateLimitSecret(): string | null {
  return optionalEnv('KARAOKE_RATELIMIT_SECRET') ?? null;
}

/** KV keys for a room + pseudonymized IP. Pure — unit-tested. */
export function rateLimitKeys(roomId: string, ipHash: string) {
  return {
    ipFail: `apin:fail:ip:${roomId}:${ipHash}`,
    ipLock: `apin:lock:ip:${roomId}:${ipHash}`,
    roomFail: `apin:fail:room:${roomId}`,
    roomLock: `apin:lock:room:${roomId}`,
  };
}

/** Pure: a new failure count reaching the max should trip the lock. */
export function shouldLock(newCount: number, max: number): boolean {
  return newCount >= max;
}

async function ipPseudonym(secret: string, roomId: string, ip: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${roomId}|${ip}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32); // 128-bit pseudonym
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

/**
 * BUILD R2.5 — the SAME pseudonymization, exported for limiters that are not the PIN/auth shape.
 * A raw IP is never stored anywhere; this is the one construction that turns one into a key.
 * Additive: the enrollment limiter above is unchanged and still calls the private function.
 */
export async function pseudonymizeIp(secret: string, scope: string, ip: string): Promise<string> {
  return ipPseudonym(secret, scope, ip);
}

export interface Limiter {
  roomId: string;
  ipHash: string;
  kv: RateLimitKv | null;
}

/**
 * Build a limiter for this attempt. Returns null when the dedicated secret is
 * missing — the caller must then DISABLE enrollment (generic unavailable), never
 * fall back to another credential. A null KV (e.g. local dev) means limits are
 * skipped but enrollment still works.
 */
export async function makeLimiter(roomId: string, ip: string): Promise<Limiter | null> {
  const secret = rateLimitSecret();
  if (!secret) return null;
  const ipHash = await ipPseudonym(secret, roomId, ip);
  return { roomId, ipHash, kv: await resolveKv() };
}

/** True if this room or (room,IP) is currently locked out. */
export async function isLockedOut(l: Limiter): Promise<boolean> {
  if (!l.kv) return false;
  const k = rateLimitKeys(l.roomId, l.ipHash);
  const [ipLock, roomLock] = await Promise.all([l.kv.get(k.ipLock), l.kv.get(k.roomLock)]);
  return Boolean(ipLock || roomLock);
}

/** Record one failed attempt; trip locks at the thresholds. */
export async function recordFailure(l: Limiter): Promise<void> {
  if (!l.kv) return;
  const k = rateLimitKeys(l.roomId, l.ipHash);
  const ipN = Number(await l.kv.get(k.ipFail)) + 1 || 1;
  await l.kv.put(k.ipFail, String(ipN), { expirationTtl: IP_WINDOW });
  if (shouldLock(ipN, IP_MAX)) await l.kv.put(k.ipLock, '1', { expirationTtl: IP_LOCK });

  const roomN = Number(await l.kv.get(k.roomFail)) + 1 || 1;
  await l.kv.put(k.roomFail, String(roomN), { expirationTtl: ROOM_WINDOW });
  if (shouldLock(roomN, ROOM_MAX)) await l.kv.put(k.roomLock, '1', { expirationTtl: ROOM_LOCK });
}

/** On success, clear the IP counters/lock and the room fail counter. */
export async function recordSuccess(l: Limiter): Promise<void> {
  if (!l.kv) return;
  const k = rateLimitKeys(l.roomId, l.ipHash);
  await Promise.all([l.kv.delete(k.ipFail), l.kv.delete(k.ipLock), l.kv.delete(k.roomFail)]);
}
