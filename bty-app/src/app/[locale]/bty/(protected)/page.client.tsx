"use client";

import Link from "next/link";
import { EmotionalStatsPhrases } from "@/components/bty/EmotionalStatsPhrases";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

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

/** bty 메인: Arena · Center · Foundry 세 허브만 노출. */
export default function BtyIndexPage({ locale, t }: Props) {
  const isKo = locale === "ko";
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const { contract: arenaEntry } = useArenaEntryResolution(loc);
  const tLand = getMessages(loc).landing;
  const tBtyFull = getMessages(loc).bty;

  const hubs: {
    key: string;
    href: string;
    title: string;
    desc: string;
    cta: string;
    accent?: boolean;
  }[] = [
    {
      key: "arena",
      href: arenaEntry.href,
      title: tLand.arenaTitle,
      desc: tLand.arenaDesc,
      cta: tLand.arenaCta,
      accent: true,
    },
    {
      key: "center",
      href: `/${locale}/center`,
      title: tLand.centerTitle,
      desc: tLand.centerDesc,
      cta: tLand.centerCta,
    },
    {
      key: "foundry",
      href: `/${locale}/bty/foundry`,
      title: tLand.foundryTitle,
      desc: tLand.foundryDesc,
      cta: tLand.foundryCta,
    },
  ];

  const skipLabel = isKo ? "본문으로 건너뛰기" : "Skip to main content";

  return (
    <>
      <a
        href="#foundry-main"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:rounded focus:ring-2 focus:ring-[var(--arena-accent)] focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:[clip:auto] focus:whitespace-normal focus:border border-[var(--arena-text-soft)]/30"
      >
        {skipLabel}
      </a>
      <main
        id="foundry-main"
        tabIndex={-1}
        className="max-w-3xl mx-auto px-4 py-8"
        aria-label={tBtyFull.btyIndexMainRegionAria}
      >
        <header className="text-center mb-8" aria-label={isKo ? "페이지 헤더" : "Page header"}>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--arena-text)] mb-2">{t.title}</h1>
          <p className="text-[var(--arena-text-soft)]">{t.tagline}</p>
        </header>
        <p className="text-center text-[var(--arena-text-soft)] mb-10 max-w-lg mx-auto text-sm">
          {tBtyFull.indexThreeHubsExplainer}
        </p>

        <section
          className="flex flex-col gap-5 mb-10"
          role="region"
          aria-label={tBtyFull.indexHubEntriesRegionAria}
        >
          {hubs.map((h) => (
            <Link
              key={h.key}
              href={h.href}
              className={`block rounded-2xl border px-6 py-6 text-left transition-all shadow-sm hover:shadow-md ${
                h.accent
                  ? "border-[var(--arena-accent)]/50 bg-[var(--arena-accent)]/8 hover:bg-[var(--arena-accent)]/12"
                  : "border-[var(--arena-text-soft)]/20 bg-[var(--arena-bg,#fff)]/90 hover:border-[var(--arena-accent)]/35"
              }`}
              aria-label={`${h.title}: ${h.desc}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--arena-text-soft)] mb-1">
                {h.key === "arena" ? "Arena" : h.key === "center" ? "Center" : "Foundry"}
              </div>
              <h2 className="text-xl font-bold text-[var(--arena-text)] mb-2">{h.title}</h2>
              <p className="text-sm text-[var(--arena-text-soft)] mb-4 leading-relaxed">{h.desc}</p>
              <span
                className={`inline-block text-sm font-semibold ${
                  h.accent ? "text-[var(--arena-accent)]" : "text-[var(--arena-accent)]"
                }`}
              >
                {h.cta} →
              </span>
            </Link>
          ))}
        </section>

        <nav className="text-center border-t border-[var(--arena-text-soft)]/15 pt-8" aria-label={isKo ? "리더보드" : "Leaderboard"}>
          <Link
            href={`/${locale}/bty/leaderboard`}
            className="text-[var(--arena-accent)] font-semibold"
          >
            {t.leaderboardLabel}
          </Link>
          <p className="text-xs text-[var(--arena-text-soft)] mt-2 max-w-md mx-auto">
            {isKo
              ? "주간 순위와 동료 아바타를 볼 수 있어요."
              : "Weekly rankings and teammate avatars."}
          </p>
        </nav>

        <div className="mt-10">
          <EmotionalStatsPhrases />
        </div>
      </main>
    </>
  );
}
