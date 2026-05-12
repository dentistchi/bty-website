"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { InfoCard } from "@/components/bty/ui/InfoCard";
import { PrimaryButton } from "@/components/bty/ui/PrimaryButton";
import { SecondaryButton } from "@/components/bty/ui/SecondaryButton";
import { TierMilestoneModal, UserAvatar, AvatarComposite, CardSkeleton } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getMessages, weeklyCompetitionStageBandCopy, type Locale } from "@/lib/i18n";
import { weeklyCompetitionStageTierBandDisplayLabelKey } from "@/domain/rules/weeklyCompetitionDisplay";
import { calculateTier } from "@/domain/rules/weeklyXp";
import { getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";
import { getAccessoryImageUrl } from "@/lib/bty/arena/avatarOutfits";
import { useArenaEntryResolution } from "@/lib/bty/arena/useArenaEntryResolution";

type WeeklyXpRes = { weekStartISO?: string | null; weekEndISO?: string | null; xpTotal: number; count?: number };
type CoreXpRes = {
  coreXpTotal: number;
  tier?: number;
  codeName: string;
  subName: string;
  seasonalXpTotal: number;
  codeHidden?: boolean;
  subNameRenameAvailable?: boolean;
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

type StageSummaryRes = {
  currentStage: 1 | 2 | 3 | 4;
  stageName: string;
  progressPercent: number;
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
  arenaSummary: string | Record<string, unknown> | null;
  behaviorPattern: string | Record<string, unknown> | null;
};

type DashboardSummaryRes = {
  progress?: { currentStage?: number; stageName?: string; progressPercent?: number };
  recommendation?: { nextAction?: string | null; source?: string | null; priority?: number | null };
};

const STREAK_KEY = "btyArenaStreak:v1";

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
  const { contract: arenaEntry } = useArenaEntryResolution(locale === "ko" ? "ko" : "en");
  const arenaPlayHref = arenaEntry.href;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
  const [isElite, setIsElite] = React.useState<boolean | null>(null);
  const [eliteBadges, setEliteBadges] = React.useState<Array<{ kind: string; labelKey: string }>>([]);
  const [eliteContentUnlocked, setEliteContentUnlocked] = React.useState<boolean | null>(null);
  const [leStageSummary, setLeStageSummary] = React.useState<StageSummaryRes | null>(null);
  const [dashboardSummary, setDashboardSummary] = React.useState<DashboardSummaryRes | null>(null);

  const dashboardMountedRef = React.useRef(true);
  React.useEffect(() => {
    dashboardMountedRef.current = true;
    return () => {
      dashboardMountedRef.current = false;
    };
  }, []);

  const reloadDashboard = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      setStreak(readLocalStreak());

      const w = await arenaFetch<WeeklyXpRes>("/api/arena/weekly-xp").catch(
        () => ({ xpTotal: 0 } as WeeklyXpRes),
      );

      const fallbackCore: CoreXpRes = {
        coreXpTotal: 0,
        codeName: "FORGE",
        subName: "Spark",
        seasonalXpTotal: 0,
      };
      const [c, leagueRes, todayRes, statsRes, unlockedRes, membershipRes, eliteRes, stageSummaryRes, dashboardSummaryRes] = await Promise.all([
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
        arenaFetch<StageSummaryRes>("/api/arena/leadership-engine/stage-summary").catch(() => null),
        arenaFetch<DashboardSummaryRes>("/api/arena/dashboard/summary").catch(() => null),
      ]);

      if (!dashboardMountedRef.current) return;
      setWeekly(w);
      setCore(c);
      if (!silent && c?.milestoneToCelebrate != null) {
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
        eliteRes && "eliteFetchFailed" in eliteRes && eliteRes.eliteFetchFailed,
      );
      if (eliteFailed) {
        setEliteContentUnlocked(null);
      } else {
        const ok = eliteRes as { eliteContentUnlocked?: boolean };
        setEliteContentUnlocked(
          typeof ok.eliteContentUnlocked === "boolean" ? ok.eliteContentUnlocked : null,
        );
      }
      if (stageSummaryRes) setLeStageSummary(stageSummaryRes);
      if (dashboardSummaryRes) setDashboardSummary(dashboardSummaryRes);
    } catch (e) {
      if (!dashboardMountedRef.current) return;
      if (!silent) setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (!dashboardMountedRef.current) return;
      if (!silent) setLoading(false);
    }
  }, [locale]);

  React.useEffect(() => {
    void reloadDashboard();
  }, [reloadDashboard]);

  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void reloadDashboard({ silent: true });
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void reloadDashboard({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [reloadDashboard]);

  const localeTyped = (locale === "ko" ? "ko" : "en") as Locale;
  const tBty = getMessages(localeTyped).bty;
  const tMembership = getMessages(localeTyped).arenaMembership;

  const displayAvatarUrl =
    core?.avatarUrl ?? getAvatarCharacter(core?.avatarCharacterId)?.imageUrl ?? null;
  const dashboardResolvedAvatar = React.useMemo(() => {
    if (!core) return null;
    const characterUrl =
      typeof core.avatarCharacterImageUrl === "string" && core.avatarCharacterImageUrl.trim() !== ""
        ? core.avatarCharacterImageUrl.trim()
        : null;
    const outfitUrl =
      typeof core.avatarOutfitImageUrl === "string" && core.avatarOutfitImageUrl.trim() !== ""
        ? core.avatarOutfitImageUrl.trim()
        : null;
    const accessoryUrls = (core.currentOutfit?.accessoryIds ?? [])
      .map((id) => getAccessoryImageUrl(id))
      .filter((u): u is string => typeof u === "string" && u.trim() !== "");
    return { characterUrl, outfitUrl, accessoryUrls };
  }, [core]);

  const weeklyBandCopy = React.useMemo(() => {
    if (!weekly) return null;
    const tier = calculateTier(weekly.xpTotal);
    const key = weeklyCompetitionStageTierBandDisplayLabelKey(tier);
    return weeklyCompetitionStageBandCopy(localeTyped, key);
  }, [weekly, localeTyped]);

  const identityTitle = locale === "ko" ? "정체성" : "Identity";
  const progressTitle = locale === "ko" ? "진행" : "Progress";
  const teamTitle = locale === "ko" ? "팀" : "Team";

  const teamNarrative = React.useMemo(() => {
    if (!membershipRequest) {
      return locale === "ko"
        ? "멤버십 요청을 시작하거나 팀 상태는 팀 화면에서 확인하세요."
        : "Start a membership request or review team status on the Team page.";
    }
    if (membershipRequest.status === "pending") {
      return locale === "ko" ? "멤버십 검토 중입니다." : "Membership request is pending review.";
    }
    return locale === "ko" ? "팀 멤버십이 승인되었습니다." : "Your team membership is approved.";
  }, [membershipRequest, locale]);

  return (
    <>
      <ScreenShell
        locale={locale}
        eyebrow="bty"
        title={tBty.dashboardPageTitle}
        subtitle={tBty.dashboardHeroSubtitle}
        fullWidth
        contentClassName="pb-28 px-4"
        mainAriaLabel={tBty.dashboardMainRegionAria}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {loading && (
            <>
              <InfoCard title={progressTitle}>
                <div role="status" aria-busy="true" aria-live="polite" aria-label={tBty.dashboardWeeklyWidgetLoading}>
                  <CardSkeleton lines={2} />
                </div>
              </InfoCard>
              <CardSkeleton lines={2} />
              <CardSkeleton lines={2} />
            </>
          )}

          {!loading && error && (
            <InfoCard title={locale === "ko" ? "오류" : "Error"} tone="warning">
              <p className="text-sm">{error}</p>
            </InfoCard>
          )}

          {!loading && !error && core && (
            <>
              <InfoCard title={identityTitle}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div
                    className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-bty-border/50 bg-bty-soft"
                    aria-hidden
                  >
                    {dashboardResolvedAvatar?.characterUrl ? (
                      <AvatarComposite
                        size={72}
                        characterUrl={dashboardResolvedAvatar.characterUrl}
                        outfitUrl={undefined}
                        accessoryUrls={[]}
                        alt=""
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserAvatar
                          avatarUrl={displayAvatarUrl}
                          initials={core.codeName?.slice(0, 2)}
                          alt=""
                          size="lg"
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-base font-semibold text-bty-navy">{core.codeName}</p>
                    <p className="text-sm text-bty-secondary">{core.subName}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <SecondaryButton href={`/${locale}/bty/profile`} className="sm:w-auto sm:min-w-[140px]">
                    {locale === "ko" ? "프로필" : "Profile"}
                  </SecondaryButton>
                  <SecondaryButton href={`/${locale}/bty/profile/avatar`} className="sm:w-auto sm:min-w-[160px]">
                    {locale === "ko" ? "아바타 설정" : "Avatar settings"}
                  </SecondaryButton>
                </div>
              </InfoCard>

              <InfoCard title={progressTitle}>
                <p className="text-sm leading-relaxed text-bty-text">
                  {weeklyBandCopy ??
                    (locale === "ko" ? "주간 경쟁 상태를 불러오는 중입니다." : "Loading weekly competition context…")}
                </p>
                {leStageSummary && (
                  <p className="text-sm text-bty-secondary">
                    {typeof leStageSummary.currentStage === "number"
                      ? (locale === "ko"
                          ? `${leStageSummary.currentStage}단계 / 4 · `
                          : `Stage ${leStageSummary.currentStage} of 4 · `)
                      : ""}
                    {leStageSummary.stageName}
                  </p>
                )}
                <p className="text-xs text-bty-muted">
                  {locale === "ko"
                    ? "세부 수치·기록은 진행 화면에서 확인하세요."
                    : "Open Progress for detailed numbers and history."}
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <PrimaryButton href={arenaPlayHref} className="sm:w-auto sm:min-w-[160px]">
                    {locale === "ko" ? "Arena으로" : "Go to Arena"}
                  </PrimaryButton>
                  <SecondaryButton href={`/${locale}/my-page/progress`} className="sm:w-auto sm:min-w-[160px]">
                    {locale === "ko" ? "진행 상세" : "Progress details"}
                  </SecondaryButton>
                  <SecondaryButton href={`/${locale}/bty/leaderboard`} className="sm:w-auto sm:min-w-[160px]">
                    {locale === "ko" ? "주간 리더보드" : "Weekly leaderboard"}
                  </SecondaryButton>
                </div>
              </InfoCard>

              <InfoCard title={teamTitle}>
                <p className="text-sm leading-relaxed text-bty-text">{teamNarrative}</p>
                <div className="mt-4">
                  <SecondaryButton href={`/${locale}/my-page/team`} className="sm:w-auto sm:max-w-xs">
                    {locale === "ko" ? "팀 화면" : "Team page"}
                  </SecondaryButton>
                </div>
              </InfoCard>
            </>
          )}
        </div>
      </ScreenShell>

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
    </>
  );
}
