"use client";

import { useEffect, useMemo, useState } from "react";
import LoginCard from "@/components/auth/login-card";
import { isNative } from "@/lib/native/isNative";
import { restoreNativeSession } from "@/lib/native/durableSession";
import { restoreWebSession } from "@/lib/auth/webSessionRestore";
import { userMessageForOAuthCallbackError } from "@/lib/auth/oauth-callback-error-messages";
import { sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";

function decodeError(raw: string | undefined): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function LoginClient({
  nextPath,
  locale,
  oauthError,
  accountSwitch = false,
}: {
  nextPath: string;
  locale: "en" | "ko";
  oauthError?: string;
  /**
   * Deliberate account switch (`?switch=1`): force the Google chooser AND suppress the
   * native durable-session auto-restore below — otherwise a still-present Keychain session
   * would silently re-seat the PREVIOUS account and defeat the switch.
   */
  accountSwitch?: boolean;
}) {
  const next = useMemo(() => sanitizeNextForRedirect(nextPath, { locale }), [nextPath, locale]);
  const initialError = useMemo(() => {
    const decoded = decodeError(oauthError);
    if (!decoded) return undefined;
    return userMessageForOAuthCallbackError(decoded, locale);
  }, [oauthError, locale]);

  // ── Cold-reopen session restore ──────────────────────────────────────────────
  // On the native shell a cold reopen requests /[locale]/app; middleware finds no
  // server cookie and 307s HERE before any client JS runs, and AuthContext skips all
  // session work on /bty/login — so the durable iOS-Keychain session (written at login
  // by storeNativeSession) would otherwise never be consulted and the user is asked to
  // log in again. Attempt the restore on this landing: on success restoreNativeSession
  // re-seats the httpOnly cookie (its POST /api/auth/session) and we return to `next`
  // (→ /[locale]/app → Orb Threshold Door), never showing the form. A dead / rotated /
  // absent Keychain session → restore returns false → the login form shows as before.
  //
  // R4-R4B-R2 — WEB GETS THE SAME COURTESY. This effect used to return early on `!isNative()`,
  // so a web visitor whose server cookie had lapsed fell straight through to the form and on to
  // Google — even though the browser still held a live Supabase session (`persistSession` +
  // `autoRefreshToken`). A MISSING SERVER COOKIE IS NOT NO SESSION, and every unnecessary trip
  // produced another "You shared some Google Account data with BTY" email. `restoreWebSession`
  // is the web twin: same existing `POST /api/auth/session` bridge, same outcome, no new store.
  const [nativeRestoring, setNativeRestoring] = useState(false);
  useEffect(() => {
    // On a deliberate account switch, NEVER auto-restore — on EITHER platform. The whole meaning
    // of `?switch=1` is "do not silently return me to the previous account", and a restore here
    // would do exactly that before the chooser was ever shown.
    if (accountSwitch) return;
    let cancelled = false;
    setNativeRestoring(true);
    void (async () => {
      // Native rebuilds from the iOS Keychain; web from the Supabase client's persisted session.
      const ok = isNative() ? await restoreNativeSession() : await restoreWebSession();
      if (cancelled) return;
      if (ok) window.location.assign(next); // cookie re-seated → back to the app route
      else setNativeRestoring(false); // no usable session → fall through to the login form
    })();
    return () => {
      cancelled = true;
    };
  }, [next, accountSwitch]);

  if (nativeRestoring) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4"
        data-testid="login-native-restoring"
        role="status"
        aria-busy="true"
      >
        <span className="text-sm text-slate-400">
          {locale === "ko" ? "세션 확인 중…" : "Restoring session…"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12 sm:px-6"
      data-testid="login-page"
    >
      <LoginCard
        locale={locale}
        nextPath={next}
        initialError={initialError}
        forceAccountSelection={accountSwitch}
      />
    </div>
  );
}
