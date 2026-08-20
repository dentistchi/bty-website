/**
 * Shared Google OAuth launch (Slice 3.1B-3N-5B.1). ONE implementation for BOTH the login card
 * (first sign-in) and the Me-tab "Switch account" — so an authenticated account switch opens the
 * Google chooser DIRECTLY (no "Welcome to bty" interstitial, no second "Continue with Google" tap)
 * and NEVER tears down the current session first (a cancelled switch leaves the old session intact;
 * a successful callback atomically replaces it via the existing /auth/callback exchange).
 *
 * Web: supabase.auth.signInWithOAuth (full-page redirect to Google; the account chooser
 * `prompt=select_account` is sent ONLY on an explicit switch — see `forceAccountSelection`).
 * Native (iOS): @capgo/capacitor-social-login → signInWithIdToken → POST /api/auth/session + Keychain,
 * then navigate to nextPath. Byte-identical to the login card's proven native path.
 *
 * Reuses the existing Supabase provider + /[locale]/auth/callback — no new auth system, no new
 * provider, no password storage, no token/code logging.
 */

import { isNative } from "./isNative";
import { storeNativeSession } from "./durableSession";
import { getSupabase, supabase as supabaseMaybe } from "@/lib/supabase";

/** iOS Google client id — identical single value used by login-card + accountSession native init. */
const IOS_GOOGLE_CLIENT_ID =
  "1012329580428-fp0r4m3kt06jtojog2f8qmtnvluhkmoe.apps.googleusercontent.com";

type SocialLoginPlugin = {
  initialize: (options: { google: { iOSClientId: string; mode: "online" | "offline" } }) => Promise<void>;
  login: (options: {
    provider: "google";
    options: { scopes?: string[]; nonce?: string; forcePrompt?: boolean; forceAccountSelection?: boolean };
  }) => Promise<{ result: { idToken: string | null } }>;
};

const hexFromBytes = (b: Uint8Array) =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

function safeOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/** Locale page callback that can exchange the PKCE code / read implicit hash tokens. */
function buildOAuthRedirectTo(locale: "en" | "ko", nextPath: string): string {
  return `${safeOrigin()}/${locale}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export type StartGoogleOAuthResult =
  | { status: "redirecting" } // web: page is redirecting to Google · native: session set + navigating
  | { status: "unconfigured" }
  | { status: "error"; detail?: string };

/**
 * Launch Google sign-in. On WEB this redirects the page to Google (returns "redirecting"). On NATIVE
 * it completes the chooser + token exchange and navigates to `nextPath` (also returns "redirecting").
 * Any provider/user cancellation surfaces as "error" WITHOUT touching the current session.
 */
export async function startGoogleOAuth({
  locale,
  nextPath,
  forceAccountSelection = false,
}: {
  locale: "en" | "ko";
  nextPath: string;
  forceAccountSelection?: boolean;
}): Promise<StartGoogleOAuthResult> {
  if (!supabaseMaybe) return { status: "unconfigured" };
  const supabase = getSupabase();
  try {
    // Native (iOS) — native Google Sign-In → idToken → signInWithIdToken → server cookie + Keychain.
    if (isNative()) {
      const social = (window.Capacitor?.Plugins as { SocialLogin?: SocialLoginPlugin } | undefined)?.SocialLogin;
      if (!social) return { status: "error", detail: "native-google-unavailable" };
      await social.initialize({ google: { iOSClientId: IOS_GOOGLE_CLIENT_ID, mode: "online" } });
      // Nonce symmetry: SHA-256 digest to Google, raw to Supabase. forcePrompt + forceAccountSelection
      // guarantee the chooser (the previous account cannot be silently re-selected on a switch).
      const rawNonce = hexFromBytes(crypto.getRandomValues(new Uint8Array(32)));
      const digestBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawNonce));
      const nonceDigest = hexFromBytes(new Uint8Array(digestBuf));
      const res = await social.login({
        provider: "google",
        options: {
          nonce: nonceDigest,
          forcePrompt: true,
          ...(forceAccountSelection ? { forceAccountSelection: true } : {}),
        },
      });
      const idToken = res.result.idToken;
      if (!idToken) return { status: "error", detail: "native-google-no-idtoken" };
      const { data: idData, error: idError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        nonce: rawNonce,
      });
      if (idError || !idData.session) return { status: "error", detail: idError?.message };
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token: idData.session.access_token,
          refresh_token: idData.session.refresh_token,
        }),
      });
      await storeNativeSession({
        access_token: idData.session.access_token,
        refresh_token: idData.session.refresh_token,
        expires_at: idData.session.expires_at ?? null,
      });
      if (typeof window !== "undefined") window.location.assign(nextPath);
      return { status: "redirecting" };
    }

    // Web — in-page redirect to Google; the callback exchanges the code + lands on nextPath.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildOAuthRedirectTo(locale, nextPath),
        skipBrowserRedirect: isNative(),
        /*
          R4-R4B-R2 — the chooser is for an EXPLICIT switch, not for signing in. Unconditional
          here meant every returning user was sent through a full account chooser, and every one
          of those produced another Google "you shared data" email. Scopes unchanged.
        */
        ...(forceAccountSelection ? { queryParams: { prompt: "select_account" } } : {}),
      },
    });
    if (oauthError) return { status: "error", detail: oauthError.message };
    return { status: "redirecting" };
  } catch (e) {
    return { status: "error", detail: e instanceof Error ? e.message : undefined };
  }
}
