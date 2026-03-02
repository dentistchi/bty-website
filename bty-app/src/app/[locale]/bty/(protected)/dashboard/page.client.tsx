"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TierMilestoneModal, ProgressCard, ProgressVisual, UserAvatar, ArenaLevelsCard, CardSkeleton } from "@/components/bty-arena";
import { EmotionalStatsPhrases } from "@/components/bty/EmotionalStatsPhrases";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getMilestoneToShow } from "@/lib/bty/arena/milestone";
import {
  progressToNextTier,
  CODE_LORE,
  codeIndexFromTier,
  tierFromCoreXp,
} from "@/lib/bty/arena/codes";
import { stageFromCoreXp } from "@/domain";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { AVATAR_CHARACTERS, getAvatarCharacter } from "@/lib/bty/arena/avatarCharacters";
import { getAccessoryImageUrl, OUTFIT_OPTIONS_BY_THEME } from "@/lib/bty/arena/avatarOutfits";

type WeeklyXpRes = { weekStartISO?: string | null; weekEndISO?: string | null; xpTotal: number; count?: number };
type CoreXpRes = {
  coreXpTotal: number;
  codeName: string;
  subName: string;
  seasonalXpTotal: number;
  codeHidden?: boolean;
  subNameRenameAvailable?: boolean;
  avatarUrl?: string | null;
  avatarCharacterId?: string | null;
  avatarCharacterLocked?: boolean;
  avatarOutfitTheme?: "professional" | "fantasy" | null;
  avatarSelectedOutfitId?: string | null;
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [subNameDraft, setSubNameDraft] = React.useState("");
  const [subNameSaving, setSubNameSaving] = React.useState(false);
  const [avatarCharacterSaving, setAvatarCharacterSaving] = React.useState(false);
  const [avatarOutfitThemeSaving, setAvatarOutfitThemeSaving] = React.useState(false);
  const [avatarSelectedOutfitSaving, setAvatarSelectedOutfitSaving] = React.useState(false);
  const [avatarPrefsSavedAt, setAvatarPrefsSavedAt] = React.useState<number | null>(null);

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
  const [leState, setLeState] = React.useState<LeadershipEngineStateRes | null>(null);
  const [leAir, setLeAir] = React.useState<AIRSnapshotRes | null>(null);
  const [leTii, setLeTii] = React.useState<TIIRes | null>(null);
  const [leCertified, setLeCertified] = React.useState<CertifiedRes | null>(null);
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

  async function saveAvatarOutfitTheme(theme: "professional" | "fantasy" | null) {
    setCore((c) => (c ? { ...c, avatarOutfitTheme: theme } : c));
    setAvatarOutfitThemeSaving(true);
    try {
      await arenaFetch("/api/arena/profile", {
        method: "PATCH",
        json: { avatarOutfitTheme: theme },
      });
      const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => core);
      if (next) setCore(next);
      setAvatarPrefsSavedAt(Date.now());
      setTimeout(() => setAvatarPrefsSavedAt(null), 2000);
    } catch {
      setCore((c) => (c ? { ...c, avatarOutfitTheme: core?.avatarOutfitTheme ?? null } : c));
    } finally {
      setAvatarOutfitThemeSaving(false);
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
        const [c, leagueRes, todayRes, statsRes, unlockedRes, membershipRes, eliteRes, leStateRes, leAirRes, leTiiRes, leCertifiedRes] = await Promise.all([
          arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => fallbackCore),
          arenaFetch<LeagueRes>("/api/arena/league/active").catch(() => null),
          arenaFetch<TodayXpRes>("/api/arena/today-xp").catch(() => ({ xpToday: 0 })),
          arenaFetch<WeeklyStatsRes>("/api/arena/weekly-stats").catch(() => null),
          arenaFetch<UnlockedScenariosRes>(`/api/arena/unlocked-scenarios?locale=${locale}`).catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            return msg === "UNAUTHENTICATED" ? ({ error: "UNAUTHENTICATED" } as UnlockedScenariosRes) : null;
          }),
          arenaFetch<MembershipRequestRes>("/api/arena/membership-request").catch(() => ({ request: null })),
          arenaFetch<{ isElite?: boolean }>("/api/me/elite").catch(() => ({ isElite: false })),
          arenaFetch<LeadershipEngineStateRes>("/api/arena/leadership-engine/state").catch(() => null),
          arenaFetch<AIRSnapshotRes>("/api/arena/leadership-engine/air").catch(() => null),
          arenaFetch<TIIRes>("/api/arena/leadership-engine/tii").catch(() => null),
          arenaFetch<CertifiedRes>("/api/arena/leadership-engine/certified").catch(() => null),
        ]);

        if (!alive) return;
        setWeekly(w);
        setCore(c);
        const toShow = getMilestoneToShow(c.coreXpTotal);
        if (toShow) {
          setMilestoneModal({
            milestone: toShow.milestone,
            previousSubName: toShow.previousSubName,
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
        if (leStateRes) setLeState(leStateRes);
        if (leAirRes) setLeAir(leAirRes);
        if (leTiiRes) setLeTii(leTiiRes);
        if (leCertifiedRes) setLeCertified(leCertifiedRes);
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

  const coreXp = core?.coreXpTotal ?? 0;
  const stage = stageFromCoreXp(coreXp);
  const { progressPct, nextCodeName, xpToNext } = progressToNextTier(coreXp);
  const codeIndex = codeIndexFromTier(tierFromCoreXp(coreXp));
  const lore = CODE_LORE[codeIndex];
  const localeTyped = (locale === "ko" ? "ko" : "en") as Locale;
  const tArenaLevels = getMessages(localeTyped).arenaLevels;
  const tAvatarOutfit = getMessages(localeTyped).avatarOutfit;
  const tArenaMembership = getMessages(localeTyped).arenaMembership;
  const displayAvatarUrl =
    core?.avatarUrl ?? getAvatarCharacter(core?.avatarCharacterId)?.imageUrl ?? null;

  const content = (<div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      {/* DESIGN_FIRST_IMPRESSION_BRIEF §4 A: 첫 화면 = 히어로 한 문장 — 페이지 최상단에 배치 */}
      <div className="bty-hero" style={{ paddingTop: 32, paddingBottom: 40, marginBottom: 32 }}>
        <p className="bty-hero-title" style={{ margin: 0, fontSize: "clamp(1.75rem, 4vw, 2rem)", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.35, color: "var(--arena-text)" }}>
          {locale === "ko" ? "오늘도 한 걸음, Arena에서." : "One step today, in the Arena."}
        </p>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UserAvatar
            avatarUrl={displayAvatarUrl}
            initials={core?.codeName?.slice(0, 2)}
            alt=""
            size="lg"
          />
          <div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Dashboard</h1>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>Your arena progress at a glance.</div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ display: "grid", gap: 28, marginTop: 28 }}>
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} lines={i === 1 ? 3 : 2} />
          ))}
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
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <Link
              href={`/${locale}/bty-arena`}
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
            >
              Go to Arena
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
            >
              View Weekly Ranking
            </Link>
          </div>

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
                </div>
              </div>
            )}
          </ProgressCard>

          {(league || core?.seasonalXpTotal != null || weekly?.xpTotal != null || weekly?.count != null) && (
            <ProgressCard label="Season Progress">
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
            </ProgressCard>
          )}

          <ProgressCard label="Lifetime Progress (Core XP)">
            <div style={{ fontSize: 28, fontWeight: 800 }}>{core?.coreXpTotal ?? 0}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Permanent. Drives Code Name.</div>
            {typeof core?.coreXpTotal === "number" && (
              <>
                <ProgressVisual
                  stage={stage}
                  progressPct={progressPct}
                  nextMilestoneLabel={
                    nextCodeName ? `${xpToNext} XP to ${nextCodeName}` : `${xpToNext} XP to next phase`
                  }
                />
                {lore && <div style={{ marginTop: 4, fontSize: 12, fontStyle: "italic", opacity: 0.75 }}>{lore}</div>}
              </>
            )}
          </ProgressCard>

          <ProgressCard label="Points Today">
            <div style={{ fontSize: 28, fontWeight: 800 }}>{xpToday}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>XP earned today (UTC date).</div>
          </ProgressCard>

          <ProgressCard label={locale === "ko" ? "Leadership Engine" : "Leadership Engine"}>
            {leState == null && leAir == null && leTii == null && leCertified == null ? (
              <div style={{ fontSize: 14, opacity: 0.8 }}>
                {locale === "ko" ? "상태를 불러오는 중…" : "Loading…"}
              </div>
            ) : (
              <>
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
              </>
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
                      {getMessages(localeTyped).arenaLevels.emptyCta}
                    </Link>
                  }
                />
              )}
            </ProgressCard>
          )}

          <ProgressCard label={locale === "ko" ? "Elite 전용 콘텐츠" : "Elite-only content"}>
            {isElite ? (
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {locale === "ko" ? "상위 5%에만 열리는 콘텐츠입니다." : "Content for top 5% only."}
                </div>
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
                >
                  {locale === "ko" ? "Elite 전용 페이지로 이동 →" : "Go to Elite page →"}
                </Link>
              </div>
            ) : (
              <div style={{ fontSize: 14, opacity: 0.85 }}>
                {locale === "ko"
                  ? "주간 리더보드 상위 5% 달성 시 이용 가능합니다."
                  : "Available when you reach the top 5% on the weekly leaderboard."}
              </div>
            )}
          </ProgressCard>

          <EmotionalStatsPhrases />

          <ProgressCard label="Code Name">
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {core?.codeName ?? "FORGE"} · {core?.subName ?? "Spark"}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              {locale === "ko"
                ? "대시보드에 표시되는 이름이에요. 리더보드에 올라가려면 Arena에서 시나리오를 한 번 완료해 주세요."
                : "Your identity (Code · Sub Name). To appear on the leaderboard, complete at least one Arena scenario."}
            </div>
            {core?.subNameRenameAvailable && (
              <div style={{ marginTop: 12 }}>
                <input
                  value={subNameDraft}
                  onChange={(e) => setSubNameDraft(e.target.value.slice(0, 7))}
                  placeholder="Rename Sub Name (7 chars, once per code)"
                  maxLength={7}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", marginRight: 8 }}
                />
                <button
                  type="button"
                  onClick={saveSubName}
                  disabled={subNameSaving || subNameDraft.trim().length === 0}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "#111",
                    color: "white",
                    cursor: subNameSaving || subNameDraft.trim().length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {subNameSaving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </ProgressCard>

          <ProgressCard label="Avatar">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              {/* 왼쪽: 선택한 캐릭터 아바타 + 악세사리 */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <UserAvatar avatarUrl={displayAvatarUrl} initials={core?.codeName?.slice(0, 2)} alt="" size="md" />
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
                    <span style={{ fontSize: 10, color: "#666" }}>현재 레벨 악세사리</span>
                  </div>
                )}
                {core?.currentOutfit && (
                  <div style={{ fontSize: 11, opacity: 0.9, textAlign: "center", maxWidth: 140 }}>
                    <span style={{ fontWeight: 600 }}>현재:</span> {core.currentOutfit.outfitLabel}
                  </div>
                )}
              </div>
              {/* 오른쪽: 캐릭터 선택(잠금 전만), Outfit theme */}
              <div style={{ flex: 1, minWidth: 200 }}>
                {core?.avatarCharacterLocked ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>캐릭터</div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
                      {locale === "ko"
                        ? "캐릭터는 한 번 저장하면 변경할 수 없습니다. 다음 Code 진화까지 유지됩니다. 아웃핏만 변경 가능합니다."
                        : "Character is permanent after first save until next code evolution. Only outfit theme can be changed."}
                    </div>
                    {core?.avatarCharacterId && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {(() => {
                          const ch = getAvatarCharacter(core.avatarCharacterId);
                          return ch ? (
                            <>
                              <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "#e0e0e0" }}>
                                <img src={ch.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                              <span style={{ fontWeight: 600 }}>{ch.label}</span>
                            </>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>캐릭터 선택</div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                      {locale === "ko" ? "한 번 저장하면 변경할 수 없습니다." : "Cannot be changed after first save."}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {AVATAR_CHARACTERS.map((ch) => {
                        const selected = core?.avatarCharacterId === ch.id;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            disabled={avatarCharacterSaving}
                            onClick={() => selectAvatarCharacter(selected ? null : ch.id)}
                            style={{
                              padding: 8,
                              borderRadius: 12,
                              border: selected ? "2px solid #111" : "1px solid #ddd",
                              background: selected ? "#f5f5f5" : "transparent",
                              cursor: avatarCharacterSaving ? "not-allowed" : "pointer",
                              opacity: avatarCharacterSaving ? 0.7 : 1,
                            }}
                            title={ch.label}
                          >
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                background: "#e0e0e0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                fontWeight: 700,
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              <span style={{ position: "relative", zIndex: 0 }}>{ch.label.slice(0, 1)}</span>
                              <img
                                src={ch.imageUrl}
                                alt=""
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  zIndex: 1,
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            </div>
                            <div style={{ marginTop: 4, fontSize: 11, fontWeight: selected ? 700 : 500 }}>
                              {ch.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{tAvatarOutfit.label}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={avatarOutfitThemeSaving}
                      onClick={() => saveAvatarOutfitTheme("professional")}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: core?.avatarOutfitTheme === "professional" ? "2px solid #111" : "1px solid #ddd",
                        background: core?.avatarOutfitTheme === "professional" ? "#f0f0f0" : "transparent",
                        cursor: avatarOutfitThemeSaving ? "not-allowed" : "pointer",
                        fontWeight: core?.avatarOutfitTheme === "professional" ? 700 : 500,
                      }}
                    >
                      {tAvatarOutfit.professional}
                    </button>
                    <button
                      type="button"
                      disabled={avatarOutfitThemeSaving}
                      onClick={() => saveAvatarOutfitTheme("fantasy")}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: core?.avatarOutfitTheme === "fantasy" ? "2px solid #111" : "1px solid #ddd",
                        background: core?.avatarOutfitTheme === "fantasy" ? "#f0f0f0" : "transparent",
                        cursor: avatarOutfitThemeSaving ? "not-allowed" : "pointer",
                        fontWeight: core?.avatarOutfitTheme === "fantasy" ? 700 : 500,
                      }}
                    >
                      {tAvatarOutfit.fantasy}
                    </button>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      {locale === "ko" ? "선택한 옷" : "Selected outfit"}
                    </label>
                    <select
                      value={core?.avatarSelectedOutfitId ?? ""}
                      onChange={(e) => saveAvatarSelectedOutfit(e.target.value || null)}
                      disabled={avatarSelectedOutfitSaving}
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
                      {(OUTFIT_OPTIONS_BY_THEME[core?.avatarOutfitTheme === "fantasy" ? "fantasy" : "professional"] ?? []).map(
                        (opt) => (
                          <option key={opt.outfitId} value={opt.outfitId}>
                            {opt.outfitLabel}
                          </option>
                        )
                      )}
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

          <ProgressCard label="Streak">
            <div style={{ fontSize: 28, fontWeight: 800 }}>{streak}</div>
          </ProgressCard>

          {weeklyStats && (
            <ProgressCard label="Weekly Reflection">
              <div style={{ fontSize: 18, fontWeight: 700 }}>
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
            <div style={{ fontSize: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
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
    </div>
  );
  return content;
}
