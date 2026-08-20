"use client";

/**
 * STEP A2 — Native durable session restore (iOS Keychain).
 *
 * Root cause it addresses: the Capacitor hosted-URL WebView writes the Supabase
 * auth cookie into WKHTTPCookieStore, but WebKit flushes that store to disk
 * asynchronously. A hard-kill immediately after login can drop the cookie before
 * it reaches disk; on relaunch the gate (GET /api/auth/session) finds no cookie
 * material and the user is bounced back to Google login. STEP A (gate refresh)
 * cannot help — there is no refresh_token cookie left to refresh.
 *
 * Fix: keep an authoritative copy of the session material in the iOS Keychain
 * (survives app kill synchronously), and on cold launch re-establish the session
 * from it. STEP A remains complementary for ordinary in-session expiry.
 *
 * Architecture: this module carries NO `@capacitor/*` import — it reaches the
 * native plugin through the runtime-injected bridge (`window.Capacitor.Plugins`),
 * exactly like `isNative.ts` and `login-card.tsx`'s SocialLogin access. Every
 * export is `isNative()`-gated via {@link bridge}; in a plain browser `bridge()`
 * returns null and every function is a no-op, so web behaviour is unchanged and
 * this file adds no web dependency.
 *
 * Native plugin: `capacitor-secure-storage-plugin` (KeychainSwift on iOS),
 * registered on the bridge as `SecureStoragePlugin`. Installed only in the native
 * shell repo; absent here at web build time (bridge shim, no import).
 *
 * Security: tokens are never logged, thrown, or surfaced. Keychain holds only the
 * minimum needed to rebuild the Supabase session under a BTY-scoped, versioned key.
 */

import { isNative } from "@/lib/native/isNative";
import { getSupabase } from "@/lib/supabase";

import { readWithBound } from "@/lib/auth/boundedSessionRead";
/** BTY-scoped, versioned Keychain key. Bump the suffix on any payload-shape change. */
const STORAGE_KEY = "bty.session.v1";

type StoredSession = {
  v: 1;
  access_token: string;
  refresh_token: string;
  /** epoch seconds; advisory only — setSession revalidates. */
  expires_at?: number | null;
};

/** Minimal shape of the `capacitor-secure-storage-plugin` native bridge (string values only). */
type SecureStorageBridge = {
  set: (o: { key: string; value: string }) => Promise<{ value: boolean }>;
  get: (o: { key: string }) => Promise<{ value: string }>;
  remove: (o: { key: string }) => Promise<{ value: boolean }>;
};

/** The session material we need to persist / restore. */
type SessionMaterial = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
};

/**
 * Resolve the native Keychain bridge, or null on web / when the plugin is not
 * injected. Sole native-gate for this module — every export goes through it.
 */
function bridge(): SecureStorageBridge | null {
  if (!isNative()) return null;
  const plugins = window.Capacitor?.Plugins as
    | { SecureStoragePlugin?: SecureStorageBridge }
    | undefined;
  return plugins?.SecureStoragePlugin ?? null;
}

/**
 * Persist session material to the Keychain. No-op on web / without the plugin.
 * Never throws into the auth flow; never logs token values.
 */
export async function storeNativeSession(session: SessionMaterial): Promise<void> {
  const b = bridge();
  if (!b) return;
  if (!session?.access_token || !session?.refresh_token) return;
  try {
    const payload: StoredSession = {
      v: 1,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
    };
    await b.set({ key: STORAGE_KEY, value: JSON.stringify(payload) });
  } catch {
    // Keychain write failure must not break login; swallow (no token in message).
  }
}

/** Read + validate stored material. Returns null on web, absent key, or bad shape. */
async function readNativeSession(): Promise<StoredSession | null> {
  const b = bridge();
  if (!b) return null;
  try {
    const res = await b.get({ key: STORAGE_KEY });
    const raw = res?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (parsed?.v !== 1 || !parsed.access_token || !parsed.refresh_token) return null;
    return parsed as StoredSession;
  } catch {
    // Plugin throws when the key is absent → treat as "no stored session".
    return null;
  }
}

/** Remove stored material (logout, or a dead/rotated-away refresh_token). No-op on web. */
export async function clearNativeSession(): Promise<void> {
  const b = bridge();
  if (!b) return;
  try {
    await b.remove({ key: STORAGE_KEY });
  } catch {
    // Absent key / bridge error → nothing to clear.
  }
}

/**
 * Cold-launch restore. Native only. Returns true iff the session was rebuilt and
 * the httpOnly cookie re-established; false → caller falls back to Google login.
 *
 * Flow (rotation-safe): read Keychain → client-side `setSession` (the SDK returns
 * the possibly-rotated session, which the POST route's response cannot) → persist
 * the NEWEST tokens back to Keychain → POST /api/auth/session to re-seat the
 * httpOnly cookie in WKHTTPCookieStore. A revoked/expired refresh_token yields no
 * session → the stale material is cleared so we don't retry a doomed restore.
 */
export async function restoreNativeSession(): Promise<boolean> {
  if (!isNative()) return false;
  const stored = await readNativeSession();
  if (!stored) return false;

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    return false;
  }

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (error || !data?.session) {
      // refresh_token revoked / rotated away / expired → drop dead material.
      await clearNativeSession();
      return false;
    }

    // Capture rotation BEFORE seating the cookie: setSession may have refreshed
    // and rotated the refresh_token; the old one is now single-use-consumed.
    await storeNativeSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at ?? null,
    });

    /*
      Re-establish the httpOnly cookie (server route unchanged). BOUNDED in R4-R4B-R1: this is the
      SECOND unbounded request on the app's boot path, and it runs precisely when the first already
      reported no session — so a stall here held the launch open a second time. The function's
      existing contract already treats every failure as `false` ("could not restore"), which is the
      right answer for a timeout too: it never asserts the session is gone, and the caller re-reads
      the gate rather than acting on it.
    */
    // Captured before the closure so the narrowing above survives into it.
    const fresh = { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    const res = await readWithBound((signal) =>
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fresh),
        signal,
      }),
    );
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return body?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Keep the Keychain copy synced to the client's latest (possibly auto-rotated)
 * tokens, so a hard-kill after a long active session can still restore. Native
 * only; best-effort and silent. Call after an authenticated gate.
 */
export async function syncNativeSessionFromClient(): Promise<void> {
  const b = bridge();
  if (!b) return;
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token && data.session.refresh_token) {
      await storeNativeSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at ?? null,
      });
    }
  } catch {
    // best-effort; never disrupt the auth flow.
  }
}
