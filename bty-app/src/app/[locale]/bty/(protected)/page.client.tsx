"use client";

import Link from "next/link";
import { ArenaLayoutShell } from "@/components/bty/ArenaLayoutShell";
import { EmotionalStatsPhrases } from "@/components/bty/EmotionalStatsPhrases";

type BtyMessages = {
  title: string;
  tagline: string;
  linkToCenter: string;
  entryIntro: string;
  startCta: string;
  arenaCta: string;
  dashboardLabel: string;
  leaderboardLabel: string;
};

type Props = { locale: string; t: BtyMessages };

/** Foundry 메인: Arena CTA + 기능 카드 그리드. */
export default function BtyIndexPage({ locale, t }: Props) {
  const isKo = locale === "ko";

  const features: { icon: string; title: string; desc: string; href: string }[] = [
    {
      icon: "📋",
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
      icon: "🧑‍⚕️",
      title: isKo ? "Dr. Chi 멘토" : "Dr. Chi Mentor",
      desc: isKo ? "AI 멘토와 1:1 성장 대화" : "1:1 growth conversation with AI mentor",
      href: `/${locale}/bty/mentor`,
    },
    {
      icon: "📊",
      title: isKo ? "대시보드" : "Dashboard",
      desc: isKo ? "나의 성장 기록과 통계" : "Your growth records and stats",
      href: `/${locale}/bty/dashboard`,
    },
    {
      icon: "⭐",
      title: "Elite",
      desc: isKo ? "Elite 전용 콘텐츠" : "Elite-exclusive content",
      href: `/${locale}/bty/elite`,
    },
  ];

  const mainLabel = isKo ? "훈련장 메인" : "Foundry main";
  const skipLabel = isKo ? "본문으로 건너뛰기" : "Skip to main content";

  return (
    <ArenaLayoutShell>
      <a
        href="#foundry-main"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:rounded focus:ring-2 focus:ring-[var(--arena-accent)] focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:[clip:auto] focus:whitespace-normal focus:border border-[var(--arena-text-soft)]/30"
      >
        {skipLabel}
      </a>
      <main
        id="foundry-main"
        tabIndex={-1}
        className="max-w-xl mx-auto px-4 py-8"
        aria-label={mainLabel}
      >
        <header className="text-center mb-10" aria-label={isKo ? "페이지 헤더" : "Page header"}>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--arena-text)] mb-2">{t.title}</h1>
          <p className="text-[var(--arena-text-soft)]">{t.tagline}</p>
        </header>
        <p className="text-center text-[var(--arena-text-soft)] mb-6 max-w-md mx-auto">{t.entryIntro}</p>

        <Link
          href={`/${locale}/bty-arena`}
          className="block w-full bty-btn-primary rounded-xl py-4 text-center font-semibold text-white text-lg mb-8"
          style={{ background: "var(--arena-accent)" }}
          aria-label={t.arenaCta}
        >
          {t.arenaCta}
        </Link>

        <section aria-label={isKo ? "연습·도구" : "Practice & tools"} className="mb-1">
          <h2 className="text-sm font-medium text-[var(--arena-text-soft)] mb-3">
            {isKo ? "연습 · 도구" : "Practice & tools"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, idx) => (
              <Link
                key={f.href}
                href={f.href}
                aria-label={isKo ? `${f.title}, ${f.desc}` : `Go to ${f.title}: ${f.desc}`}
                aria-describedby={`foundry-card-desc-${idx}`}
                className="flex items-start gap-4 rounded-2xl border border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/80 px-5 py-4 min-h-[100px] shadow-sm hover:shadow-md hover:border-[var(--arena-accent)]/40 hover:bg-[var(--arena-accent)]/5 transition-all duration-200 group"
              >
                <span className="text-3xl shrink-0 mt-0.5 flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--arena-text-soft)]/10 group-hover:bg-[var(--arena-accent)]/10 transition-colors" aria-hidden="true">
                  {f.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--arena-text)] group-hover:text-[var(--arena-accent)] transition-colors">
                    {f.title}
                  </div>
                  <div id={`foundry-card-desc-${idx}`} className="text-xs text-[var(--arena-text-soft)] leading-relaxed mt-1">
                    {f.desc}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <nav className="mt-4 text-center" aria-label={isKo ? "리더보드 링크" : "Leaderboard link"}>
          <Link
            href={`/${locale}/bty/leaderboard`}
            className="text-sm text-[var(--arena-accent)] hover:underline"
            aria-label={t.leaderboardLabel}
          >
            {t.leaderboardLabel}
          </Link>
        </nav>

        <footer className="mt-10 pt-6 border-t border-[var(--arena-text-soft)]/20" aria-label={isKo ? "푸터" : "Footer"}>
          <EmotionalStatsPhrases />
        </footer>
      </main>
    </ArenaLayoutShell>
  );
}
