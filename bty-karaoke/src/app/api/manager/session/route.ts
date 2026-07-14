// Manager login/logout.
//   POST   -> verify the shared manager passcode (constant-time) and, on success,
//             set an HttpOnly + Secure + SameSite=Lax session cookie. The signed
//             session token is NEVER returned to page JS and never touches a URL.
//   DELETE -> clear the cookie (sign out).
//
// Every failure is a UNIFORM 401 — a wrong passcode, an unconfigured feature, a
// malformed body, and a rate-limit lockout are indistinguishable, so the endpoint
// leaks neither "is the passcode set?" nor "which part failed?". Layered,
// best-effort rate limiting (reused KV limiter) throttles guessing by IP.

import { NextRequest, NextResponse } from 'next/server';
import { ManagerLoginSchema } from '@/lib/validation';
import {
  managerEnabled,
  verifyManagerPasscode,
  signManagerSession,
  MANAGER_COOKIE,
  MANAGER_SESSION_TTL_MS,
} from '@/lib/manager-auth.server';
import { makeLimiter, isLockedOut, recordFailure, recordSuccess } from '@/lib/rate-limit.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Uniform failure — reveals nothing about configuration or which check failed.
const fail = () => NextResponse.json({ error: 'That passcode is not valid.' }, { status: 401 });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function sessionCookie(req: NextRequest, value: string, maxAgeSeconds: number) {
  return {
    name: MANAGER_COOKIE,
    value,
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function POST(req: NextRequest) {
  // Rate-limit by IP under a fixed pseudo-scope. Best-effort: when the dedicated
  // secret / KV is absent the limiter is null and guessing is only guarded by the
  // passcode's own entropy (the login still works).
  const limiter = await makeLimiter('manager-login', clientIp(req));
  if (limiter && (await isLockedOut(limiter))) return fail();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (limiter) await recordFailure(limiter);
    return fail();
  }
  const parsed = ManagerLoginSchema.safeParse(body);
  if (!parsed.success) {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  if (!managerEnabled()) {
    // eslint-disable-next-line no-console
    console.error('[manager] KARAOKE_MANAGER_PASSCODE is not configured — login will always fail');
  }
  if (!managerEnabled() || !verifyManagerPasscode(parsed.data.passcode)) {
    if (limiter) await recordFailure(limiter);
    return fail();
  }

  if (limiter) await recordSuccess(limiter);
  const token = await signManagerSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(req, token, Math.floor(MANAGER_SESSION_TTL_MS / 1000)));
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(req, '', 0));
  return res;
}
