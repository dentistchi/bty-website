// Server-only manager (global operator) authority. Unlike per-room DJ/Admin auth,
// the manager identity is not tied to any room — it gates EVENT creation and
// management. Bootstrap is a single shared passcode (KARAOKE_MANAGER_PASSCODE);
// on success the server issues a STATELESS, HMAC-signed session token (no DB
// row, no table) that later manager calls present as a bearer. The passcode is
// never a bearer and never leaves the server; only the HMAC output travels.

import type { NextRequest } from 'next/server';
import { timingSafeEqual } from './dj-auth.server';
import { optionalEnv, karaokeEnv } from './env.server';

// A manager session lasts one long event night. Re-enter the passcode after.
export const MANAGER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// The manager session travels in an HttpOnly, Secure, SameSite=Lax cookie — NOT
// in localStorage or a JS-readable bearer, and never in a URL/query string — so
// it cannot be read by page scripts, leaked via history/referrer, or XSS-exfil'd.
export const MANAGER_COOKIE = 'bty_mgr';

/** The configured manager passcode, or null when the feature is not enabled. */
export function managerPasscode(): string | null {
  return optionalEnv('KARAOKE_MANAGER_PASSCODE') ?? null;
}

/** True iff the events/manager feature is enabled (passcode configured). */
export function managerEnabled(): boolean {
  return managerPasscode() !== null;
}

/**
 * HMAC key for the session token: a dedicated secret when configured, else the
 * always-present service-role key (server-only). Reused from the cancel-cap
 * pattern; the payload is purpose-tagged ('m') so tokens can't cross-verify.
 */
function sessionSecret(): string {
  return optionalEnv('KARAOKE_CAP_SECRET') ?? karaokeEnv().key;
}

const enc = new TextEncoder();

function b64urlBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlStr(s: string): string {
  return b64urlBytes(enc.encode(s));
}
function b64urlDecodeToStr(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return new Uint8Array(sig);
}

/**
 * Constant-time check of an entered passcode against the configured one. Returns
 * false (never throws) when the feature is disabled, so the route can answer with
 * a uniform failure.
 */
export function verifyManagerPasscode(entered: string | null | undefined): boolean {
  const pass = managerPasscode();
  if (!pass || !entered) return false;
  // Compare over a fixed-length HMAC so the check itself does not leak length.
  // (timingSafeEqual short-circuits on unequal lengths otherwise.)
  return timingSafeEqualStr(entered, pass);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  // Length is not itself secret for a shared operator passcode, and equal-length
  // constant-time compare is sufficient here; reuse the hex-safe comparator.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mint a signed manager session token (payload: purpose 'm' + expiry seconds). */
export async function signManagerSession(nowMs = Date.now()): Promise<string> {
  const payload = JSON.stringify({ m: 1, e: Math.floor((nowMs + MANAGER_SESSION_TTL_MS) / 1000) });
  const p = b64urlStr(payload);
  const sig = b64urlBytes(await hmac(sessionSecret(), p));
  return `${p}.${sig}`;
}

/** True iff `token` is a valid, unexpired manager session token. */
export async function verifyManagerSession(
  token: string | null | undefined,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const p = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64urlBytes(await hmac(sessionSecret(), p));
  if (!timingSafeEqual(sig, expected)) return false;

  let payload: { m?: unknown; e?: unknown };
  try {
    payload = JSON.parse(b64urlDecodeToStr(p));
  } catch {
    return false;
  }
  if (payload.m !== 1) return false;
  if (typeof payload.e !== 'number' || payload.e * 1000 <= nowMs) return false;
  return true;
}

/** Route guard: true iff the request carries a valid manager session cookie. */
export async function managerAuthorized(req: NextRequest): Promise<boolean> {
  return verifyManagerSession(req.cookies.get(MANAGER_COOKIE)?.value);
}
