"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getLastVisit,
  setLastVisit,
  shouldShowComeback,
} from "@/lib/utils";
import { getStoredToken } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

async function recordBounceBack() {
  const token = getStoredToken();
  if (!token) return;
  try {
    await fetch("/api/journey/bounce-back", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
  } catch {
    // ignore
  }
}

function localeFromPath(pathname: string): Locale {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg === "ko" ? "ko" : "en";
}

/**
 * Comeback (3+ days away) — docs/JOURNEY_COMEBACK_UX_SPEC.md
 * POST /api/journey/bounce-back only on "Resume Journey", not on dismiss.
 */
export function Comeback() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  const locale = localeFromPath(pathname);
  const t = getMessages(locale).uxPhase1Stub;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (loading) return;
    if (!user) return;
    if (pathname.includes("/login") || pathname.includes("/auth/")) return;

    const last = getLastVisit();
    const now = Date.now();

    if (last === null) {
      setLastVisit(now);
      return;
    }

    if (shouldShowComeback()) {
      setShow(true);
    }
    setLastVisit(now);
  }, [mounted, loading, user, pathname]);

  const dismiss = useCallback(() => {
    setShow(false);
  }, []);

  const onResumeJourney = useCallback(async () => {
    await recordBounceBack();
    dismiss();
    router.push(`/${locale}/growth/journey`);
  }, [dismiss, router, locale]);

  const onNotNow = useCallback(() => {
    dismiss();
  }, [dismiss]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="comeback-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bty-text/25 p-4 backdrop-blur-sm"
      onClick={onNotNow}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-bty-border bg-bty-surface p-6 shadow-lg sm:p-8",
          "animate-fadeIn"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="comeback-title" className="text-lg font-semibold text-bty-text">
          {t.comebackTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-bty-secondary">{t.comebackBody}</p>
        <button
          type="button"
          onClick={onResumeJourney}
          className={cn(
            "mt-6 w-full rounded-xl py-3 text-sm font-medium text-white transition-colors",
            "bg-bty-steel hover:bg-bty-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
          )}
        >
          {t.comebackResumeJourneyCta}
        </button>
        <button
          type="button"
          onClick={onNotNow}
          className="mt-3 w-full rounded-xl border border-bty-border bg-transparent py-2.5 text-sm text-bty-secondary transition-colors hover:bg-bty-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
        >
          {t.comebackNotNowCta}
        </button>
      </div>
    </div>
  );
}
