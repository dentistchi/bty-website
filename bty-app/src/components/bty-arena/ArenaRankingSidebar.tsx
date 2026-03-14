"use client";

import React, { useEffect, useState, useCallback } from "react";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { LeaderboardRow, LeaderboardListSkeleton, EmptyState } from "@/components/bty-arena";

type Row = {
  rank: number;
  codeName: string;
  subName?: string | null;
  xpTotal: number;
  avatarUrl?: string | null;
  avatarLayers?: { characterImageUrl: string | null; outfitImageUrl: string | null } | null;
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
    retry: "다시 시도",
    retryAriaLabel: "실시간 순위 다시 불러오기",
    empty: "아직 순위가 없어요. 시나리오를 완료하면 여기 나타나요.",
  },
  en: {
    title: "Live ranking",
    yourRank: "Your rank",
    weeklyXp: "Weekly XP",
    gapToAbove: "Gap to person above",
    xpToGo: "XP to overtake",
    loading: "Loading…",
    failed: "Failed to load",
    retry: "Retry",
    retryAriaLabel: "Reload live ranking",
    empty: "No rankings yet. Finish a scenario to appear here.",
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
      setError(null);
      const json = await arenaFetch<LeaderboardRes>("/api/arena/leaderboard");
      setData(json);
    } catch (e: unknown) {
      setData(null);
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
      role="region"
      aria-labelledby="arena-ranking-sidebar-title"
      style={{
        width: "100%",
        maxWidth: 280,
        paddingTop: 8,
        paddingBottom: 24,
      }}
    >
      <h3
        id="arena-ranking-sidebar-title"
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
        {loading && (
          <div aria-busy="true" aria-label={t.loading}>
            <p
              style={{
                margin: 0,
                padding: "12px 10px 8px",
                fontSize: 13,
                color: "var(--arena-text-soft)",
                opacity: 0.9,
              }}
              aria-live="polite"
            >
              {t.loading}
            </p>
            <LeaderboardListSkeleton rows={5} variant="inner" />
          </div>
        )}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              padding: 12,
              fontSize: 12,
              color: "#8b2e2e",
              background: "#fff7f7",
              border: "1px solid #f1c0c0",
              borderRadius: 8,
            }}
          >
            <div>{t.failed}</div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchLeaderboard();
              }}
              aria-label={t.retryAriaLabel}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #c0a0a0",
                background: "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t.retry}
            </button>
          </div>
        )}
        {!loading && !error && (
          <>
            {rows.length === 0 ? (
              <EmptyState
                icon="📊"
                message={t.empty}
                style={{ padding: "20px 12px", fontSize: 13 }}
              />
            ) : (
              <div role="list" style={{ display: "grid", gap: 6, padding: 10 }}>
                {rows.slice(0, 8).map((r) => (
                  <LeaderboardRow
                    key={`${r.rank}-${r.codeName}`}
                    rank={r.rank}
                    codeName={r.codeName}
                    subName={r.subName}
                    weeklyXp={r.xpTotal}
                    avatarUrl={r.avatarUrl}
                    avatarLayers={r.avatarLayers}
                    tier={r.tier}
                    isMe={myRank != null && r.rank === myRank}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
