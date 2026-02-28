"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { LeaderboardRow, UserAvatar, LeaderboardListSkeleton, EmptyState } from "@/components/bty-arena";

type Row = {
  rank: number;
  codeName: string;
  subName: string;
  xpTotal: number;
  avatarUrl?: string | null;
  tier?: string;
};

type LeaderboardRes = {
  leaderboard?: Row[];
  nearMe?: Row[];
  top10?: Row[];
  champions?: Row[];
  myRank?: number | null;
  myXp?: number;
  count?: number;
  season?: { league_id: string; start_at: string; end_at: string; name?: string | null } | null;
};

const LB = {
  ko: {
    title: "리더보드",
    slogan: "함께 달리는 동료들.",
    subtitle: "티어 · 코드명 · 주간 XP",
    yourRank: "내 순위",
    loading: "로딩 중…",
    failed: "불러오기 실패",
    tier: "티어",
    weeklyXp: "주간 XP",
    noData: "아직 기록이 없어요. 첫 시나리오를 시작해 보세요.",
    noDataCta: "Arena에서 시나리오 시작하기",
    notOnBoard: "아직 리더보드에 없어요. Arena에서 시나리오를 끝까지 플레이한 뒤 「다음 시나리오」 버튼을 눌러 주세요.",
    notOnBoardHint: "캐릭터(코드명) 저장만으로는 리더보드에 올라가지 않아요.",
    statusNoRow: "저장된 주간 XP: 없음 (시나리오 완료 후 「다음 시나리오」를 눌렀는지 확인하세요)",
    statusHasRow: "저장된 주간 XP:",
    championsTitle: "이번 주 챔피언",
    champion: "Champion",
    runnerUp: "Runner-up",
  },
  en: {
    title: "Leaderboard",
    slogan: "Running together.",
    subtitle: "Tier · Code · Weekly XP",
    yourRank: "Your rank",
    loading: "Loading…",
    failed: "Failed",
    tier: "Tier",
    weeklyXp: "Weekly XP",
    noData: "No data yet. Play Arena to generate weekly XP.",
    noDataCta: "Start a scenario in Arena",
    notOnBoard: "You're not on the leaderboard yet. Finish an Arena scenario and click \"Next scenario\" to appear.",
    notOnBoardHint: "Saving your character (code name) alone does not add you to the leaderboard.",
    statusNoRow: "Saved weekly XP: none (did you click \"Next scenario\" after finishing?)",
    statusHasRow: "Saved weekly XP:",
    championsTitle: "This week's champions",
    champion: "Champion",
    runnerUp: "Runner-up",
  },
};

export default function LeaderboardPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const t = LB[locale];

  const [data, setData] = React.useState<LeaderboardRes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  type StatusRes = { hasWeeklyXpRow?: boolean; xpTotal?: number };
  const [status, setStatus] = React.useState<StatusRes | null>(null);

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

  React.useEffect(() => {
    if (loading || error || myRank !== 0) return;
    let cancelled = false;
    arenaFetch<StatusRes>("/api/arena/leaderboard/status")
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus({ hasWeeklyXpRow: false, xpTotal: 0 }); });
    return () => { cancelled = true; };
  }, [loading, error, myRank]);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      <BtyTopNav />
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{t.title}</h1>
        <p style={{ margin: "6px 0 0", fontSize: 15, opacity: 0.85 }}>{t.slogan}</p>
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
          <div style={{ marginTop: 10 }}>
            <EmptyState
              icon="📊"
              message={t.notOnBoard}
              hint={t.notOnBoardHint}
              style={{ padding: "20px 0", alignItems: "flex-start", textAlign: "left" }}
            />
            {status != null && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#f5f5f5", borderRadius: 8, fontSize: 13 }}>
                {status.hasWeeklyXpRow ? `${t.statusHasRow} ${status.xpTotal ?? 0} XP` : t.statusNoRow}
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && !error && (data?.champions?.length ?? 0) > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: "16px 20px",
            background: "linear-gradient(135deg, var(--arena-bg) 0%, var(--arena-bg-end) 100%)",
            borderRadius: 16,
            border: "1px solid color-mix(in srgb, var(--arena-accent) 15%, transparent)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>{t.championsTitle}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            {(data?.champions ?? []).map((c, i) => {
              const label = i === 0 ? t.champion : t.runnerUp;
              const name = c.subName ? `${c.codeName} · ${c.subName}` : c.codeName;
              return (
                <div
                  key={c.rank}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.7)",
                    borderRadius: 12,
                    minWidth: 180,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: i === 0 ? "var(--arena-accent)" : "var(--arena-text-soft, #5C5868)",
                    }}
                  >
                    #{c.rank} {label}
                  </span>
                  <UserAvatar
                    avatarUrl={c.avatarUrl}
                    initials={c.codeName.slice(0, 2).toUpperCase()}
                    size="sm"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {c.tier ? `${c.tier} · ${c.xpTotal} XP` : `${c.xpTotal} XP`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          padding: 18,
          border: "1px solid color-mix(in srgb, var(--arena-text-soft) 20%, transparent)",
          borderRadius: 14,
          background: "var(--arena-card)",
        }}
      >
        {loading && <LeaderboardListSkeleton rows={8} variant="inner" />}
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
                tier={r.tier}
                isMe={myRank != null && r.rank === myRank}
              />
            ))}

            {rows.length === 0 && (
              <EmptyState
                icon="🏆"
                message={t.noData}
                cta={
                  <Link
                    href={`/${locale}/bty-arena`}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      background: "var(--arena-accent)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {t.noDataCta}
                  </Link>
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
