"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOutAccount } from "@/lib/native/accountSession";
import { startGoogleOAuth } from "@/lib/native/googleOAuth";

/**
 * Me-tab account block — the canonical (and ONLY) account-management surface (Slice 3.1B-3N-5B.1).
 *
 * "Switch account" launches the Google chooser DIRECTLY (no "Welcome to bty" interstitial, no second
 * "Continue with Google" tap) and NEVER tears down the current session first — a cancelled switch
 * leaves the previous account signed in; a successful callback atomically replaces it and lands on
 * Today. "Sign out" keeps the existing full teardown → login screen. Errors are privacy-safe (no
 * tokens/ids/providers).
 */

type Locale = "en" | "ko";

const COPY: Record<Locale, {
  signedInAs: string;
  switchAccount: string;
  signOut: string;
  switching: string;
  working: string;
  error: string;
}> = {
  en: {
    signedInAs: "Signed in as",
    switchAccount: "Switch account",
    signOut: "Sign out",
    switching: "Switching account…",
    working: "Working…",
    error: "That didn’t complete. Please try again.",
  },
  ko: {
    signedInAs: "로그인 계정",
    switchAccount: "계정 전환",
    signOut: "로그아웃",
    switching: "계정 전환 중…",
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
  // In-flight latch: a rapid double-tap cannot start two simultaneous switches (state disables the
  // button on re-render, but this guards the microtask window before that render commits).
  const inFlight = useRef(false);

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
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy("switch");
    // Direct provider chooser, next = Today. On "redirecting" the page is leaving (web) or has
    // navigated (native); only a real error returns here — the previous session stays intact.
    const r = await startGoogleOAuth({ locale: loc, nextPath: `/${loc}/app?tab=today`, forceAccountSelection: true });
    if (r.status !== "redirecting") {
      inFlight.current = false;
      setBusy(null);
      setError(t.error);
    }
  }, [loc, t.error]);

  const onSignOut = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy("signout");
    const r = await signOutAccount({ locale: loc });
    if (!r.ok) {
      inFlight.current = false;
      setBusy(null);
      setError(t.error);
    }
  }, [loc, t.error]);

  return (
    <section
      data-testid="account-block"
      aria-label={t.signedInAs}
      className="relative flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4"
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
          data-testid="account-switch"
          onClick={onSwitch}
          disabled={busy !== null}
          className="rounded-lg border border-[#C9A66B]/40 bg-[#C9A66B]/[0.08] px-3.5 py-2 text-sm font-semibold text-[#C9A66B] disabled:opacity-60"
        >
          {busy === "switch" ? t.switching : t.switchAccount}
        </button>
        <button
          type="button"
          data-testid="account-signout"
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
      {busy === "switch" ? (
        <div
          data-testid="switching-overlay"
          className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#0b0b0f]/80 backdrop-blur-sm"
        >
          <span className="text-sm font-medium text-white/85">{t.switching}</span>
        </div>
      ) : null}
    </section>
  );
}
