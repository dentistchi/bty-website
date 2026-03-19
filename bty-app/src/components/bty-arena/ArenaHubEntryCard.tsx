"use client";

import Link from "next/link";
import * as React from "react";
import { isResumableArenaLocalSession } from "@/lib/bty/arena/arenaLocalState";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function ArenaHubEntryCard({ locale }: { locale: string }) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const play = `/${locale}/bty-arena/play`;
  const leaderboard = `/${locale}/bty/leaderboard`;

  const [resumable, setResumable] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setResumable(isResumableArenaLocalSession());
  }, []);

  if (resumable === null) {
    return (
      <div
        data-testid="arena-hub-card"
        className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
        aria-busy="true"
      >
        <p className="text-sm text-[#667085]">{t.arenaHubEntryLoading}</p>
        <div className="mt-5 h-10 w-full animate-pulse rounded-2xl bg-[#F0EBE3]" />
        <Link
          data-testid="arena-play-button"
          href={play}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white transition hover:bg-[#243446]"
        >
          {t.arenaHubPlayCta}
        </Link>
      </div>
    );
  }

  const showReady = resumable === false;
  const showContinue = resumable === true;
  const title = showContinue ? t.arenaHubCardTitleContinue : t.arenaHubReadyTitle;
  const body = showContinue ? t.arenaHubCardBodyResume : t.arenaHubCardBodyNew;

  return (
    <div
      data-testid="arena-hub-card"
      className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-[#1E2A38]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#667085]">{body}</p>

      <div className="mt-5 flex flex-col gap-3">
        {showContinue && (
          <Link
            data-testid="arena-continue-button"
            href={play}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white transition hover:bg-[#243446]"
          >
            {t.arenaHubContinueCta}
          </Link>
        )}
        <Link
          data-testid="arena-play-button"
          href={play}
          className={
            showContinue
              ? "flex h-12 w-full items-center justify-center rounded-2xl border border-[#D7CFBF] bg-white px-4 text-sm font-medium text-[#405A74] transition hover:bg-[#F6F4EE]"
              : "flex h-12 w-full items-center justify-center rounded-2xl bg-[#1E2A38] px-4 text-sm font-medium text-white transition hover:bg-[#243446]"
          }
        >
          {t.arenaHubPlayCta}
        </Link>
        {showReady && (
          <Link
            data-testid="arena-hub-cta-weekly-rank"
            href={leaderboard}
            className="text-center text-sm font-medium text-[#405A74] underline-offset-2 hover:underline"
          >
            {t.arenaHubCtaWeeklyRank}
          </Link>
        )}
      </div>
    </div>
  );
}
