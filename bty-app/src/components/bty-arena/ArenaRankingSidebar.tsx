"use client";

import React, { useEffect, useState, useCallback } from "react";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { LeaderboardRow, LeaderboardListSkeleton } from "@/components/bty-arena";

type Row = {
  rank: number;
  codeName: string;
  subName?: string | null;
  xpTotal: number;
  avatarUrl?: string | null;
  tier?: string | null;
};

type LeaderboardRes = {
  leaderboard?: Row[];
  nearMe?: Row[];
  top10?: Row[];
  myRank?: number | null;
  myXp?: number;
  gapToAbove?: number | null;
  count?: number;
};

const POLL_MS = 30_000;

const LABELS = {
  ko: {
    title: "실시간 순위",
    yourRank: "내 순위",
    weeklyXp: "주간 XP",
    gapToAbove: "바로 위와의 차이",
    xpToGo: "XP 더하면 추월",
    loading: "로딩 중…",
    failed: "불러오기 실패",
  },
  en: {
    title: "Live ranking",
    yourRank: "Your rank",
    weeklyXp: "Weekly XP",
    gapToAbove: "Gap to person above",
    xpToGo: "XP to overtake",
    loading: "Loading…",
    failed: "Failed to load",
  },
};

export interface ArenaRankingSidebarProps {
  locale: string;
}

/**
 * 실시간 순위 사이드바: nearMe + 내 순위 + 바로 위와의 XP 차이.
 * 시나리오 플레이 중 동기 부여용. API에서 gapToAbove 사용.
 */
export function ArenaRankingSidebar({ locale }: ArenaRankingSidebarProps) {
  const [data, setData] = useState<LeaderboardRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const json = await arenaFetch<LeaderboardRes>("/api/arena/leaderboard");
      setData(json);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "FAILED_TO_LOAD");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const t = locale === "ko" ? LABELS.ko : LABELS.en;
  const rows = data?.nearMe?.length ? data.nearMe : data?.top10 ?? [];
  const myRank = data?.myRank ?? null;
  const myXp = data?.myXp ?? 0;
  const gapToAbove = data?.gapToAbove ?? null;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 280,
        paddingTop: 8,
        paddingBottom: 24,
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--arena-text)",
        }}
      >
        {t.title}
      </h3>

      {myRank != null && myRank > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid color-mix(in srgb, var(--arena-accent) 25%, transparent)",
            background: "color-mix(in srgb, var(--arena-accent) 6%, transparent)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--arena-text)" }}>
            {t.yourRank}: #{myRank}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            {t.weeklyXp}: {myXp}
          </div>
          {gapToAbove != null && gapToAbove > 0 && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--arena-accent)",
              }}
            >
              {t.gapToAbove}: +{gapToAbove} {t.xpToGo}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--arena-text-soft) 20%, transparent)",
          borderRadius: 14,
          background: "var(--arena-card)",
          overflow: "hidden",
        }}
      >
        {loading && <LeaderboardListSkeleton rows={5} variant="inner" />}
        {error && (
          <div
            style={{
              padding: 12,
              fontSize: 12,
              color: "#8b2e2e",
              background: "#fff7f7",
            }}
          >
            {t.failed}
          </div>
        )}
        {!loading && !error && (
          <div style={{ display: "grid", gap: 6, padding: 10 }}>
            {rows.slice(0, 8).map((r) => (
              <LeaderboardRow
                key={`${r.rank}-${r.codeName}`}
                rank={r.rank}
                codeName={r.codeName}
                subName={r.subName}
                weeklyXp={r.xpTotal}
                avatarUrl={r.avatarUrl}
                tier={r.tier}
                isMe={myRank != null && r.rank === myRank}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
