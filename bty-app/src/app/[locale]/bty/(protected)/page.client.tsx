"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Foundry 메인: Arena 가장 크게, 나머지(대시·리더보드·시작) 작게. 네비는 상단 한 줄만. */
export default function BtyIndexPage({ locale, t }: Props) {
  const router = useRouter();
  return (
    <ArenaLayoutShell>
      <div className="max-w-xl mx-auto px-4 py-8">
        <header className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--arena-text)] mb-2">{t.title}</h1>
          <p className="text-[var(--arena-text-soft)]">{t.tagline}</p>
        </header>
        <p className="text-center text-[var(--arena-text-soft)] mb-6 max-w-md mx-auto">{t.entryIntro}</p>

        {/* Arena = 메인 CTA (가장 크게) */}
        <Link
          href={`/${locale}/bty-arena`}
          className="block w-full bty-btn-primary rounded-xl py-4 text-center font-semibold text-white text-lg mb-4"
          style={{ background: "var(--arena-accent)" }}
        >
          {t.arenaCta}
        </Link>

        {/* 나머지: Dashboard · Leaderboard · Start(멘토) 작게 */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[var(--arena-text-soft)]">
          <Link href={`/${locale}/bty/dashboard`} className="text-[var(--arena-accent)] hover:underline">
            {t.dashboardLabel}
          </Link>
          <span aria-hidden>·</span>
          <Link href={`/${locale}/bty/leaderboard`} className="text-[var(--arena-accent)] hover:underline">
            {t.leaderboardLabel}
          </Link>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/bty/mentor`)}
            className="text-[var(--arena-accent)] hover:underline bg-transparent border-none cursor-pointer p-0 font-inherit"
          >
            {t.startCta}
          </button>
        </div>

        <footer className="mt-10 pt-6 border-t border-[var(--arena-text-soft)]/20">
          <EmotionalStatsPhrases />
        </footer>
      </div>
    </ArenaLayoutShell>
  );
}
