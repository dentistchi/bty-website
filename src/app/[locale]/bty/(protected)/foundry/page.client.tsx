"use client";

import Link from "next/link";
import { ProgramRecommenderWidget } from "@/components/foundry/ProgramRecommenderWidget";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type BtyMessages = {
  dashboardLabel: string;
  leaderboardLabel: string;
};
type Land = {
  foundryTitle: string;
  foundryDesc: string;
};

/**
 * Foundry Hub — the room for the user's relationship with the world / craft / ground
 * (BTY relationship model: Center=self · Arena=others · Foundry=world). First-screen
 * hierarchy (Daily OS): calm relational room header → today's one practice thing
 * (ProgramRecommender, foregrounded) → secondary surfaces demoted below under
 * "Go deeper" (quieter, but still reachable — visual demotion, NOT access gating).
 */
export default function FoundryHubClient({
  locale,
  t,
  tLand,
}: {
  locale: string;
  t: BtyMessages;
  tLand: Land;
}) {
  const isKo = locale === "ko";
  const tBty = getMessages((isKo ? "ko" : "en") as Locale).bty;

  // Secondary surfaces — kept fully reachable, demoted below today's one thing.
  const features: { icon: string; title: string; desc: string; href: string }[] = [
    {
      icon: "💬",
      title: isKo ? "Dr. Chi 멘토" : "Dr. Chi Mentor",
      desc: isKo ? "AI 멘토와 1:1 성장 대화" : "1:1 growth conversation with AI mentor",
      href: `/${locale}/bty/mentor`,
    },
    {
      icon: "📈",
      title: isKo ? "대시보드" : "Dashboard",
      desc: isKo ? "나의 성장 기록과 통계" : "Your growth records and stats",
      href: `/${locale}/bty/dashboard`,
    },
    {
      icon: "🏆",
      title: "Elite",
      desc: isKo ? "Elite 전용 콘텐츠" : "Elite-exclusive content",
      href: `/${locale}/bty/elite`,
    },
  ];

  return (
    <main className="max-w-xl mx-auto px-4 py-8" aria-label={tBty.foundryHubMainLandmarkAria}>
      <Link
        href={`/${locale}/bty`}
        className="text-sm text-[var(--arena-accent)] font-medium mb-6 inline-block"
        aria-label={tBty.foundryBackToBtyHome}
      >
        {tBty.foundryBackToBtyHome}
      </Link>

      {/* 1. Calm relational room header — Foundry = relationship with the world. */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--arena-text)]">{tLand.foundryTitle}</h1>
        <p className="text-[var(--arena-text-soft)] mt-2">
          {isKo
            ? "세상과의 관계를 연습하는 방이에요."
            : "A room for practicing your relationship with the world."}
        </p>
      </header>

      {/* 2. Today's one thing — the practice action, foregrounded. */}
      <section className="mb-10" aria-label={isKo ? "오늘의 하나" : "Today's one thing"}>
        <p className="text-base font-medium text-[var(--arena-text)]">
          {isKo ? "오늘 하나를 세상에 심습니다." : "Plant one thing in the world today."}
        </p>
        <p className="text-sm text-[var(--arena-text-soft)] mt-1 mb-4">
          {isKo ? "작게 만들고, 실제로 남깁니다." : "Build one small thing that remains."}
        </p>
        <ProgramRecommenderWidget locale={locale} />
      </section>

      {/* 3. Secondary surfaces — quieter, below the main action. Still reachable. */}
      <section aria-label={tBty.foundryFeatureCardsRegionAria}>
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--arena-text-soft)]/70">
          {isKo ? "더 깊이 보기" : "Go deeper"}
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0" role="list">
          {features.map((f) => (
            <li key={f.href}>
              <Link
                href={f.href}
                className="flex items-center gap-3 rounded-xl border border-[var(--arena-text-soft)]/15 px-4 py-3 transition-colors hover:border-[var(--arena-accent)]/30"
                aria-label={`${f.title}. ${f.desc}`}
              >
                <span className="text-xl shrink-0 opacity-80" aria-hidden>
                  {f.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--arena-text)]">{f.title}</div>
                  <div className="text-xs text-[var(--arena-text-soft)] mt-0.5">{f.desc}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <nav className="mt-4" aria-label={t.leaderboardLabel}>
          <Link
            href={`/${locale}/bty/leaderboard`}
            className="text-sm text-[var(--arena-text-soft)] transition-colors hover:text-[var(--arena-accent)]"
          >
            {t.leaderboardLabel}
          </Link>
        </nav>
      </section>
    </main>
  );
}
