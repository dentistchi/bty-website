"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * `/teams/link/done` — the first-ever sign-in popup, CALLBACK page. Slice A0.
 *
 * By the time this renders, Supabase's Azure OAuth has completed and the canonical rows exist:
 * exactly one `auth.users` and exactly one `auth.identities(provider='azure')` carrying
 * `custom_claims.tid` / `custom_claims.oid`. That is the entire purpose of the popup.
 *
 * IT RETURNS THE LITERAL STRING "ok" AND NOTHING ELSE.
 *
 * No token. No email. No user id. No session material of any kind. Microsoft's own sample passes
 * tokens back by writing them to `localStorage` in this window and handing the KEY to
 * `notifySuccess` — and Microsoft's own documentation records that pattern failing outright when
 * third-party storage partitioning is on, which is the default on iOS. So the parent tab is told
 * only that it may retry, and it re-derives the session server-side from Teams' own token.
 * The failure mode the sample has, this flow cannot have.
 *
 * The session this popup created belongs to the popup's context and is simply discarded when the
 * window closes. The parent never reads it.
 */
export default function TeamsLinkDone() {
  const [state, setState] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    void (async () => {
      const { app, authentication } = await import("@microsoft/teams-js");
      try {
        await app.initialize();
      } catch {
        /* outside Teams there is no parent to notify; the OAuth still completed correctly */
      }

      const fail = (reason: string) => {
        setState("error");
        try {
          authentication.notifyFailure(reason);
        } catch {}
      };

      if (!supabase) return fail("UnexpectedFailure");

      // The provider's own refusal is on the URL; read it before assuming a code is present.
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") || params.get("error_code")) return fail("UnexpectedFailure");

      const code = params.get("code");
      if (!code) return fail("UnexpectedFailure");

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data?.session) return fail("UnexpectedFailure");

      setState("done");
      try {
        // The whole payload. Deliberately a fixed literal, not data.
        authentication.notifySuccess("ok");
      } catch {
        /* opened outside Teams — nothing to notify, and nothing was leaked either */
      }
    })();
  }, []);

  return (
    <main
      data-testid="teams-link-done"
      data-state={state}
      className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-white"
    >
      <p className="text-sm text-white/70">
        {state === "error" ? "Microsoft sign-in didn't complete." : "Finishing sign-in…"}
      </p>
    </main>
  );
}
