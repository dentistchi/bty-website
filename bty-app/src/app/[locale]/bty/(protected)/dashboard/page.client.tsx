"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  TierMilestoneModal,
  ProgressCard,
  ProgressVisual,
  UserAvatar,
  AvatarComposite,
  ArenaLevelsCard,
  CardSkeleton,
  LeaderboardRow,
} from "@/components/bty-arena";
import { EmotionalStatsPhrases } from "@/components/bty/EmotionalStatsPhrases";
import { arenaFetch } from "@/lib/http/arenaFetch";
import {
  arenaStableLabel,
  dashboardRecommendationEmptyCopy,
  getMessages,
  weeklyCompetitionStageBandCopy,
} from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { leaderboardTieRankSuffixDisplayKey } from "@/domain/rules/leaderboardTieBreak";
import { weeklyCompetitionStageTierBandDisplayLabelKey } from "@/domain/rules/weeklyCompetitionDisplay";
import { getVisibleAvatarCharacters, getAvatarCharacter, getCharacterThumbImageUrl } from "@/lib/bty/arena/avatarCharacters";
import { getAccessoryImageUrl, OUTFIT_OPTIONS_ALL } from "@/lib/bty/arena/avatarOutfits";
import { LeAirWidget } from "@/components/bty/dashboard/LeAirWidget";
import { LeStageWidget } from "@/components/bty/dashboard/LeStageWidget";
import { weeklyTierDisplayLabelKey } from "@/domain/rules/leaderboard";
import { calculateTier } from "@/domain/rules/weeklyXp";

type WeeklyXpRes = { weekStartISO?: string | null; weekEndISO?: string | null; xpTotal: number; count?: number };
/** Core XP API response. Dashboard uses only display fields for progress/milestone; no tier/code computation in UI. */
type CoreXpRes = {
  coreXpTotal: number;
  /** GET /api/arena/core-xp — 표시만. UI에서 coreXpTotal로 티어 계산 금지. */
  tier?: number;
  codeName: string;
  subName: string;
  seasonalXpTotal: number;
  codeHidden?: boolean;
  subNameRenameAvailable?: boolean;
  /** Display fields from API only (bty-ui-render-only: stage, progressPct, nextCodeName, xpToNext, codeLore, milestoneToCelebrate, previousSubName). */
  stage?: number;
  progressPct?: number;
  nextCodeName?: string;
  xpToNext?: number;
  codeLore?: string;
  milestoneToCelebrate?: 25 | 50 | 75;
  previousSubName?: string;
  avatarUrl?: string | null;
  avatarCharacterId?: string | null;
  avatarCharacterLocked?: boolean;
  avatarOutfitTheme?: "professional" | "fantasy" | null;
  avatarSelectedOutfitId?: string | null;
  avatarCharacterImageUrl?: string | null;
  avatarOutfitImageUrl?: string | null;
  currentOutfit?: { outfitId: string; outfitLabel: string; accessoryIds: string[]; accessoryLabels: string[] };
};
type LeagueRes = { league_id: string; start_at: string; end_at: string; name?: string | null };
type TodayXpRes = { xpToday: number };
type WeeklyStatsRes = {
  reflectionCount: number;
  reflectionTarget: number;
  reflectionQuestClaimed: boolean;
  weekStartISO?: string;
  weekMaxDailyXp?: number;
};
type UnlockedScenariosRes = {
  ok?: boolean;
  error?: string;
  track?: "staff" | "leader";
  maxUnlockedLevel?: string | null;
  previewLevel?: string;
  levels?: Array<{ level: string; title?: string; title_ko?: string; displayTitle?: string; items?: unknown[] }>;
  l4_access?: boolean;
  membershipPending?: boolean;
};

type MembershipRequestRes = {
  request: {
    id: number;
    user_id: string;
    job_function: string;
    joined_at: string;
    leader_started_at: string | null;
    status: "pending" | "approved";
    approved_at: string | null;
    approved_by: string | null;
    created_at: string;
    updated_at: string;
  } | null;
};

type LeadershipEngineStateRes = {
  currentStage: 1 | 2 | 3 | 4;
  stageName: string;
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
};

type AIRResultRes = { air: number; missedWindows: number; integritySlip: boolean };
type AIRSnapshotRes = { air_7d: AIRResultRes; air_14d: AIRResultRes; air_90d: AIRResultRes };

type TIIRes = {
  tii: number | null;
  avg_air: number | null;
  avg_mwd: number | null;
  tsp: number | null;
};

type CertifiedRes = {
  current: boolean;
  reasons_met: string[];
  reasons_missing: string[];
};

/** GET /api/arena/leadership-engine/stage-summary. Arena 결과·행동 패턴은 API가 채우면 표시. */
type StageSummaryRes = {
  currentStage: 1 | 2 | 3 | 4;
  stageName: string;
  progressPercent: number;
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
  arenaSummary: string | Record<string, unknown> | null;
  behaviorPattern: string | Record<string, unknown> | null;
};

/** GET /api/arena/dashboard/summary. 추천 위젯용 — API 응답 표시만. */
type DashboardSummaryRes = {
  progress?: { currentStage?: number; stageName?: string; progressPercent?: number };
  recommendation?: { nextAction?: string | null; source?: string | null; priority?: number | null };
};

type LiveLbRow = {
  rank: number;
  codeName: string;
  subName: string;
  xpTotal: number;
  avatarUrl?: string | null;
  avatarLayers?: { characterImageUrl: string | null; outfitImageUrl: string | null } | null;
  tier?: string;
};
type LiveLbRes = {
  leaderboard?: LiveLbRow[];
  nearMe?: LiveLbRow[];
  myRank?: number | null;
  count?: number;
};

const STREAK_KEY = "btyArenaStreak:v1";

/** PROJECT_BACKLOG §2: MVP에서는 true(노출), MVP 이후 false로 설정해 Arena Level 카드 숨김 */
const SHOW_ARENA_LEVELS = process.env.NEXT_PUBLIC_SHOW_ARENA_LEVELS !== "false";

function readLocalStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { streak?: number };
    return typeof parsed.streak === "number" ? parsed.streak : 0;
  } catch {
    return 0;
  }
}

