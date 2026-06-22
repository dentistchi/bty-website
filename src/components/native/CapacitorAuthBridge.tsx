"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/native/isNative";

const SCHEME_CALLBACK_PREFIX = "btyarena://auth/callback";

/**
 * Native-only OAuth return bridge.
 *
 * The system browser completes Google sign-in and Supabase redirects to
 * `btyarena://auth/callback?next=…&code=…`. iOS hands that deep link to the
 * shell, which surfaces it as a Capacitor `appUrlOpen` event inside the
 * WebView. This listener forwards the code to the SERVER callback route, which
 * exchanges it (reading the PKCE verifier cookie the client init minted) and
 * writes the httpOnly session cookies the middleware `getUser()` gate reads.
 *
 * On a plain browser `isNative()` is false → nothing is registered and the
 * component renders null, so the web path is untouched.
 */
export function CapacitorAuthBridge() {
  useEffect(() => {
    if (!isNative()) return;
    const app = window.Capacitor?.Plugins?.App;
    if (!app) return;

    let handle: { remove: () => void } | undefined;

    Promise.resolve(
      app.addListener("appUrlOpen", (event) => {
        const url = event?.url ?? "";
        if (!url.startsWith(SCHEME_CALLBACK_PREFIX)) return;

        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        // Decision 3: native flow lands on /protected by default; deep targets
        // (action / reentry) are resolved later by the push router.
        const next = parsed.searchParams.get("next") || "/protected";
        if (!code) return;

        window.location.assign(
          `/api/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
        );
      })
    ).then((registered) => {
      handle = registered;
    });

    return () => {
      handle?.remove();
    };
  }, []);

  return null;
}
