"use client";

import React from "react";
import { useParams } from "next/navigation";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { LeaderboardRow } from "@/components/bty-arena";

type Row = {
  rank: number;
  codeName: string;
  subName: string;
  xpTotal: number;
  avatarUrl?: string | null;
};

type LeaderboardRes = {
  leaderboard?: Row[];
  nearMe?: Row[];
  top10?: Row[];
  myRank?: number | null;
  myXp?: number;
  count?: number;
  season?: { league_id: string; start_at: string; end_at: string; name?: string | null } | null;
};

const LB = {
  ko: {
    title: "리더보드",
    subtitle: "티어 · 코드명 · 주간 XP",
    yourRank: "내 순위",
    loading: "로딩 중…",
    failed: "불러오기 실패",
    tier: "티어",
    weeklyXp: "주간 XP",
    noData: "아직 데이터가 없어요. Arena를 플레이하면 주간 XP가 쌓입니다.",
    notOnBoard: "아직 리더보드에 없어요. Arena를 플레이해서 XP를 쌓아 보세요.",
  },
  en: {
    title: "Leaderboard",
    subtitle: "Tier · Code · Weekly XP",
    yourRank: "Your rank",
    loading: "Loading…",
    failed: "Failed",
    tier: "Tier",
    weeklyXp: "Weekly XP",
    noData: "No data yet. Play Arena to generate weekly XP.",
    notOnBoard: "You're not on the leaderboard yet. Play Arena to earn XP.",
  },
};

export default function LeaderboardPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const t = LB[locale];

  const [data, setData] = React.useState<LeaderboardRes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const json = await arenaFetch<LeaderboardRes>("/api/arena/leaderboard");
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "FAILED_TO_LOAD");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.nearMe?.length ? data.nearMe : (data?.leaderboard ?? []);
  const myRank = data?.myRank ?? null;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <BtyTopNav />
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{t.title}</h1>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
          {t.subtitle}
        </div>
        {data?.season && (
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            {data.season.name ?? (locale === "ko" ? "시즌" : "Season")}{" "}
            {data.season.start_at ? new Date(data.season.start_at).toLocaleDateString(locale) : ""}
            {" → "}
            {data.season.end_at ? new Date(data.season.end_at).toLocaleDateString(locale) : ""}
          </div>
        )}
        {myRank != null && myRank > 0 && (
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>
            {t.yourRank}: #{myRank} · {data?.myXp ?? 0} XP
          </div>
        )}
        {!loading && !error && myRank !== null && myRank === 0 && (
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>{t.notOnBoard}</div>
        )}
      </div>

      <div style={{ marginTop: 18, padding: 18, border: "1px solid #eee", borderRadius: 14 }}>
        {loading && <div style={{ opacity: 0.8 }}>{t.loading}</div>}
        {error && (
          <div
            style={{
              padding: 12,
              border: "1px solid #f1c0c0",
              borderRadius: 12,
              background: "#fff7f7",
            }}
          >
            <div style={{ fontWeight: 800 }}>{t.failed}</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{error}</div>
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <LeaderboardRow
                key={r.rank}
                rank={r.rank}
                codeName={r.codeName}
                subName={r.subName}
                weeklyXp={r.xpTotal}
                avatarUrl={r.avatarUrl}
                isMe={myRank != null && r.rank === myRank}
              />
            ))}

            {rows.length === 0 && (
              <div style={{ opacity: 0.75 }}>{t.noData}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
