"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * `/teams/link` — the first-ever sign-in popup, START page. Slice A0.
 *
 * WHAT THIS IS FOR, AND ONLY THIS. A Microsoft user with no BTY account cannot be bridged: the
 * canonical identity row lives in `auth.identities(provider='azure')` and only Supabase's own
 * Azure OAuth creates it. Rather than invent a second way to make one — a Teams identity map, a
 * direct `auth.users` insert, an email merge — this page runs the EXISTING flow, once, and the
 * ordinary resolver takes over forever after.
 *
 * WHY A POPUP AND NOT A REDIRECT. Microsoft Entra refuses to render inside an iframe, and Teams
 * documents that redirects are not supported for framed apps. `authentication.authenticate()`
 * opens a real window where `arena.btydaily.com` is the TOP-LEVEL document — which is also what
 * makes the PKCE verifier survive the round trip to Microsoft and back: in the popup this origin
 * is first-party, so its storage is not partitioned the way the framed tab's is.
 *
 * TENANT. The tenant is pinned by the Supabase Azure provider's own configuration, which is
 * existing, unchanged config — this page adds no `/common` authorize URL and constructs no
 * Microsoft endpoint of its own. `login_hint` is passed from the Teams context purely so the
 * person does not meet an account chooser for an account Teams already knows.
 *
 * NOTHING IS RETURNED FROM THIS WINDOW BUT THE WORD "ok" (see the `done` page).
 */
export default function TeamsLinkStart() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { app, authentication } = await import("@microsoft/teams-js");
      try {
        await app.initialize();
      } catch {
        /* Opened outside Teams: the OAuth below still works; only notify* will be unavailable. */
      }

      if (!supabase) {
        setError("unavailable");
        try {
          authentication.notifyFailure("UnexpectedFailure");
        } catch {}
        return;
      }

      let loginHint: string | undefined;
      try {
        const ctx = await app.getContext();
        const hint = ctx?.user?.loginHint;
        loginHint = typeof hint === "string" && hint ? hint : undefined;
      } catch {
        /* a hint is a convenience, never a requirement and never an identity */
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/teams/link/done`,
          // The same scopes the existing login card sends, so `oid`/`tid` arrive exactly as they
          // do on web and the identity row is byte-for-byte the one the resolver already reads.
          scopes: "openid profile email",
          ...(loginHint ? { queryParams: { login_hint: loginHint } } : {}),
        },
      });

      if (oauthError && !cancelled) {
        setError("oauth");
        try {
          authentication.notifyFailure("UnexpectedFailure");
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      data-testid="teams-link-start"
      className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-white"
    >
      <p className="text-sm text-white/70">
        {error ? "Microsoft sign-in couldn't start." : "Taking you to Microsoft…"}
      </p>
    </main>
  );
}
