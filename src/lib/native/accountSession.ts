/**
 * Shared account-session action — Slice 3.1B-3E (account switch/sign-out).
 *
 * ONE implementation used by BOTH the Me-tab account block and the Foundry learner
 * affordance — never a per-surface logout. It tears down every session layer that
 * applies, then hands off to the login card.
 *
 * Native switch (measured): the app initializes Google in `mode:"online"`, so
 * `SocialLogin.logout()` is supported; `switch=1` on the login route both forces the
 * Google account chooser (`forceAccountSelection`) and suppresses the durable-session
 * auto-restore, so the previous account cannot silently return. Web reuses the existing
 * `prompt=select_account` OAuth path. No new login architecture.
 */

import { isNative } from "./isNative";
import { clearNativeSession } from "./durableSession";

/** iOS Google client id — identical to login-card's native init (same single value). */
const IOS_GOOGLE_CLIENT_ID =
  "1012329580428-fp0r4m3kt06jtojog2f8qmtnvluhkmoe.apps.googleusercontent.com";

/** Minimal shape of the runtime-injected native Google plugin (no `@capacitor/*` import). */
type SocialLoginBridge = {
  initialize: (o: { google: { iOSClientId: string; mode: "online" | "offline" } }) => Promise<void>;
  logout: (o: { provider: "google" }) => Promise<void>;
};

function socialLoginBridge(): SocialLoginBridge | null {
  if (typeof window === "undefined") return null;
  return (
    (window.Capacitor?.Plugins as { SocialLogin?: SocialLoginBridge } | undefined)?.SocialLogin ?? null
  );
}

/** Privacy-safe teardown-failure labels — never a token, provider detail, or internal id. */
export type TeardownFailure = "provider" | "native_session" | "server";

export type AccountActionResult = { ok: boolean; failed: TeardownFailure[] };

type AppTab = "today" | "center" | "arena" | "foundry" | "me";

function normalizeLocale(locale: string): "en" | "ko" {
  return locale === "ko" ? "ko" : "en";
}

/**
 * Tear down EVERY applicable session layer, recording which failed. Order: native Google
 * provider (online mode → logout supported) → iOS Keychain durable session → server/Supabase
 * cookie session. Each layer is independent; a failure is recorded, never swallowed, so a
 * caller can refuse to claim a clean switch when only one layer cleared.
 */
export async function tearDownAccountSession(): Promise<TeardownFailure[]> {
  const failed: TeardownFailure[] = [];

  if (isNative()) {
    try {
      const social = socialLoginBridge();
      if (!social) throw new Error("social_login_unavailable");
      await social.initialize({ google: { iOSClientId: IOS_GOOGLE_CLIENT_ID, mode: "online" } });
      await social.logout({ provider: "google" });
    } catch {
      failed.push("provider");
    }
  }

  try {
    await clearNativeSession();
  } catch {
    failed.push("native_session");
  }

  try {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (!res.ok) failed.push("server");
  } catch {
    failed.push("server");
  }

  return failed;
}

/**
 * Switch account: tear down all layers, then hand off to the login card with a
 * return-to-Foundry `next` + `switch=1`. The SERVER layer is authoritative — if it fails we
 * do NOT navigate (the old cookie session would survive and the UI must not claim success);
 * the caller surfaces an honest error and can retry. Native provider / Keychain failures are
 * non-fatal: the forced chooser + a fresh sign-in re-establish a clean session regardless.
 *
 * The hand-off is a FULL-PAGE navigation, so the previous account's in-memory state (e.g. the
 * learner's assignment list) cannot persist across the switch.
 */
export async function switchAccount({
  locale,
  returnTab = "foundry",
}: {
  locale: string;
  returnTab?: AppTab;
}): Promise<AccountActionResult> {
  const failed = await tearDownAccountSession();
  if (failed.includes("server")) return { ok: false, failed };

  const loc = normalizeLocale(locale);
  const next = `/${loc}/app?tab=${returnTab}`;
  window.location.assign(`/${loc}/bty/login?next=${encodeURIComponent(next)}&switch=1`);
  return { ok: true, failed };
}

/**
 * Sign out: same teardown, then land on the login screen IMMEDIATELY. `switch=1` suppresses
 * the native durable-session auto-restore (so the previous Google account is never silently
 * restored — the login form shows) and, after a manual sign-in, `next` returns the user to
 * the canonical app shell (`/{locale}/app?tab=me`), never a raw Room or standalone page. Same
 * server-authoritative rule: a failed server logout is reported and does not navigate.
 */
export async function signOutAccount({
  locale,
}: {
  locale: string;
}): Promise<AccountActionResult> {
  const failed = await tearDownAccountSession();
  if (failed.includes("server")) return { ok: false, failed };

  const loc = normalizeLocale(locale);
  const next = `/${loc}/app?tab=me`;
  window.location.assign(`/${loc}/bty/login?next=${encodeURIComponent(next)}&switch=1`);
  return { ok: true, failed };
}
