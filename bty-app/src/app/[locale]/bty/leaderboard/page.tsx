"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { LeaderboardRow, UserAvatar, LeaderboardListSkeleton, EmptyState } from "@/components/bty-arena";
import { arenaStableLabel, getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { leaderboardTieRankSuffixDisplayKey } from "@/domain/rules/leaderboardTieBreak";

/**
 * BTY_ARENA_SYSTEM_SPEC §4: 리더보드 팀(역할/지점) 뷰 전환.
 * API contract: GET /api/arena/leaderboard?scope=overall|role|office returns LeaderboardRes.
 * Render-only: scope는 요청 파라미터로만 사용. scopeLabel, scopeUnavailable, leaderboard/nearMe/champions, myRank, myXp 등 표시 값은 모두 API 응답만 사용.
 * 순서: API 반환 순서만 사용. 타이 브레이커는 서버에서 적용되며, UI에서 정렬·재정렬하지 않음.
 */
type Row = {
  rank: number;
  codeName: string;
  subName: string;
  xpTotal: number;
  avatarUrl?: string | null;
  avatarLayers?: { characterImageUrl: string | null; outfitImageUrl: string | null } | null;
  tier?: string;
};

type LeaderboardScope = "overall" | "role" | "office";

type LeaderboardRes = {
  viewerAnonymous?: boolean;
  leaderboard?: Row[];
  nearMe?: Row[];
  top10?: Row[];
  champions?: Row[];
  myRank?: number | null;
  myXp?: number;
  count?: number;
  scope?: LeaderboardScope;
  scopeLabel?: string | null;
  scopeUnavailable?: boolean;
  /** 이번 주 리셋 일시(주간 종료). API 응답만 사용, UI에서 계산 금지. */
  week_end?: string | null;
  reset_at?: string | null;
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
    noData: "아직 주간 XP 기록이 없어요. Arena에서 첫 시나리오를 시작해 보세요.",
    noDataCta: "Arena에서 시나리오 시작하기",
    notOnBoard: "아직 리더보드에 없어요. Arena에서 시나리오를 끝까지 플레이한 뒤 「다음 시나리오」 버튼을 눌러 주세요.",
    notOnBoardHint: "캐릭터(코드명) 저장만으로는 리더보드에 올라가지 않아요.",
    statusNoRow: "저장된 주간 XP: 없음 (시나리오 완료 후 「다음 시나리오」를 눌렀는지 확인하세요)",
    statusHasRow: "저장된 주간 XP:",
    championsTitle: "이번 주 챔피언",
    champion: "Champion",
    runnerUp: "Runner-up",
    tabOverall: "전체",
    tabRole: "역할",
    tabOffice: "지점",
    scopeRole: "역할",
    scopeOffice: "지점",
    scopeUnavailable: "역할·지점 정보가 없어 이 뷰를 사용할 수 없어요.",
    weekResetLabel: "이번 주 리셋 일시",
    retryAriaLabel: "리더보드 다시 불러오기",
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
    tabOverall: "Overall",
    tabRole: "Role",
    tabOffice: "Office",
    scopeRole: "Role",
    scopeOffice: "Office",
    scopeUnavailable: "No role or office context for this view.",
    weekResetLabel: "Weekly reset",
    retryAriaLabel: "Reload leaderboard",
  },
};

