"use client";

import { useCallback, useEffect, useState } from "react";
import { switchAccount, signOutAccount } from "@/lib/native/accountSession";

/**
 * Me-tab account block — the canonical account-management surface (Slice 3.1B-3E).
 *
 * Shows the current signed-in email (read from the authenticated session endpoint — NEVER
 * inferred from profile/membership data), plus "Use another account" and "Sign out". Both
 * actions call the SAME shared account-session functions the Foundry affordance uses.
 * "Use another account" returns to the Foundry tab after re-auth; "Sign out" lands on login
 * with no auto-return. Errors are actionable but privacy-safe (no tokens/ids/providers).
 */

type Locale = "en" | "ko";

const COPY: Record<Locale, {
  signedInAs: string;
  useAnother: string;
  signOut: string;
  working: string;
  error: string;
}> = {
  en: {
    signedInAs: "Signed in as",
    useAnother: "Use another account",
    signOut: "Sign out",
    working: "Working…",
    error: "That didn’t complete. Please try again.",
  },
  ko: {
    signedInAs: "로그인 계정",
    useAnother: "다른 계정 사용",
    signOut: "로그아웃",
    working: "처리 중…",
    error: "완료하지 못했습니다. 다시 시도해 주세요.",
  },
};

export default function AccountBlock({ locale }: { locale: string }) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<"switch" | "signout" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; user?: { email?: string | null } };
        if (!cancelled && data?.ok && data.user?.email) setEmail(data.user.email);
      } catch {
        /* leave email null; the row still renders the labels + actions */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSwitch = useCallback(async () => {
    setError(null);
    setBusy("switch");
    const r = await switchAccount({ locale: loc, returnTab: "foundry" });
    // On success the browser is already navigating away; only a failure returns here.
    if (!r.ok) {
      setBusy(null);
      setError(t.error);
    }
  }, [loc, t.error]);

  const onSignOut = useCallback(async () => {
    setError(null);
    setBusy("signout");
    const r = await signOutAccount({ locale: loc });
    if (!r.ok) {
      setBusy(null);
      setError(t.error);
    }
  }, [loc, t.error]);

  return (
    <section
      data-testid="account-block"
      aria-label={t.signedInAs}
      className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
          {t.signedInAs}
        </span>
        <span data-testid="account-email" className="min-w-0 truncate text-[0.95rem] text-white/90">
          {email ?? "…"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onSwitch}
          disabled={busy !== null}
          className="rounded-lg border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-3.5 py-2 text-sm font-semibold text-[#C9A66B] disabled:opacity-60"
        >
          {busy === "switch" ? t.working : t.useAnother}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          disabled={busy !== null}
          className="rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/70 disabled:opacity-60"
        >
          {busy === "signout" ? t.working : t.signOut}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm leading-6 text-red-300/80">
          {error}
        </p>
      ) : null}
    </section>
  );
}
