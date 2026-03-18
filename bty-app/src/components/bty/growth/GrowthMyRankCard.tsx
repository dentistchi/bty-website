"use client";

/**
 * GET /api/arena/leaderboard — myRank·myXp 표시만; 정렬·계산 없음.
 */
import React from "react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type LeaderboardRes = {
  myRank?: number | null;
  myXp?: number;
  viewerAnonymous?: boolean;
};

export function GrowthMyRankCard({ locale }: { locale: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).uxPhase1Stub;
  const base = `/${locale}`;
  const [data, setData] = React.useState<LeaderboardRes | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/arena/leaderboard", { credentials: "include" })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as LeaderboardRes;
        if (!r.ok && r.status === 401) return { viewerAnonymous: true } as LeaderboardRes;
        if (!r.ok) return {} as LeaderboardRes;
        return d;
      })
      .then((d: LeaderboardRes) => {
        if (alive) setData(d);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section
      className="mb-4 rounded-2xl border border-bty-border bg-bty-soft p-4"
      role="region"
      aria-label={t.growthMyRankRegionAria}
    >
      <h2 className="text-sm font-semibold text-bty-text">{t.growthMyRankCardTitle}</h2>
      {loading && (
        <p className="mt-2 text-xs text-bty-muted" role="status">
          {t.growthMyRankLoading}
        </p>
      )}
      {!loading && data?.viewerAnonymous && (
        <p className="mt-2 text-sm text-bty-secondary">{t.growthMyRankAnonymous}</p>
      )}
      {!loading && !data?.viewerAnonymous && (
        <div className="mt-2 space-y-1 text-sm text-bty-text">
          {typeof data?.myRank === "number" && data.myRank > 0 ? (
            <p className="font-semibold tabular-nums">
              {t.growthMyRankYourRank.replace("{rank}", String(data.myRank))}
            </p>
          ) : (typeof data?.myXp === "number" ? data.myXp : 0) === 0 ? (
            <p className="text-bty-secondary">{t.growthMyRankWeekNotParticipated}</p>
          ) : (
            <p className="text-bty-secondary">{t.growthMyRankNoRank}</p>
          )}
          {typeof data?.myXp === "number" && (
            <p className="text-xs text-bty-secondary tabular-nums">
              {t.growthMyRankWeeklyXpLine.replace(
                "{xp}",
                data.myXp.toLocaleString(lang === "ko" ? "ko-KR" : "en-US")
              )}
            </p>
          )}
        </div>
      )}
      <p className="mt-3 text-xs">
        <Link
          href={`${base}/bty/leaderboard`}
          className="font-medium text-bty-navy underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2"
        >
          {t.growthMyRankSeeLeaderboard} →
        </Link>
      </p>
    </section>
  );
}
