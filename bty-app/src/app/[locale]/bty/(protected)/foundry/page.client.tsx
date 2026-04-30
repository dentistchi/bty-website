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

  const features: { icon: string; title: string; desc: string; href: string }[] = [
    {
      icon: "🎯",
      title: isKo ? "Dojo 50문항" : "Dojo 50 Questions",
      desc: isKo ? "오늘의 나를 진단하는 50문항 테스트" : "50-question self-assessment for today",
      href: `/${locale}/bty/dojo`,
    },
    {
      icon: "🪞",
      title: isKo ? "역지사지 연습" : "Integrity Mirror",
      desc: isKo ? "갈등 상황을 상대 입장에서 돌려보기" : "See conflicts from the other side",
      href: `/${locale}/bty/integrity`,
    },
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
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--arena-text)]">{tLand.foundryTitle}</h1>
          <p className="text-[var(--arena-text-soft)] mt-2">{tLand.foundryDesc}</p>
        </header>
        <div className="mb-8">
          <ProgramRecommenderWidget locale={locale} />
        </div>
        <section aria-label={tBty.foundryFeatureCardsRegionAria}>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0" role="list">
          {features.map((f) => (
            <li key={f.href}>
            <Link
              href={f.href}
              className="flex items-start gap-4 rounded-2xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/80 px-5 py-4 min-h-[100px] shadow-sm hover:shadow-md hover:border-[var(--arena-accent)]/40 transition-all"
              aria-label={`${f.title}. ${f.desc}`}
            >
              <span className="text-3xl shrink-0" aria-hidden>
                {f.icon}
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--arena-text)]">{f.title}</div>
                <div className="text-xs text-[var(--arena-text-soft)] mt-1">{f.desc}</div>
              </div>
            </Link>
            </li>
          ))}
        </ul>
        </section>
        <nav className="mt-8 text-center" aria-label={t.leaderboardLabel}>
          <Link href={`/${locale}/bty/leaderboard`} className="text-[var(--arena-accent)] font-medium">
            {t.leaderboardLabel}
          </Link>
        </nav>
    </main>
  );
}
