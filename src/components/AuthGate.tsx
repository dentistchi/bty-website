"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getMessages } from "@/lib/i18n";
import { LoadingFallback } from "@/components/bty-arena";

/**
 * BTY launch security: OAuth-only public auth surface (Commander intent lock).
 * Anonymous users get a single inline CTA → `/[locale]/bty/login` (the OAuth
 * login surface owned by login-card.tsx). The inline email/password form was
 * removed at D-1 (2026-05-29); `/api/auth/login` is retained ONLY for
 * `/admin/login`, which is a separate page that does not mount AuthGate.
 * Last reviewed 2026-05-29 (D-1) per Commander auth intent lock.
 */
const CTA_COPY = {
  ko: {
    title: "로그인이 필요해요",
    sub: "Center와 bty는 하나의 계정으로 이용해요.",
    cta: "Google로 계속하기",
  },
  en: {
    title: "Please sign in",
    sub: "Center and bty share one account.",
    cta: "Continue with Google",
  },
} as const;

/** §9: loadingMessage 없으면 pathname으로 locale 추론 후 getMessages(locale).loading.message 사용. */
export function AuthGate({
  children,
  loadingMessage,
}: {
  children: ReactNode;
  /** Optional: e.g. t.loading.message for locale-aware "Please wait…" / "잠시만 기다려 주세요." */
  loadingMessage?: string;
}) {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const fallbackMessage = getMessages(locale).loading.message;
  const { user, loading } = useAuth();

  if (loading) {
    const msg = loadingMessage ?? fallbackMessage;
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        aria-busy="true"
        aria-label={msg}
      >
        <LoadingFallback icon="⏳" message={msg} withSkeleton />
      </div>
    );
  }

  if (!user) {
    const c = CTA_COPY[locale];
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-foundry-purple-muted bg-foundry-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foundry-purple-dark">{c.title}</h2>
          <p className="text-sm text-foundry-ink-soft mt-1">{c.sub}</p>

          <Link
            href={`/${locale}/bty/login?next=/${locale}/bty`}
            aria-label={c.cta}
            data-testid="authgate-login-cta"
            className="mt-4 flex w-full items-center justify-center py-3 rounded-xl font-medium bg-foundry-purple text-foundry-white hover:bg-foundry-purple-dark"
          >
            {c.cta}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
