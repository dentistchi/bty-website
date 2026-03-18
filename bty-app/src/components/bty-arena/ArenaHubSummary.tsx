"use client";

/**
 * Arena 허브 — 주간 순위·시즌 종료까지 일수. GET /api/arena/leaderboard 표시만 (계산·정렬 없음).
 */
import * as React from "react";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Payload = {
  myRank?: number | null;
  myXp?: number;
  viewerAnonymous?: boolean;
  season?: { end_at: string | null } | null;
  loadError?: boolean;
};

export function ArenaHubSummary({ locale }: { locale: string }) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/arena/leaderboard", { credentials: "include" })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as Payload;
        if (!r.ok && r.status === 401) return { viewerAnonymous: true } as Payload;
        if (!r.ok) return { loadError: true } as Payload;
        return d;
      })
      .then((d) => {
        if (alive) setData(d);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const endAt = data?.season?.end_at;
  const seasonText =
    data?.loadError || data?.viewerAnonymous
      ? "—"
      : !endAt
        ? "—"
        : (() => {
            const n = Math.max(
              0,
              Math.ceil((new Date(endAt).getTime() - Date.now()) / 86400000),
            );
            return loc === "ko" ? `${n}일` : `${n} day${n === 1 ? "" : "s"}`;
          })();

  let rankMain = "…";
  let rankSub: string | null = null;
  if (!loading) {
    if (data?.loadError) {
      rankMain = "—";
      rankSub = t.arenaHubSummaryLoadError;
    } else if (data?.viewerAnonymous) {
      rankMain = "—";
      rankSub = t.growthMyRankAnonymous;
    } else if (typeof data?.myRank === "number" && data.myRank > 0) {
      rankMain = `#${data.myRank}`;
      const xp = typeof data.myXp === "number" ? data.myXp : 0;
      if (xp > 0) {
        rankSub = t.growthMyRankWeeklyXpLine.replace(
          "{xp}",
          xp.toLocaleString(loc === "ko" ? "ko-KR" : "en-US"),
        );
      }
    } else {
      const xp = typeof data?.myXp === "number" ? data.myXp : 0;
      rankMain = "—";
      rankSub =
        xp === 0 ? t.growthMyRankWeekNotParticipated : t.growthMyRankNoRank;
    }
  }

  return (
    <div
      data-testid="arena-hub-summary"
      className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm"
      role="region"
      aria-label={t.arenaHubSummaryRegionAria}
      aria-busy={loading}
    >
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="shrink-0 text-[#667085]">{t.arenaHubWeeklyRankLabel}</span>
        <div className="min-w-0 text-right">
          <span className="font-semibold tabular-nums text-[#1E2A38]">{rankMain}</span>
          {rankSub ? (
            <p className="mt-1 text-xs leading-5 text-[#667085]">{rankSub}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#F0EBE3] pt-4 text-sm">
        <span className="text-[#667085]">{t.arenaHubSeasonEndsLabel}</span>
        <span className="font-semibold tabular-nums text-[#1E2A38]">{seasonText}</span>
      </div>
    </div>
  );
}