export default function DashboardClient() {
  const [weekly, setWeekly] = React.useState<WeeklyXpRes | null>(null);
  const [core, setCore] = React.useState<CoreXpRes | null>(null);
  const [league, setLeague] = React.useState<LeagueRes | null>(null);
  const [xpToday, setXpToday] = React.useState<number>(0);
  const [streak, setStreak] = React.useState<number>(0);
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as string;
  const arenaPlayHref = `/${locale}/bty-arena/run`;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [subNameDraft, setSubNameDraft] = React.useState("");
  const [subNameSaving, setSubNameSaving] = React.useState(false);
  const [avatarCharacterSaving, setAvatarCharacterSaving] = React.useState(false);
  const [avatarSelectedOutfitSaving, setAvatarSelectedOutfitSaving] = React.useState(false);
  const [avatarPrefsSavedAt, setAvatarPrefsSavedAt] = React.useState<number | null>(null);
  /** 썸네일 PNG 미배포·404 시 깨진 아이콘 대신 이니셜만 표시 */
  const [characterThumbFailed, setCharacterThumbFailed] = React.useState<Record<string, boolean>>({});

  type MilestoneModalState = {
    milestone: 25 | 50 | 75;
    previousSubName?: string;
    subName: string;
    subNameRenameAvailable: boolean;
  };
  const [milestoneModal, setMilestoneModal] = React.useState<MilestoneModalState | null>(null);
  const [weeklyStats, setWeeklyStats] = React.useState<WeeklyStatsRes | null>(null);
  const [unlockedScenarios, setUnlockedScenarios] = React.useState<UnlockedScenariosRes | null>(null);
  const [membershipRequest, setMembershipRequest] = React.useState<MembershipRequestRes["request"]>(null);
  const [membershipSubmitMsg, setMembershipSubmitMsg] = React.useState<string | null>(null);
  const [membershipSubmitting, setMembershipSubmitting] = React.useState(false);
  const [isElite, setIsElite] = React.useState<boolean | null>(null);
  const [eliteBadges, setEliteBadges] = React.useState<Array<{ kind: string; labelKey: string }>>([]);
  const [eliteContentUnlocked, setEliteContentUnlocked] = React.useState<boolean | null>(null);
  const [leState, setLeState] = React.useState<LeadershipEngineStateRes | null>(null);
  const [leAir, setLeAir] = React.useState<AIRSnapshotRes | null>(null);
  const [leTii, setLeTii] = React.useState<TIIRes | null>(null);
  const [leCertified, setLeCertified] = React.useState<CertifiedRes | null>(null);
  const [leStageSummary, setLeStageSummary] = React.useState<StageSummaryRes | null>(null);
  const [dashboardSummary, setDashboardSummary] = React.useState<DashboardSummaryRes | null>(null);
  const [liveLbOpen, setLiveLbOpen] = React.useState(false);
  const [liveLbRows, setLiveLbRows] = React.useState<LiveLbRow[]>([]);
  const [liveLbLoading, setLiveLbLoading] = React.useState(false);
  const [liveLbErr, setLiveLbErr] = React.useState<string | null>(null);
  const [liveLbNotRankedBanner, setLiveLbNotRankedBanner] = React.useState(false);
  const [liveLbNearMeFallback, setLiveLbNearMeFallback] = React.useState(false);
  const [membershipForm, setMembershipForm] = React.useState({
    job_function: "assistant",
    joined_at: "",
    leader_started_at: "",
  });

  async function saveSubName() {
    if (!subNameDraft.trim() || subNameDraft.length > 7) return;
    try {
      setSubNameSaving(true);
      await arenaFetch("/api/arena/sub-name", { json: { subName: subNameDraft.trim() } });
      const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => core);
      if (next) setCore(next);
      setSubNameDraft("");
    } catch {
      // ignore
    } finally {
      setSubNameSaving(false);
    }
  }

  async function selectAvatarCharacter(characterId: string | null) {
    const nextCharacterId = characterId ?? core?.avatarCharacterId ?? null;
    const nextAvatarUrl =
      nextCharacterId ? getAvatarCharacter(nextCharacterId)?.imageUrl ?? null : null;
    setCore((c) =>
      c ? { ...c, avatarCharacterId: nextCharacterId, avatarUrl: nextAvatarUrl } : c
    );
    setAvatarCharacterSaving(true);
    try {
      await arenaFetch("/api/arena/profile", {
        method: "PATCH",
        json: { avatarCharacterId: characterId, avatarUrl: null },
      });
      const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => core);
      if (next) setCore(next);
      setAvatarPrefsSavedAt(Date.now());
      setTimeout(() => setAvatarPrefsSavedAt(null), 2000);
    } catch {
      setCore((c) => (c ? { ...c, avatarCharacterId: core?.avatarCharacterId ?? null } : c));
    } finally {
      setAvatarCharacterSaving(false);
    }
  }

  async function saveAvatarSelectedOutfit(outfitId: string | null) {
    setAvatarSelectedOutfitSaving(true);
    try {
      await arenaFetch("/api/arena/profile", {
        method: "PATCH",
        json: { avatarSelectedOutfitId: outfitId },
      });
      const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => core);
      if (next) setCore(next);
      setAvatarPrefsSavedAt(Date.now());
      setTimeout(() => setAvatarPrefsSavedAt(null), 2000);
    } catch {
      // ignore
    } finally {
      setAvatarSelectedOutfitSaving(false);
    }
  }

  async function submitMembershipRequest() {
    const loc = (params?.locale === "ko" ? "ko" : "en") as Locale;
    const t = getMessages(loc).arenaMembership;
    const jf = membershipForm.job_function.trim();
    const joined = membershipForm.joined_at.trim().slice(0, 10);
    if (!jf || !joined) {
      setMembershipSubmitMsg(t.validationRequired);
      return;
    }
    setMembershipSubmitMsg(null);
    setMembershipSubmitting(true);
    try {
      await arenaFetch("/api/arena/membership-request", {
        method: "POST",
        json: {
          job_function: jf,
          joined_at: joined,
          leader_started_at: membershipForm.leader_started_at.trim().slice(0, 10) || null,
        },
      });
      setMembershipSubmitMsg(t.submitSuccess);
      const res = await arenaFetch<MembershipRequestRes>("/api/arena/membership-request").catch(() => ({ request: null }));
      if (res?.request) setMembershipRequest(res.request);
    } catch (e) {
      setMembershipSubmitMsg(e instanceof Error ? e.message : t.submitError);
    } finally {
      setMembershipSubmitting(false);
    }
  }

  React.useEffect(() => {
    let alive = true;
    setStreak(readLocalStreak());

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const w = await arenaFetch<WeeklyXpRes>("/api/arena/weekly-xp").catch(
          () => ({ xpTotal: 0 } as WeeklyXpRes)
        );

        const fallbackCore: CoreXpRes = {
          coreXpTotal: 0,
          codeName: "FORGE",
          subName: "Spark",
          seasonalXpTotal: 0,
        };
        const [c, leagueRes, todayRes, statsRes, unlockedRes, membershipRes, eliteRes, leStateRes, leAirRes, leTiiRes, leCertifiedRes, stageSummaryRes, dashboardSummaryRes] = await Promise.all([
          arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => fallbackCore),
          arenaFetch<LeagueRes>("/api/arena/league/active").catch(() => null),
          arenaFetch<TodayXpRes>("/api/arena/today-xp").catch(() => ({ xpToday: 0 })),
          arenaFetch<WeeklyStatsRes>("/api/arena/weekly-stats").catch(() => null),
          arenaFetch<UnlockedScenariosRes>(`/api/arena/unlocked-scenarios?locale=${locale}`).catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            return msg === "UNAUTHENTICATED" ? ({ error: "UNAUTHENTICATED" } as UnlockedScenariosRes) : null;
          }),
          arenaFetch<MembershipRequestRes>("/api/arena/membership-request").catch(() => ({ request: null })),
          arenaFetch<{
            isElite?: boolean;
            badges?: Array<{ kind: string; labelKey: string }>;
            eliteContentUnlocked?: boolean;
          }>("/api/me/elite").catch(() => ({
            isElite: false,
            badges: [] as Array<{ kind: string; labelKey: string }>,
            eliteFetchFailed: true as const,
          })),
          arenaFetch<LeadershipEngineStateRes>("/api/arena/leadership-engine/state").catch(() => null),
          arenaFetch<AIRSnapshotRes>("/api/arena/leadership-engine/air").catch(() => null),
          arenaFetch<TIIRes>("/api/arena/leadership-engine/tii").catch(() => null),
          arenaFetch<CertifiedRes>("/api/arena/leadership-engine/certified").catch(() => null),
          arenaFetch<StageSummaryRes>("/api/arena/leadership-engine/stage-summary").catch(() => null),
          arenaFetch<DashboardSummaryRes>("/api/arena/dashboard/summary").catch(() => null),
        ]);

        if (!alive) return;
        setWeekly(w);
        setCore(c);
        if (c?.milestoneToCelebrate != null) {
          setMilestoneModal({
            milestone: c.milestoneToCelebrate,
            previousSubName: c.previousSubName ?? undefined,
            subName: c.subName ?? "Spark",
            subNameRenameAvailable: Boolean(c.subNameRenameAvailable),
          });
        }
        if (leagueRes) setLeague(leagueRes);
        setXpToday(todayRes?.xpToday ?? 0);
        if (statsRes) setWeeklyStats(statsRes);
        if (unlockedRes) setUnlockedScenarios(unlockedRes);
        if (membershipRes?.request != null) setMembershipRequest(membershipRes.request);
        setIsElite(Boolean(eliteRes?.isElite));
        setEliteBadges(eliteRes?.badges ?? []);
        const eliteFailed = Boolean(
          eliteRes && "eliteFetchFailed" in eliteRes && eliteRes.eliteFetchFailed
        );
        if (eliteFailed) {
          setEliteContentUnlocked(null);
        } else {
          const ok = eliteRes as { eliteContentUnlocked?: boolean };
          setEliteContentUnlocked(
            typeof ok.eliteContentUnlocked === "boolean" ? ok.eliteContentUnlocked : null
          );
        }
        if (leStateRes) setLeState(leStateRes);
        if (leAirRes) setLeAir(leAirRes);
        if (leTiiRes) setLeTii(leTiiRes);
        if (leCertifiedRes) setLeCertified(leCertifiedRes);
        if (stageSummaryRes) setLeStageSummary(stageSummaryRes);
        if (dashboardSummaryRes) setDashboardSummary(dashboardSummaryRes);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [locale]);

  const localeTyped = (locale === "ko" ? "ko" : "en") as Locale;
  const tArenaLevels = getMessages(localeTyped).arenaLevels;
  const tAvatarOutfit = getMessages(localeTyped).avatarOutfit;
  const tArenaMembership = getMessages(localeTyped).arenaMembership;
  const tElitePage = getMessages(localeTyped).elitePage;
  const tLanding = getMessages(localeTyped).landing;
  const tBty = getMessages(localeTyped).bty;
  const openLiveLeaderboardModal = React.useCallback(async () => {
    setLiveLbOpen(true);
    setLiveLbLoading(true);
    setLiveLbErr(null);
    setLiveLbNotRankedBanner(false);
    setLiveLbNearMeFallback(false);
    try {
      const json = await arenaFetch<LiveLbRes>("/api/arena/leaderboard");
      const near = json.nearMe ?? [];
      const board = json.leaderboard ?? [];
      const cnt =
        typeof json.count === "number" ? json.count : (Array.isArray(board) ? board.length : 0);
      const myRank = json.myRank;
      let rows: LiveLbRow[];
      let nearFallback = false;
      if (near.length > 0) {
        rows = near.slice(0, 25);
      } else if (board.length > 0) {
        rows = board.slice(0, 25);
        nearFallback = true;
      } else {
        rows = [];
      }
      setLiveLbRows(rows);
      setLiveLbNearMeFallback(nearFallback);
      setLiveLbNotRankedBanner(
        rows.length > 0 && cnt > 0 && (myRank == null || myRank < 1),
      );
    } catch {
      setLiveLbErr(tBty.dashboardLiveLeaderboardFailed);
      setLiveLbRows([]);
    } finally {
      setLiveLbLoading(false);
    }
  }, [tBty.dashboardLiveLeaderboardFailed]);
  const displayAvatarUrl =
    core?.avatarUrl ?? getAvatarCharacter(core?.avatarCharacterId)?.imageUrl ?? null;
  const avatarLayers =
    core?.avatarCharacterImageUrl != null || core?.avatarOutfitImageUrl != null
      ? { characterImageUrl: core?.avatarCharacterImageUrl ?? null, outfitImageUrl: core?.avatarOutfitImageUrl ?? null }
      : undefined;
  /** §6·§7 render-only: API currentOutfit.accessoryIds → domain getAccessoryImageUrl → AvatarComposite accessoryUrls */
  const avatarAccessoryUrls =
    core?.currentOutfit?.accessoryIds?.map((id) => getAccessoryImageUrl(id)) ?? [];

  const content = (
    <main
      style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}
      aria-label={tBty.dashboardMainRegionAria}
    >
      {/* DESIGN_FIRST_IMPRESSION_BRIEF §4 A: 첫 화면 = 히어로 한 문장 — 페이지 최상단에 배치 */}
      <div className="bty-hero" style={{ paddingTop: 32, paddingBottom: 40, marginBottom: 32 }}>
        <p className="bty-hero-title" style={{ margin: 0, fontSize: "clamp(1.75rem, 4vw, 2rem)", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.35, color: "var(--arena-text)" }}>
          {locale === "ko" ? "오늘도 한 걸음, Arena에서." : "One step today, in the Arena."}
        </p>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {avatarLayers?.characterImageUrl ? (
            <AvatarComposite
              size={56}
              characterUrl={avatarLayers.characterImageUrl}
              outfitUrl={avatarLayers.outfitImageUrl ?? undefined}
              accessoryUrls={avatarAccessoryUrls}
              alt=""
            />
          ) : (
            <UserAvatar
              avatarUrl={displayAvatarUrl}
              initials={core?.codeName?.slice(0, 2)}
              alt=""
              size="lg"
            />
          )}
          <div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
            <h1 id="dashboard-heading" style={{ margin: 0, fontSize: 28 }}>{tBty.dashboardPageTitle}</h1>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>{tBty.dashboardHeroSubtitle}</div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ marginTop: 24 }}>
          <ProgressCard label={tBty.dashboardWeeklyRankWidgetTitle}>
            <div
              role="status"
              aria-busy="true"
              aria-live="polite"
              aria-label={tBty.dashboardWeeklyWidgetLoading}
            >
              <CardSkeleton lines={2} />
            </div>
          </ProgressCard>
          <div style={{ display: "grid", gap: 28, marginTop: 28 }}>
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} lines={i === 1 ? 3 : 2} />
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 14, border: "1px solid #f2c", borderRadius: 12 }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <div style={{ marginTop: 6 }}>{error}</div>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "grid", gap: 28 }}>
          <ProgressCard label={tBty.dashboardWeeklyRankWidgetTitle}>
            <div role="region" aria-label={tBty.dashboardWeeklyWidgetAria}>
              <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
                {tBty.dashboardWeeklyXpCaption}
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px 0" }}>
                {typeof weekly?.xpTotal === "number"
                  ? weekly.xpTotal.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")
                  : "—"}
              </p>
              {typeof weekly?.xpTotal === "number" && (
                <>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px 0", opacity: 0.92 }}>
                    {tBty.dashboardWeeklyTierCaption}:{" "}
                    {arenaStableLabel(
                      localeTyped,
                      weeklyTierDisplayLabelKey(calculateTier(weekly.xpTotal)),
                    )}
                  </p>
                  <p
                    style={{ fontSize: 14, fontWeight: 500, margin: "0 0 8px 0", opacity: 0.88 }}
                    role="status"
                  >
                    {tBty.dashboardWeeklyCompetitionStageCaption}:{" "}
                    {weeklyCompetitionStageBandCopy(
                      localeTyped,
                      weeklyCompetitionStageTierBandDisplayLabelKey(calculateTier(weekly.xpTotal)),
                    )}
                  </p>
                </>
              )}
              {weekly?.weekStartISO != null && weekly?.weekEndISO != null && (
                <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
                  {String(weekly.weekStartISO).slice(0, 10)} →{" "}
                  {String(weekly.weekEndISO).slice(0, 10)} (UTC)
                </p>
              )}
              <Link
                href={`/${locale}/bty/leaderboard`}
                className="bty-btn-outline"
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--arena-accent)",
                  color: "var(--arena-text)",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 8,
                }}
                aria-label={tBty.dashboardShortcutWeeklyRanking}
              >
                {tBty.dashboardWeeklyRankSeeLeaderboard} →
              </Link>
              <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>{tBty.dashboardWeeklyRankHint}</p>
              <button
                type="button"
                onClick={openLiveLeaderboardModal}
                className="bty-btn-outline"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--arena-accent)",
                  background: "transparent",
                  color: "var(--arena-text)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {tBty.dashboardOpenLiveLeaderboardCta}
              </button>
            </div>
          </ProgressCard>

          {/* Arena / Foundry / Center 통합 진입점 — 기존 dashboard 보강 */}
          <ProgressCard label={[tLanding.arenaTitle, tLanding.foundryTitle, tLanding.centerTitle].join(" · ")}>
            <div role="region" aria-label={locale === "ko" ? "Arena·Foundry·Center 진입점" : "Arena, Foundry, Center entry points"}>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>
              {locale === "ko" ? "Arena(플레이)·Foundry(대시·멘토·연습)·Center(나에게 쓰는 편지)로 바로 이동할 수 있어요." : "Jump to Arena (play), Foundry (dashboard, mentor, practice), or Center (letter to yourself)."}
            </p>
            <nav aria-label={locale === "ko" ? "Arena, Foundry, Center 빠른 이동" : "Quick access: Arena, Foundry, Center"} style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, opacity: 0.9 }}>{tLanding.arenaTitle}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link href={arenaPlayHref} className="bty-btn-primary" style={{ padding: "10px 16px", borderRadius: 10, background: "var(--arena-accent)", color: "white", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "아레나 플레이로 가기" : "Go to Arena play"}>
                    {tLanding.arenaCta}
                  </Link>
                  <Link href={`/${locale}/bty/leaderboard`} className="bty-btn-outline" style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--arena-accent)", color: "var(--arena-text)", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "주간 랭킹 보기" : "View weekly ranking"}>
                    {locale === "ko" ? "주간 랭킹" : "Weekly ranking"}
                  </Link>
                </div>
              </div>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, opacity: 0.9 }}>{tLanding.foundryTitle}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link href={`/${locale}/bty/profile`} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--arena-accent)", color: "var(--arena-text)", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "프로필 보기" : "View profile"}>
                    {locale === "ko" ? "프로필" : "Profile"}
                  </Link>
                  <Link href={`/${locale}/bty/elite`} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--arena-accent)", color: "var(--arena-text)", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "엘리트 페이지로" : "Go to Elite page"}>
                    {locale === "ko" ? "엘리트" : "Elite"}
                  </Link>
                  <Link href={`/${locale}/bty/integrity`} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--arena-accent)", color: "var(--arena-text)", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "역지사지 연습으로" : "Go to Integrity mirror"}>
                    {locale === "ko" ? "역지사지 연습" : "Integrity"}
                  </Link>
                  <Link href={`/${locale}/bty/dojo`} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--arena-accent)", color: "var(--arena-text)", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "Dojo 연습으로" : "Go to Dojo"}>
                    {locale === "ko" ? "Dojo" : "Dojo"}
                  </Link>
                </div>
              </div>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, opacity: 0.9 }}>{tLanding.centerTitle}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link href={`/${locale}/center`} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--arena-accent)", color: "var(--arena-text)", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "나에게 쓰는 편지로" : "Letter to yourself"}>
                    {tLanding.centerCta}
                  </Link>
                  <Link href={`/${locale}/assessment`} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--arena-accent)", color: "var(--arena-text)", textDecoration: "none", fontWeight: 600, fontSize: 13 }} aria-label={locale === "ko" ? "자존감 50문항 진단으로" : "50-item self-esteem assessment"}>
                    {locale === "ko" ? "자존감 50문항" : "Self-esteem (50)"}
                  </Link>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <Link href="#today-growth" style={{ fontSize: 13, fontWeight: 600, color: "var(--arena-accent)", textDecoration: "none" }} aria-label={locale === "ko" ? "오늘의 성장 섹션으로" : "Go to Today's growth section"}>
                  {tLanding.todayGrowthLink} →
                </Link>
              </div>
            </nav>
            </div>
          </ProgressCard>

          {/* [Q3] 추천 위젯 — recommendation 또는 DASHBOARD_RECOMMENDATION_EMPTY_PLACEHOLDER_KEY */}
          {!loading && (
            <ProgressCard label={tBty.recommendationLabel}>
              <div role="region" aria-label={locale === "ko" ? "대시보드 추천" : "Dashboard recommendation"}>
                {(() => {
                  const na = dashboardSummary?.recommendation?.nextAction;
                  const hasRec = na != null && String(na).trim() !== "";
                  if (!hasRec) {
                    return (
                      <p style={{ fontSize: 14, opacity: 0.9, margin: 0 }} role="status">
                        {dashboardRecommendationEmptyCopy(localeTyped)}
                      </p>
                    );
                  }
                  return null;
                })()}
                {dashboardSummary?.recommendation?.nextAction != null &&
                  String(dashboardSummary.recommendation.nextAction).trim() !== "" && (
                  <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                    {dashboardSummary.recommendation.nextAction}
                  </p>
                )}
                {dashboardSummary?.recommendation?.nextAction != null &&
                  String(dashboardSummary.recommendation.nextAction).trim() !== "" &&
                  dashboardSummary?.recommendation?.source === "arena" && (
                  <Link
                    href={arenaPlayHref}
                    style={{
                      display: "inline-block",
                      padding: "10px 16px",
                      borderRadius: 10,
                      background: "var(--arena-accent)",
                      color: "white",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                    aria-label={locale === "ko" ? "아레나 플레이로 가기" : "Go to Arena play"}
                  >
                    {locale === "ko" ? "Arena 플레이 →" : "Play Arena →"}
                  </Link>
                )}
                {dashboardSummary?.recommendation?.nextAction != null &&
                  String(dashboardSummary.recommendation.nextAction).trim() !== "" &&
                  dashboardSummary?.recommendation?.source === "foundry" && (
                  <Link
                    href={`/${locale}/bty/dashboard`}
                    style={{
                      display: "inline-block",
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "1px solid var(--arena-accent)",
                      color: "var(--arena-text)",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                    aria-label={locale === "ko" ? "Foundry 대시보드" : "Foundry dashboard"}
                  >
                    {locale === "ko" ? "Foundry →" : "Foundry →"}
                  </Link>
                )}
                {dashboardSummary?.recommendation?.nextAction != null &&
                  String(dashboardSummary.recommendation.nextAction).trim() !== "" &&
                  dashboardSummary?.recommendation?.source === "center" && (
                  <Link
                    href={`/${locale}/center`}
                    style={{
                      display: "inline-block",
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "1px solid var(--arena-accent)",
                      color: "var(--arena-text)",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                    aria-label={locale === "ko" ? "Center로" : "Go to Center"}
                  >
                    {locale === "ko" ? "Center →" : "Center →"}
                  </Link>
                )}
                {dashboardSummary?.recommendation?.nextAction != null &&
                  String(dashboardSummary.recommendation.nextAction).trim() !== "" &&
                  !dashboardSummary?.recommendation?.source && (
                  <Link
                    href={arenaPlayHref}
                    style={{
                      display: "inline-block",
                      padding: "10px 16px",
                      borderRadius: 10,
                      background: "var(--arena-accent)",
                      color: "white",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                    aria-label={locale === "ko" ? "아레나 플레이로 가기" : "Go to Arena play"}
                  >
                    {locale === "ko" ? "Arena 플레이 →" : "Play Arena →"}
                  </Link>
                )}
              </div>
            </ProgressCard>
          )}

          <div
            role="region"
            aria-label={locale === "ko" ? "대시보드 바로가기: 아레나, 랭킹, 프로필, 엘리트, 역지사지" : "Dashboard shortcuts: Arena, ranking, profile, Elite, Integrity"}
            style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}
          >
            <Link
              href={arenaPlayHref}
              className="bty-btn-primary"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: "var(--arena-accent)",
                color: "white",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
              aria-label={tBty.dashboardShortcutGoArena}
            >
              {tBty.dashboardShortcutGoArena}
            </Link>
            <Link
              href={`/${locale}/bty/leaderboard`}
              className="bty-btn-outline"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid var(--arena-accent)",
                color: "var(--arena-text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
              aria-label={tBty.dashboardShortcutWeeklyRanking}
            >
              {tBty.dashboardShortcutWeeklyRanking}
            </Link>
            <Link
              href={`/${locale}/bty/profile`}
              className="bty-btn-outline"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid var(--arena-accent)",
                color: "var(--arena-text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
              aria-label={locale === "ko" ? "프로필 보기" : "View profile"}
            >
              {locale === "ko" ? "프로필" : "Profile"}
            </Link>
            <Link
              href={`/${locale}/bty/elite`}
              className="bty-btn-outline"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid var(--arena-accent)",
                color: "var(--arena-text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
              aria-label={locale === "ko" ? "엘리트 페이지로" : "Go to Elite page"}
            >
              {locale === "ko" ? "엘리트" : "Elite"}
            </Link>
            <Link
              href={`/${locale}/bty/integrity`}
              className="bty-btn-outline"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid var(--arena-accent)",
                color: "var(--arena-text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
              aria-label={locale === "ko" ? "역지사지 연습으로" : "Go to Integrity mirror"}
            >
              {locale === "ko" ? "역지사지 연습" : "Integrity mirror"}
            </Link>
            <Link
              href={`/${locale}/center`}
              className="bty-btn-outline"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid var(--arena-accent)",
                color: "var(--arena-text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
              aria-label={locale === "ko" ? "나에게 쓰는 편지로" : "Letter to yourself (Center)"}
            >
              {locale === "ko" ? "나에게 쓰는 편지" : "Letter to yourself"}
            </Link>
            <Link
              href={`/${locale}/assessment`}
              className="bty-btn-outline"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid var(--arena-accent)",
                color: "var(--arena-text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
              aria-label={locale === "ko" ? "자존감 50문항 진단으로" : "Go to 50-item self-esteem assessment"}
            >
              {locale === "ko" ? "Dear Me 자존감 (50문항)" : "Dear Me self-esteem (50)"}
            </Link>
          </div>

          {/* Dojo 연습 플로우 2종 연동: 역지사지·Dear Me 자존감. render-only 링크. */}
          <ProgressCard label={tBty.dojoPracticeLabel}>
            <div role="region" aria-label={tBty.dojoPracticeLinksRegion}>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
              {locale === "ko"
                ? "역지사지 시뮬레이터와 자존감 50문항 진단을 연습할 수 있어요."
                : "Practice the integrity mirror and the 50-item self-esteem assessment."}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link
                href={`/${locale}/bty/integrity`}
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "var(--arena-accent)",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
                aria-label={locale === "ko" ? "역지사지 연습으로" : "Go to Integrity mirror"}
              >
                {locale === "ko" ? "역지사지 연습 →" : "Integrity mirror →"}
              </Link>
              <Link
                href={`/${locale}/assessment`}
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--arena-accent)",
                  color: "var(--arena-text)",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
                aria-label={locale === "ko" ? "Dear Me 자존감 50문항 진단으로" : "Go to Dear Me 50-item self-esteem assessment"}
              >
                {locale === "ko" ? "Dear Me 자존감 (50문항) →" : "Dear Me self-esteem (50) →"}
              </Link>
            </div>
            </div>
          </ProgressCard>

          <ProgressCard label={tArenaMembership.label}>
            {membershipRequest?.status === "approved" ? (
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                <div style={{ fontWeight: 700 }}>{tArenaMembership.approved}</div>
              </div>
            ) : membershipRequest?.status === "pending" ? (
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                {tArenaMembership.pending}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                  {tArenaMembership.hint}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>{tArenaMembership.jobFunction}</label>
                    <select
                      value={membershipForm.job_function}
                      onChange={(e) => setMembershipForm((f) => ({ ...f, job_function: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                    >
                      <option value="assistant">Assistant</option>
                      <option value="admin">Admin</option>
                      <option value="junior_doctor">Junior Doctor</option>
                      <option value="hygienist">Hygienist</option>
                      <option value="doctor">Doctor</option>
                      <option value="senior_doctor">Senior Doctor</option>
                      <option value="partner">Partner</option>
                      <option value="office_manager">Office Manager</option>
                      <option value="regional_om">Regional OM</option>
                      <option value="director">Director</option>
                      <option value="dso">DSO</option>
                    </select>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                      {tArenaMembership.seniorDoctorHint}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>{tArenaMembership.joinedAt}</label>
                    <input
                      type="date"
                      min="2007-01-01"
                      value={membershipForm.joined_at}
                      onChange={(e) => setMembershipForm((f) => ({ ...f, joined_at: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>{tArenaMembership.leaderStartedAt}</label>
                    <input
                      type="date"
                      min="2007-01-01"
                      value={membershipForm.leader_started_at}
                      onChange={(e) => setMembershipForm((f) => ({ ...f, leader_started_at: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>
                  {membershipSubmitMsg && (
                    <div style={{ fontSize: 13, color: membershipSubmitMsg === tArenaMembership.submitSuccess ? "#0a0" : "#c00" }}>
                      {membershipSubmitMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={submitMembershipRequest}
                    disabled={membershipSubmitting}
                    aria-label={membershipSubmitting ? tArenaMembership.submitting : tArenaMembership.submit}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#111",
                      color: "white",
                      fontWeight: 600,
                      cursor: membershipSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {membershipSubmitting ? tArenaMembership.submitting : tArenaMembership.submit}
                  </button>
                  {membershipSubmitting && (
                    <div style={{ marginTop: 12 }}>
                      <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </ProgressCard>

          {(league || core?.seasonalXpTotal != null || weekly?.xpTotal != null || weekly?.count != null) && (
            <ProgressCard label="Season Progress">
              <div role="region" aria-label={locale === "ko" ? "시즌 진행" : "Season progress"}>
              {league && (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{league.name ?? "Arena"}</div>
                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                    {league.start_at ? new Date(league.start_at).toLocaleDateString() : ""}
                    {" → "}
                    {league.end_at ? new Date(league.end_at).toLocaleDateString() : ""}
                  </div>
                </>
              )}
              <div role="group" aria-label={tBty.weeklySeasonActivityAria}>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: league ? 10 : 0 }}>
                {core?.seasonalXpTotal ?? weekly?.xpTotal ?? 0}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Seasonal XP</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Events counted: {weekly?.count ?? 0}</div>
              {weekly?.weekStartISO != null && weekly?.weekEndISO != null && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                  {String(weekly.weekStartISO).slice(0, 10)} → {String(weekly.weekEndISO).slice(0, 10)}
                </div>
              )}
              </div>
              </div>
            </ProgressCard>
          )}

          <ProgressCard label={tBty.lifetimeProgressLabel}>
            <div role="region" aria-label={tBty.lifetimeProgressLabel} style={{ display: "block" }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{core?.coreXpTotal ?? 0}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Permanent. Drives Code Name.</div>
            {core?.stage != null && core?.progressPct != null && (
              <>
                <ProgressVisual
                  stage={core.stage}
                  progressPct={core.progressPct}
                  nextMilestoneLabel={
                    core.nextCodeName != null && core.xpToNext != null
                      ? `${core.xpToNext} XP to ${core.nextCodeName}`
                      : core.xpToNext != null
                        ? `${core.xpToNext} XP to next phase`
                        : undefined
                  }
                />
                {core.codeLore != null && core.codeLore !== "" && (
                  <div style={{ marginTop: 4, fontSize: 12, fontStyle: "italic", opacity: 0.75 }}>{core.codeLore}</div>
                )}
              </>
            )}
            </div>
          </ProgressCard>

          <ProgressCard label={tBty.dashboardTierCardLabel}>
            <div role="region" aria-label={tBty.dashboardTierCardRegionAria} style={{ display: "block" }}>
              <div style={{ fontSize: 28, fontWeight: 800 }} aria-live="polite">
                {typeof core?.tier === "number" ? core.tier : "—"}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{tBty.dashboardTierCardSubline}</div>
            </div>
          </ProgressCard>

          <ProgressCard label={tBty.pointsTodayLabel}>
            <div role="region" aria-label={tBty.pointsTodayLabel} style={{ display: "block" }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{xpToday}</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{tBty.pointsTodaySubline}</div>
            </div>
          </ProgressCard>

          {/* [Q3] LE·AIR 요약 랜드마크 — TASK: 접근성 1곳 */}
          <section aria-label={tBty.leAirSummarySectionAria} style={{ display: "contents" }}>
          {/* [Q3] AIR 위젯 — LeAirWidget: API 스냅샷만 표시 */}
          <ProgressCard label={tBty.airLabel}>
            <LeAirWidget
              data={leAir}
              dashboardLoading={loading}
              labels={{
                regionMain: locale === "ko" ? "AIR 지표" : "AIR metrics",
                regionGrid: tBty.leAirAriaGrid,
                region7d: tBty.leAirAria7d,
                region14d: tBty.leAirAria14d,
                region90d: tBty.leAirAria90d,
                period7d: "7d",
                period14d: "14d",
                period90d: "90d",
                integritySlip: tBty.airIntegritySlip,
                airUnavailable: tBty.airUnavailable,
                airLoading: tBty.leAirLoading,
              }}
            />
          </ProgressCard>

          {/* [Q3] LE Stage 위젯 — LeStageWidget: stage-summary API만 표시 */}
          <ProgressCard label={tBty.leStageLabel}>
            <div aria-describedby="le-stage-summary-desc">
              <p id="le-stage-summary-desc" className="sr-only">
                {tBty.leStageSummaryWidgetDesc}
              </p>
              <LeStageWidget
                data={leStageSummary}
                dashboardLoading={loading}
                locale={locale}
                labels={{
                  regionAria: tBty.leStageSummarySectionAria,
                  stageLabel: tBty.leStageStagePrefix,
                  resetDueLabel: tBty.leStageResetDueLabel,
                  arenaSummaryLabel: tBty.leStageArenaSummaryHeading,
                  behaviorPatternLabel: tBty.leStageBehaviorHeading,
                  unavailable: tBty.leStageSummaryUnavailable,
                  loadingStatus: tBty.leStageLoading,
                  leProgressBarAria: tBty.leStageLeProgressBarAria,
                }}
              />
            </div>
          </ProgressCard>
          </section>

          <ProgressCard label={locale === "ko" ? "Leadership Engine" : "Leadership Engine"}>
            {leState == null && leAir == null && leTii == null && leCertified == null ? (
              <div role="region" aria-label={locale === "ko" ? "리더십 엔진 상태" : "Leadership Engine state"} aria-busy="true">
                <CardSkeleton showLabel={false} lines={3} />
              </div>
            ) : (
              <div role="region" aria-label={locale === "ko" ? "리더십 엔진 상태·TII·인증" : "Leadership Engine state, TII and Certified"}>
                {leState != null && (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{leState.stageName}</div>
                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                      {locale === "ko" ? "Stage" : "Stage"} {leState.currentStage}
                    </div>
                    {leState.resetDueAt != null && (
                      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                        {locale === "ko" ? "Reset 완료 기한" : "Reset due"}:{" "}
                        {new Date(leState.resetDueAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                  </>
                )}
                {(leAir != null || (leTii != null && leTii.tii != null) || leCertified != null) && (
                <div role="group" aria-label={tBty.leEngineTiiCertifiedBandAria}>
                {leAir != null && (
                  <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                    <span style={{ fontWeight: 600 }}>AIR</span> 7d: {(leAir.air_7d.air * 100).toFixed(0)}%
                    {leAir.air_7d.integritySlip && (
                      <span style={{ marginLeft: 8, color: "var(--arena-accent)" }}>
                        {locale === "ko" ? "·integrity slip" : "·integrity slip"}
                      </span>
                    )}
                    {" · "}
                    14d: {(leAir.air_14d.air * 100).toFixed(0)}% · 90d: {(leAir.air_90d.air * 100).toFixed(0)}%
                  </div>
                )}
                {leTii != null && leTii.tii != null && (
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                    <span style={{ fontWeight: 600 }}>{locale === "ko" ? "팀 TII" : "Team TII"}</span>: {(Number(leTii.tii) * 100).toFixed(1)}%
                  </div>
                )}
                {leCertified != null && (
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                    <span style={{ fontWeight: 600 }}>Certified</span>: {leCertified.current ? (locale === "ko" ? "예" : "Yes") : (locale === "ko" ? "아니오" : "No")}
                    {leCertified.reasons_missing.length > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.8 }}>
                        ({leCertified.reasons_missing.join(", ")})
                      </span>
                    )}
                  </div>
                )}
                </div>
                )}
              </div>
            )}
          </ProgressCard>

          {SHOW_ARENA_LEVELS && (
            <ProgressCard label="ARENA LEVELS">
              {unlockedScenarios?.error === "UNAUTHENTICATED" ? (
                <div style={{ fontSize: 14, opacity: 0.9 }}>{tArenaLevels.loginRequired}</div>
              ) : (
                <ArenaLevelsCard
                  track={unlockedScenarios?.track ?? "staff"}
                  maxUnlockedLevel={unlockedScenarios?.maxUnlockedLevel ?? null}
                  levels={unlockedScenarios?.levels ?? []}
                  l4Access={unlockedScenarios?.l4_access === true}
                  membershipPending={unlockedScenarios?.membershipPending === true}
                  locale={locale}
                  emptyCta={
                    <Link
                      href={arenaPlayHref}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 10,
                        background: "var(--arena-accent)",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                      aria-label={locale === "ko" ? "Arena에서 시나리오 시작하기" : "Start a scenario in Arena"}
                    >
                      {getMessages(localeTyped).arenaLevels.emptyCta}
                    </Link>
                  }
                />
              )}
            </ProgressCard>
          )}

          <ProgressCard label={locale === "ko" ? "Leadership Lab" : "Leadership Lab"}>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
              {locale === "ko" ? "오늘 하루 3회까지 시나리오 완료 시 Core XP 지급. 남은 횟수 확인 →" : "Up to 3 scenario completions per day for Core XP. Check remaining →"}
            </p>
            <Link
              href={`/${locale}/bty-arena/lab`}
              style={{ display: "inline-block", marginTop: 8, fontSize: 14, fontWeight: 600, color: "var(--arena-accent)", textDecoration: "none" }}
              aria-label={locale === "ko" ? "Leadership Lab 페이지로" : "Go to Leadership Lab"}
            >
              {locale === "ko" ? "Lab 페이지로 이동" : "Go to Lab"}
            </Link>
          </ProgressCard>

          {/* PHASE_4_ELITE_5_PERCENT_SPEC §9·ELITE_4TH 해금 확장: Elite 5% 해금 조건·노출. isElite from GET /api/me/elite only; no XP/rank computation in UI. */}
          <ProgressCard label={locale === "ko" ? "Elite 전용 콘텐츠" : "Elite-only content"}>
            {eliteContentUnlocked !== null && (
              <p style={{ fontSize: 12, opacity: 0.88, marginBottom: 10 }}>
                <strong>{tBty.eliteMeContentUnlockedLabel}:</strong>{" "}
                {eliteContentUnlocked
                  ? tBty.eliteMeContentUnlockedYes
                  : tBty.eliteMeContentUnlockedNo}
              </p>
            )}
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: isElite && eliteBadges.length > 0 ? 12 : 8 }}>
              <strong>{tElitePage.unlockConditionTitle}:</strong>{" "}
              {isElite ? tElitePage.unlockConditionMet : tElitePage.unlockConditionLocked}
            </div>
            {isElite ? (
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {locale === "ko" ? "상위 5%에만 열리는 콘텐츠입니다." : "Content for top 5% only."}
                </div>
                {eliteBadges.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.9 }}>
                      {locale === "ko" ? "증정 배지" : "Badges"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {eliteBadges.map((b) => (
                        <span
                          key={b.kind}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "rgba(0,0,0,0.06)",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {tElitePage.badgeLabels?.[b.labelKey] ?? b.labelKey}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <Link
                  href={`/${locale}/bty/elite`}
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: "#111",
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                  aria-label={locale === "ko" ? "Elite 전용 페이지로 이동" : "Go to Elite page"}
                >
                  {locale === "ko" ? "Elite 전용 페이지로 이동 →" : "Go to Elite page →"}
                </Link>
              </div>
            ) : (
              <div style={{ fontSize: 14, opacity: 0.85 }}>
                <strong>{tElitePage.unlockExposureTitle}:</strong> {tElitePage.unlockExposureLocked}
              </div>
            )}
          </ProgressCard>

          <section id="today-growth" aria-label={locale === "ko" ? "오늘의 성장" : "Today's growth"}>
            <EmotionalStatsPhrases />
          </section>

          <ProgressCard label={tBty.profileCodeNameCardLabel}>
            {/* COMMANDER_BACKLOG §5: 마우스 오버 시 단계·수준 설명 툴팁. 문구 = BTY_ARENA_SYSTEM_SPEC·ARENA_CODENAME_AVATAR_PLAN Code/Tier/Sub Name 규칙 요약 */}
            <div
              className="group relative inline-block cursor-help"
              title={locale === "ko" ? "Code·Tier·Sub Name 규칙 요약 (마우스 오버 시 자세히)" : "Code · Tier · Sub Name rules summary (hover for details)"}
            >
              <div
                className="font-extrabold text-lg outline-none rounded focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[var(--arena-accent)]"
                style={{ fontWeight: 800, fontSize: 18 }}
                tabIndex={0}
                aria-describedby="dashboard-codename-tooltip"
              >
                {core?.codeName ?? "FORGE"} · {core?.subName ?? "Spark"}
              </div>
              <div
                id="dashboard-codename-tooltip"
                role="tooltip"
                className="absolute left-0 bottom-full z-10 mb-2 hidden w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--arena-text-soft)]/30 bg-[var(--arena-bg)] px-3 py-2.5 text-left text-sm shadow-lg group-hover:block group-focus-within:block"
                style={{ color: "var(--arena-text)" }}
              >
                {locale === "ko" ? (
                  <>
                    <p className="font-semibold mb-1.5">Code · Tier · Sub Name 규칙 요약</p>
                    <p className="mb-1.5">
                      <strong>Code</strong>: 7단계 (FORGE → PULSE → FRAME → ASCEND → NOVA → ARCHITECT → CODELESS ZONE). 1 Code = 100 Tier. Tier = Core XP ÷ 10 (숫자 비공개, 25/50/75 도달 시 축하로만 인지). BTY_ARENA_SYSTEM_SPEC §1.
                    </p>
                    <p className="mb-1.5">
                      <strong>Sub Name</strong>: 각 Code마다 Tier 4구간(0–24, 25–49, 50–74, 75–99)별 기본 이름. 제품 규칙: 「코드가 바뀌고 25 tier가 되면, 그 코드에서 1회만 설정할 수 있다」 (최대 7자). 리네임 기회는 Tier 25+·코드당 미사용 시; 일부 구현에서는 주간 리더보드 상위 5%(Elite)일 때 부여. CODELESS ZONE은 고정 이름 없이 언제든 설정. ARENA_CODENAME_AVATAR_PLAN §2.
                    </p>
                    <p className="text-xs opacity-85">BTY_ARENA_SYSTEM_SPEC · ARENA_CODENAME_AVATAR_PLAN</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold mb-1.5">Code · Tier · Sub Name — rules summary</p>
                    <p className="mb-1.5">
                      <strong>Code</strong>: 7 stages (FORGE → PULSE → FRAME → ASCEND → NOVA → ARCHITECT → CODELESS ZONE). 1 Code = 100 Tier. Tier = Core XP ÷ 10 (number hidden; tier rise only at 25/50/75 celebrations). BTY_ARENA_SYSTEM_SPEC §1.
                    </p>
                    <p className="mb-1.5">
                      <strong>Sub Name</strong>: Each Code has 4 tier bands (0–24, 25–49, 50–74, 75–99) with default names. Rule: “When your Code changes and you reach Tier 25, you may set a custom name once per Code” (max 7 chars). Rename opportunity when Tier 25+ and not yet used in that Code; some implementations grant it at top 5% weekly leaderboard (Elite). CODELESS ZONE: set anytime. ARENA_CODENAME_AVATAR_PLAN §2.
                    </p>
                    <p className="text-xs opacity-85">BTY_ARENA_SYSTEM_SPEC · ARENA_CODENAME_AVATAR_PLAN</p>
                  </>
                )}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              {tBty.profileIdentitySubline}
            </div>
            {core?.subNameRenameAvailable && (
              <div style={{ marginTop: 12 }}>
                <input
                  value={subNameDraft}
                  onChange={(e) => setSubNameDraft(e.target.value.slice(0, 7))}
                  placeholder={tBty.profileRenamePlaceholder}
                  maxLength={7}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", marginRight: 8 }}
                />
                <button
                  type="button"
                  onClick={saveSubName}
                  disabled={subNameSaving || subNameDraft.trim().length === 0}
                  aria-label={subNameSaving ? tBty.profileSaving : tBty.profileSaveSubName}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "#111",
                    color: "white",
                    cursor: subNameSaving || subNameDraft.trim().length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {subNameSaving ? tBty.profileSaving : tBty.profileSaveSubName}
                </button>
                {subNameSaving && (
                  <div style={{ marginTop: 12 }}>
                    <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
                  </div>
                )}
              </div>
            )}
          </ProgressCard>

          <ProgressCard label={tAvatarOutfit.pageTitle}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              {/* 왼쪽: 선택한 캐릭터 아바타 + 악세사리 */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {avatarLayers?.characterImageUrl ? (
                  <AvatarComposite
                    size={40}
                    characterUrl={avatarLayers.characterImageUrl}
                    outfitUrl={avatarLayers.outfitImageUrl ?? undefined}
                    accessoryUrls={avatarAccessoryUrls}
                    alt=""
                  />
                ) : (
                  <UserAvatar avatarUrl={displayAvatarUrl} initials={core?.codeName?.slice(0, 2)} alt="" size="md" />
                )}
                {core?.currentOutfit?.accessoryIds && core.currentOutfit.accessoryIds.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                        justifyContent: "center",
                      }}
                      aria-label="Current level accessories"
                    >
                      {core.currentOutfit.accessoryIds.map((id, i) => (
                        <img
                          key={`${id}-${i}`}
                          src={getAccessoryImageUrl(id)}
                          alt={core.currentOutfit!.accessoryLabels[i] ?? id}
                          title={core.currentOutfit!.accessoryLabels[i] ?? id}
                          style={{
                            width: 24,
                            height: 24,
                            objectFit: "contain",
                            display: "block",
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: "#666" }}>{tAvatarOutfit.currentLevelAccessories}</span>
                  </div>
                )}
                {core?.currentOutfit && (
                  <div style={{ fontSize: 11, opacity: 0.9, textAlign: "center", maxWidth: 140 }}>
                    <span style={{ fontWeight: 600 }}>{tAvatarOutfit.currentOutfitPrefix}</span> {core.currentOutfit.outfitLabel}
                  </div>
                )}
              </div>
              {/* 오른쪽: 캐릭터 그리드(잠금 시에도 전체 노출, 선택만 비활성) + 옷 */}
              <div style={{ flex: 1, minWidth: 200 }}>
                {(() => {
                  const characterLocked = core?.avatarCharacterLocked === true;
                  const visibleCharacters = getVisibleAvatarCharacters(core?.coreXpTotal ?? 0);
                  return (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                        {characterLocked ? tAvatarOutfit.character : tAvatarOutfit.pickCharacterTitle}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                        {characterLocked
                          ? tAvatarOutfit.dashboardCharacterLockedGridHint
                          : locale === "ko"
                            ? "한 번 저장하면 변경할 수 없습니다."
                            : "Cannot be changed after first save."}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          opacity: characterLocked ? 0.95 : 1,
                        }}
                        aria-label={
                          locale === "ko" ? "캐릭터 선택" : "Character selection"
                        }
                      >
                        {visibleCharacters.map((ch) => {
                          const selected = core?.avatarCharacterId === ch.id;
                          const thumbMissing = characterThumbFailed[ch.id] === true;
                          const selectDisabled = characterLocked || avatarCharacterSaving;
                          return (
                            <button
                              key={ch.id}
                              type="button"
                              disabled={selectDisabled}
                              onClick={() => {
                                if (selectDisabled) return;
                                selectAvatarCharacter(selected ? null : ch.id);
                              }}
                              style={{
                                padding: 8,
                                borderRadius: 12,
                                border: selected ? "2px solid #111" : "1px solid #ddd",
                                background: selected ? "#f5f5f5" : "transparent",
                                cursor: selectDisabled ? "not-allowed" : "pointer",
                                opacity: selectDisabled ? 0.75 : 1,
                              }}
                              title={ch.label}
                              aria-label={
                                locale === "ko"
                                  ? selected
                                    ? `${ch.label}, 선택됨`
                                    : ch.label
                                  : selected
                                    ? `${ch.label}, selected`
                                    : ch.label
                              }
                            >
                              <div
                                style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 8,
                                  background: "#e8e8e8",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 18,
                                  fontWeight: 700,
                                  position: "relative",
                                  overflow: "hidden",
                                  color: "#444",
                                }}
                              >
                                {thumbMissing ? (
                                  <span aria-hidden>{ch.label.slice(0, 1)}</span>
                                ) : (
                                  <>
                                    <span
                                      style={{
                                        position: "absolute",
                                        zIndex: 0,
                                        opacity: 0.35,
                                        userSelect: "none",
                                      }}
                                      aria-hidden
                                    >
                                      {ch.label.slice(0, 1)}
                                    </span>
                                    <img
                                      src={getCharacterThumbImageUrl(ch.id)}
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                      style={{
                                        position: "absolute",
                                        inset: 0,
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        zIndex: 1,
                                      }}
                                      onError={() =>
                                        setCharacterThumbFailed((prev) => ({ ...prev, [ch.id]: true }))
                                      }
                                    />
                                  </>
                                )}
                              </div>
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 11,
                                  fontWeight: selected ? 700 : 500,
                                  maxWidth: 72,
                                  textAlign: "center",
                                  lineHeight: 1.2,
                                }}
                              >
                                {ch.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{tAvatarOutfit.outfit}</div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      {locale === "ko" ? "선택한 옷" : "Selected outfit"}
                    </label>
                    <select
                      value={core?.avatarSelectedOutfitId ?? ""}
                      onChange={(e) => saveAvatarSelectedOutfit(e.target.value || null)}
                      disabled={avatarSelectedOutfitSaving}
                      aria-label={locale === "ko" ? "선택한 옷" : "Selected outfit"}
                      style={{
                        width: "100%",
                        maxWidth: 280,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        fontSize: 13,
                      }}
                    >
                      <option value="">
                        {locale === "ko" ? "레벨 기본값" : "Level default"}
                      </option>
                      {OUTFIT_OPTIONS_ALL.map((opt) => (
                        <option key={opt.outfitId} value={opt.outfitId}>
                          {opt.outfitLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{tAvatarOutfit.hint}</div>
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
                    {locale === "ko"
                      ? "Tier 25, 50, 75…마다 악세사리 선택 + 랜덤 보너스 (준비 중)"
                      : "Accessory selection + random bonus every 25 tiers (coming soon)."}
                  </div>
                  {avatarPrefsSavedAt != null && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                      저장됨
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ProgressCard>

          <ProgressCard label={tBty.streakLabel}>
            <div role="region" aria-label={tBty.streakLabel} style={{ fontSize: 28, fontWeight: 800 }}>{streak}</div>
          </ProgressCard>

          {weeklyStats && (
            <ProgressCard label="Weekly Reflection">
              <div role="region" aria-label={tBty.weeklyReflectionRegion} style={{ fontSize: 18, fontWeight: 700 }}>
                {weeklyStats.reflectionCount} / {weeklyStats.reflectionTarget} reflections this week
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                {weeklyStats.reflectionQuestClaimed
                  ? "Quest complete! +15 Seasonal XP claimed."
                  : "Complete 3 reflections in a week (Mon–Sun UTC) to earn +15 Seasonal XP once."}
              </div>
            </ProgressCard>
          )}

          {weeklyStats && (
            <ProgressCard label="Personal Record">
            <div role="region" aria-label={tBty.personalRecordRegion} style={{ fontSize: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>
                <b>Best day this week</b> {typeof weeklyStats?.weekMaxDailyXp === "number" ? `${weeklyStats.weekMaxDailyXp} XP` : "—"}
              </span>
              <span>
                <b>Streak</b> {streak} day{streak !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Your growth, not compared to others.</div>
            </ProgressCard>
          )}
        </div>
      )}

      {milestoneModal && (
        <TierMilestoneModal
          milestone={milestoneModal.milestone}
          subName={milestoneModal.subName}
          previousSubName={milestoneModal.previousSubName}
          subNameRenameAvailable={milestoneModal.subNameRenameAvailable}
          onRename={
            milestoneModal.subNameRenameAvailable
              ? async (name: string) => {
                  await arenaFetch("/api/arena/sub-name", { json: { subName: name } });
                  const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => null);
                  if (next) setCore(next);
                }
              : undefined
          }
          onClose={() => setMilestoneModal(null)}
        />
      )}

      {liveLbOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            padding: 16,
          }}
          role="presentation"
          onClick={() => setLiveLbOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tBty.dashboardLiveLeaderboardModalAria}
            aria-describedby="dashboard-live-lb-desc"
            style={{
              maxHeight: "85vh",
              width: "100%",
              maxWidth: 440,
              overflow: "hidden",
              borderRadius: 16,
              background: "var(--arena-bg, #fff)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                padding: "12px 16px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{tBty.dashboardLiveLeaderboardModalTitle}</h2>
              <button
                type="button"
                onClick={() => setLiveLbOpen(false)}
                aria-label={tBty.dashboardLiveLeaderboardCloseAria}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--arena-accent)",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {tBty.dashboardLiveLeaderboardClose}
              </button>
            </div>
            <p
              id="dashboard-live-lb-desc"
              style={{ margin: 0, padding: "8px 16px 0", fontSize: 12, opacity: 0.78, lineHeight: 1.45 }}
            >
              {tBty.dashboardLiveLeaderboardModalDesc}
            </p>
            <div style={{ maxHeight: "55vh", overflowY: "auto", padding: 12 }}>
              {liveLbLoading && (
                <p
                  style={{ margin: 0, fontSize: 14, opacity: 0.75 }}
                  role="status"
                  aria-busy="true"
                  aria-live="polite"
                >
                  {tBty.dashboardLiveLeaderboardLoading}
                </p>
              )}
              {liveLbErr && !liveLbLoading && (
                <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }} role="alert">
                  {liveLbErr}
                </p>
              )}
              {!liveLbLoading && !liveLbErr && liveLbRows.length === 0 && (
                <p style={{ margin: 0, fontSize: 14, opacity: 0.75 }} role="status">
                  {tBty.dashboardLiveLeaderboardEmpty}
                </p>
              )}
              {!liveLbLoading && !liveLbErr && liveLbNearMeFallback && (
                <p style={{ margin: "0 0 10px 0", fontSize: 13, opacity: 0.85 }} role="status">
                  {tBty.dashboardLiveLeaderboardNearMeFallbackBanner}
                </p>
              )}
              {!liveLbLoading && !liveLbErr && liveLbNotRankedBanner && (
                <p style={{ margin: "0 0 10px 0", fontSize: 13, opacity: 0.85 }} role="status">
                  {tBty.dashboardLiveLeaderboardNotRankedBanner}
                </p>
              )}
              {!liveLbLoading && !liveLbErr && liveLbRows.length > 0 && (
                <div role="list" aria-label={tBty.dashboardLiveLeaderboardListAria}>
                  {liveLbRows.map((r, i) => {
                    const tieKey = leaderboardTieRankSuffixDisplayKey(
                      i > 0 && r.xpTotal === liveLbRows[i - 1]!.xpTotal
                    );
                    const tieSuffix =
                      tieKey != null
                        ? arenaStableLabel(localeTyped, "arena.leaderboard.tieRankSuffix")
                        : null;
                    return (
                    <div key={`${r.rank}-${r.codeName}-${i}`} role="listitem">
                      <LeaderboardRow
                        rank={r.rank}
                        codeName={r.codeName}
                        subName={r.subName}
                        weeklyXp={r.xpTotal}
                        avatarUrl={r.avatarUrl}
                        avatarLayers={r.avatarLayers}
                        tier={r.tier}
                        locale={locale}
                        tieRankSuffix={tieSuffix}
                      />
                    </div>
                  );})}
                </div>
              )}
            </div>
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", padding: "12px 16px" }}>
              <Link
                href={`/${locale}/bty/leaderboard`}
                onClick={() => setLiveLbOpen(false)}
                style={{
                  display: "inline-block",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--arena-accent)",
                  textDecoration: "none",
                }}
              >
                {tBty.dashboardLiveLeaderboardFullPage} →
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
  return content;
}
