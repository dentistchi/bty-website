// Server-only guest cancel capability. A bounded, signed token issued at submit
// time that lets ONLY the submitting device cancel that one request — no DB
// column, no migration, no stored state. Another guest who learns the request id
// cannot forge it (they lack the server secret). The token binds the request id
// and an expiry; the server re-checks request status before acting.

import { timingSafeEqual } from './dj-auth.server';
import { optionalEnv, karaokeEnv } from './env.server';

// A karaoke night's worth of validity; cancellation only matters while waiting.
export const CANCEL_CAP_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * HMAC key: a dedicated secret when configured, else the always-present
 * service-role key (server-only, never sent to clients). Using it here does not
 * expose it — only its HMAC output travels.
 */
function capSecret(): string {
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

/** Issue a cancel capability for one request. Returned to the submitting guest. */
export async function signCancelCapability(requestId: string, nowMs = Date.now()): Promise<string> {
  const payload = JSON.stringify({ r: requestId, e: Math.floor((nowMs + CANCEL_CAP_TTL_MS) / 1000) });
  const p = b64urlStr(payload);
  const sig = b64urlBytes(await hmac(capSecret(), p));
  return `${p}.${sig}`;
}

/**
 * Alias: the same signed capability issued at submit ALSO proves ownership for
 * self-service start / finish. Binding the request id + expiry is exactly the
 * "this device submitted this request" proof those actions need — no new token,
 * no DB owner column. Kept as distinct names so call sites read by intent.
 */
export const signOwnerCapability = signCancelCapability;
export const verifyOwnerCapability = (
  token: string | null | undefined,
  requestId: string,
  nowMs = Date.now(),
) => verifyCancelCapability(token, requestId, nowMs);

/** True iff `token` is a valid, unexpired capability for exactly `requestId`. */
export async function verifyCancelCapability(
  token: string | null | undefined,
  requestId: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!token || !requestId) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const p = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64urlBytes(await hmac(capSecret(), p));
  if (!timingSafeEqual(sig, expected)) return false;

  let payload: { r?: unknown; e?: unknown };
  try {
    payload = JSON.parse(b64urlDecodeToStr(p));
  } catch {
    return false;
  }
  if (payload.r !== requestId) return false;
  if (typeof payload.e !== 'number' || payload.e * 1000 <= nowMs) return false;
  return true;
}