export default function LeaderboardPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en";
  const t = LB[locale];
  const tBty = getMessages(locale).bty;

  const [scope, setScope] = React.useState<LeaderboardScope>("overall");
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
        const url =
          scope === "overall"
            ? "/api/arena/leaderboard"
            : `/api/arena/leaderboard?scope=${encodeURIComponent(scope)}`;
        const json = await arenaFetch<LeaderboardRes>(url);
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
  }, [scope]);

  /** API 반환 순서만 사용. 타이 브레이커 적용 시에도 UI에서 정렬하지 않음. */
  const rows = data?.nearMe?.length ? data.nearMe : (data?.leaderboard ?? []);
  const myRank = data?.myRank ?? null;
  const anonymousView = Boolean(data?.viewerAnonymous);

  React.useEffect(() => {
    if (loading || error || data?.viewerAnonymous || myRank !== 0) return;
    let cancelled = false;
    arenaFetch<StatusRes>("/api/arena/leaderboard/status")
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus({ hasWeeklyXpRow: false, xpTotal: 0 }); });
    return () => { cancelled = true; };
  }, [loading, error, myRank, data?.viewerAnonymous]);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }} aria-label={tBty.leaderboardMainRegionAria}>
      <div style={{ marginTop: 0 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{t.title}</h1>
        <p style={{ margin: "6px 0 0", fontSize: 15, opacity: 0.85 }}>{t.slogan}</p>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
          {t.subtitle}
        </div>
        {data?.viewerAnonymous && (
          <div
            role="status"
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #e8d4a8",
              background: "#fffbeb",
              fontSize: 13,
              color: "#713f12",
            }}
          >
            {locale === "ko"
              ? "공개 순위만 보이는 중이에요. 내 순위·역할·지점 뷰를 쓰려면 bty에서 로그인한 뒤 다시 열어 주세요."
              : "Showing public rankings only. Sign in from bty home to see your rank and Role/Office views."}
          </div>
        )}
        {/* API 응답의 주간 경계 값만 표시(UI에서 계산 금지) */}
        {data?.reset_at != null && (
          <div role="region" aria-label={tBty.leaderboardWeekResetRegion} style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            {t.weekResetLabel}:{" "}
            {new Date(data.reset_at).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })}
            {locale === "ko" ? " (UTC)" : " UTC"}
          </div>
        )}
        {/* Scope tabs: Overall | Role | Office (BTY_ARENA_SYSTEM_SPEC §4) */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}
          role="group"
          aria-label={locale === "ko" ? "리더보드 뷰 전환" : "Leaderboard view scope"}
        >
          {(["overall", "role", "office"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={anonymousView && s !== "overall"}
              onClick={() => {
                if (anonymousView && s !== "overall") return;
                setScope(s);
              }}
              aria-label={
                s === "overall"
                  ? (locale === "ko" ? "리더보드 전체 보기" : "View leaderboard overall")
                  : s === "role"
                    ? (locale === "ko" ? "리더보드 역할별 보기" : "View leaderboard by role")
                    : locale === "ko"
                      ? "리더보드 지점별 보기"
                      : "View leaderboard by office"
              }
              aria-pressed={scope === s}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: scope === s ? "2px solid var(--arena-accent, #6366f1)" : "1px solid #e0e0e0",
                background: scope === s ? "color-mix(in srgb, var(--arena-accent, #6366f1) 12%, transparent)" : "transparent",
                fontSize: 14,
                fontWeight: scope === s ? 600 : 500,
                cursor: anonymousView && s !== "overall" ? "not-allowed" : "pointer",
                opacity: anonymousView && s !== "overall" ? 0.45 : 1,
              }}
            >
              {s === "overall" ? t.tabOverall : s === "role" ? t.tabRole : t.tabOffice}
            </button>
          ))}
        </div>
        {/* §4: 스코프 라벨 한 줄 — 전체 / 역할: Doctor / 지점: OO점 */}
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
          {scope === "overall"
            ? t.tabOverall
            : scope === "role"
              ? data?.scopeLabel ? `${t.scopeRole}: ${data.scopeLabel}` : t.scopeRole
              : data?.scopeLabel ? `${t.scopeOffice}: ${data.scopeLabel}` : t.scopeOffice
          }
        </div>
        {/* DESIGN_FIRST_IMPRESSION_BRIEF §2·PROJECT_BACKLOG §8: 데이터 없을 때 일러·아이콘 + 한 줄 문구 */}
        {data?.scopeUnavailable && (
          <div style={{ marginTop: 12 }}>
            <EmptyState
              icon="👁"
              message={t.scopeUnavailable}
              style={{ padding: "20px 16px", background: "color-mix(in srgb, var(--arena-accent, #6366f1) 6%, transparent)", borderRadius: 12 }}
            />
          </div>
        )}
        {data?.season && (
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            {data.season.name ?? (locale === "ko" ? "시즌" : "Season")}{" "}
            {data.season.start_at ? new Date(data.season.start_at).toLocaleDateString(locale) : ""}
            {" → "}
            {data.season.end_at ? new Date(data.season.end_at).toLocaleDateString(locale) : ""}
          </div>
        )}
        {myRank != null && myRank > 0 && (
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }} role="group" aria-label={locale === "ko" ? "내 순위 및 주간 XP" : "Your rank and weekly XP"}>
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
          role="region"
          aria-label={locale === "ko" ? "이번 주 챔피언" : "This week's champions"}
          style={{
            marginTop: 20,
            padding: "16px 20px",
            background: "linear-gradient(135deg, var(--arena-bg) 0%, var(--arena-bg-end) 100%)",
            borderRadius: 16,
            border: "1px solid color-mix(in srgb, var(--arena-accent) 15%, transparent)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>{t.championsTitle}</div>
          <div role="list" aria-label={locale === "ko" ? "챔피언·러너업 목록" : "Champions and runners-up list"} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            {(data?.champions ?? []).map((c, i) => {
              const label = i === 0 ? t.champion : t.runnerUp;
              const name = c.subName ? `${c.codeName} · ${c.subName}` : c.codeName;
              return (
                <div
                  key={c.rank}
                  role="listitem"
                  aria-label={locale === "ko" ? `${label}: ${name}` : `${label}: ${name}`}
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
                    avatarLayers={c.avatarLayers}
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
        role="region"
        aria-label={locale === "ko" ? "리더보드 목록" : "Leaderboard list"}
        style={{
          marginTop: 18,
          padding: 18,
          border: "1px solid color-mix(in srgb, var(--arena-text-soft) 20%, transparent)",
          borderRadius: 14,
          background: "var(--arena-card)",
        }}
      >
        {loading && (
          <div
            aria-busy="true"
            aria-label={locale === "ko" ? "리더보드 불러오는 중" : "Loading leaderboard"}
          >
            <p
              style={{
                margin: 0,
                padding: "12px 0 8px",
                fontSize: 13,
                color: "var(--arena-text-soft)",
                opacity: 0.9,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              aria-live="polite"
            >
              <span aria-hidden style={{ fontSize: 18 }}>🏆</span>
              {t.loading}
            </p>
            <LeaderboardListSkeleton rows={8} variant="inner" />
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              padding: 12,
              border: "1px solid #f1c0c0",
              borderRadius: 12,
              background: "#fff7f7",
            }}
          >
            <div style={{ fontWeight: 800 }}>{t.failed}</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{error}</div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                const url =
                  scope === "overall"
                    ? "/api/arena/leaderboard"
                    : `/api/arena/leaderboard?scope=${encodeURIComponent(scope)}`;
                arenaFetch<LeaderboardRes>(url)
                  .then((json) => setData(json))
                  .catch((e: unknown) => setError(e instanceof Error ? e.message : "FAILED_TO_LOAD"))
                  .finally(() => setLoading(false));
              }}
              aria-label={t.retryAriaLabel}
              style={{
                marginTop: 10,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #c0a0a0",
                background: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {locale === "ko" ? "다시 시도" : "Retry"}
            </button>
          </div>
        )}

        {!loading && !error && (
          <div role="list" aria-label={locale === "ko" ? "주간 순위 목록" : "Weekly ranking list"} style={{ display: "grid", gap: 10 }}>
            {rows.map((r, i) => {
              const loc = (locale === "ko" ? "ko" : "en") as Locale;
              const tieKey = leaderboardTieRankSuffixDisplayKey(
                i > 0 && r.xpTotal === rows[i - 1]!.xpTotal
              );
              const tieSuffix =
                tieKey != null ? arenaStableLabel(loc, "arena.leaderboard.tieRankSuffix") : null;
              return (
              <LeaderboardRow
                key={`${r.rank}-${r.codeName}-${i}`}
                rank={r.rank}
                codeName={r.codeName}
                subName={r.subName}
                weeklyXp={r.xpTotal}
                avatarUrl={r.avatarUrl}
                avatarLayers={r.avatarLayers}
                tier={r.tier}
                isMe={myRank != null && r.rank === myRank}
                locale={locale}
                tieRankSuffix={tieSuffix}
              />
            );})}

            {/* DESIGN_FIRST_IMPRESSION_BRIEF §2·PROJECT_BACKLOG §8: 빈 목록 시 일러·아이콘 + 한 줄 문구 + CTA */}
            {rows.length === 0 && (
              <EmptyState
                icon="🏆"
                message={t.noData}
                cta={
                  <Link
                    href={`/${locale}/bty-arena/run`}
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
    </main>
  );
}
