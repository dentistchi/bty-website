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
 * Foundry Daily Room — a NEW Daily OS room surface (not the old dashboard/feature-menu).
 * Foundry = the user's relationship with the world / craft / ground (Center=self ·
 * Arena=others · Foundry=world). Built on the Daily OS surface language for door→room
 * continuity with /today (navy `bg-bty-navy`, `--bty-panel` cards, `bty-gold` accent).
 *
 * First-viewport hierarchy: calm room header → relationship subtitle → hero (plant one
 * thing) → Today's one thing (ProgramRecommender `variant="today"`, one calm practice
 * card) → secondary surfaces quietly below under "Go deeper" (Mentor / Dashboard / Elite /
 * Leaderboard — demoted, still reachable; not gated).
 *
 * Note: this route inherits the shared `ArenaLayoutShell` (arena header) via
 * `[locale]/bty/layout.tsx`. That shell is shared with Arena and is NOT touched here; the
 * room content below it is the Daily OS navy surface. A later layout-level decision (giving
 * Foundry its own shell so the header is navy too) would complete the continuity.
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

  // Secondary surfaces — demoted below today's one thing, but fully reachable.
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
    <main className="min-h-screen bg-bty-navy text-white" aria-label={tBty.foundryHubMainLandmarkAria}>
      <div className="mx-auto max-w-xl px-5 pt-6 pb-16">
        <Link
          href={`/${locale}/bty`}
          className="mb-8 inline-block text-sm text-white/45 transition-colors hover:text-white/80"
          aria-label={tBty.foundryBackToBtyHome}
        >
          {tBty.foundryBackToBtyHome}
        </Link>

        {/* 1. Calm room header + relationship meaning. */}
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-white">{tLand.foundryTitle}</h1>
          <p className="mt-2 text-sm text-white/60">
            {isKo
              ? "세상과의 관계를 연습하는 방."
              : "A room for practicing your relationship with the world."}
          </p>
        </header>

        {/* 2. Hero — today's intention. */}
        <div className="mb-10">
          <p className="text-lg font-medium leading-relaxed text-white">
            {isKo ? "오늘 하나를 세상에 심습니다." : "Plant one thing in the world today."}
          </p>
          <p className="mt-1 text-sm text-white/55">
            {isKo ? "작게 만들고, 실제로 남깁니다." : "Build one small thing that remains."}
          </p>
        </div>

        {/* 3. Today's one thing — the single primary practice (foregrounded). */}
        <section className="mb-12" aria-label={isKo ? "오늘의 하나" : "Today's one thing"}>
          <p className="mb-1 text-xs uppercase tracking-[0.2em] text-white/45">
            {isKo ? "오늘의 하나" : "Today's one thing"}
          </p>
          <p className="mb-4 text-xs text-white/50">
            {isKo
              ? "지금 할 수 있는 작은 연습 하나를 고릅니다."
              : "Choose one small practice you can actually do now."}
          </p>
          <ProgramRecommenderWidget locale={locale} variant="today" />
        </section>

        {/* 4. Go deeper — secondary surfaces, quiet, below the primary action. Still reachable. */}
        <section aria-label={tBty.foundryFeatureCardsRegionAria}>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/40">
            {isKo ? "더 깊이 보기" : "Go deeper"}
          </p>
          <ul className="grid grid-cols-1 gap-2.5 list-none p-0 m-0 sm:grid-cols-2" role="list">
            {features.map((f) => (
              <li key={f.href}>
                <Link
                  href={f.href}
                  className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 transition-colors hover:border-bty-gold/30"
                  aria-label={`${f.title}. ${f.desc}`}
                >
                  <span className="shrink-0 text-lg opacity-70" aria-hidden>
                    {f.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white/90">{f.title}</div>
                    <div className="mt-0.5 text-xs text-white/50">{f.desc}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <nav className="mt-3" aria-label={t.leaderboardLabel}>
            <Link
              href={`/${locale}/bty/leaderboard`}
              className="text-sm text-white/45 transition-colors hover:text-bty-gold"
            >
              {t.leaderboardLabel}
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
