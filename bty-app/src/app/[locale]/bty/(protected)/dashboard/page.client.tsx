"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { TierMilestoneModal, ProgressCard, ProgressVisual, UserAvatar, ArenaLevelsCard } from "@/components/bty-arena";
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
import { AVATAR_CHARACTERS } from "@/lib/bty/arena/avatarCharacters";
import { getAccessoryImageUrl } from "@/lib/bty/arena/avatarOutfits";

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
  avatarOutfitTheme?: "professional" | "fantasy" | null;
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
  levels?: Array<{ level: string; title?: string; title_ko?: string; items?: unknown[] }>;
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [subNameDraft, setSubNameDraft] = React.useState("");
  const [subNameSaving, setSubNameSaving] = React.useState(false);
  const [avatarUrlDraft, setAvatarUrlDraft] = React.useState("");
  const [avatarSaving, setAvatarSaving] = React.useState(false);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const avatarFileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarCharacterSaving, setAvatarCharacterSaving] = React.useState(false);
  const [avatarOutfitThemeSaving, setAvatarOutfitThemeSaving] = React.useState(false);

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

  async function saveAvatarUrl(urlOrEmpty?: string | null) {
    const url =
      urlOrEmpty !== undefined
        ? (urlOrEmpty === "" || urlOrEmpty === null ? null : String(urlOrEmpty).trim())
        : avatarUrlDraft.trim() || null;
    try {
      setAvatarSaving(true);
      await arenaFetch("/api/arena/profile", { method: "PATCH", json: { avatarUrl: url } });
      const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => core);
      if (next) setCore(next);
      setAvatarUrlDraft("");
    } catch {
      // ignore
    } finally {
      setAvatarSaving(false);
    }
  }

  function clearAvatarUrl() {
    saveAvatarUrl(null);
  }

  async function selectAvatarCharacter(characterId: string | null) {
    setCore((c) => (c ? { ...c, avatarCharacterId: characterId } : c));
    setAvatarCharacterSaving(true);
    try {
      await arenaFetch("/api/arena/profile", {
        method: "PATCH",
        json: { avatarCharacterId: characterId },
      });
      const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => core);
      if (next) setCore(next);
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
    } catch {
      setCore((c) => (c ? { ...c, avatarOutfitTheme: core?.avatarOutfitTheme ?? null } : c));
    } finally {
      setAvatarOutfitThemeSaving(false);
    }
  }

  async function submitMembershipRequest() {
    const jf = membershipForm.job_function.trim();
    const joined = membershipForm.joined_at.trim().slice(0, 10);
    if (!jf || !joined) {
      setMembershipSubmitMsg("직군과 입사일을 입력해 주세요.");
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
      setMembershipSubmitMsg("승인 대기 중입니다. Admin 승인 후 레벨이 열립니다.");
      const res = await arenaFetch<MembershipRequestRes>("/api/arena/membership-request").catch(() => ({ request: null }));
      if (res?.request) setMembershipRequest(res.request);
    } catch (e) {
      setMembershipSubmitMsg(e instanceof Error ? e.message : "제출에 실패했습니다.");
    } finally {
      setMembershipSubmitting(false);
    }
  }

  async function uploadAvatarFile(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    try {
      setAvatarUploading(true);
      const res = await fetch("/api/arena/avatar/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP_${res.status}`);
      const next = await arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => core);
      if (next) setCore(next);
    } catch {
      // ignore
    } finally {
      setAvatarUploading(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
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
        const [c, leagueRes, todayRes, statsRes, unlockedRes, membershipRes] = await Promise.all([
          arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => fallbackCore),
          arenaFetch<LeagueRes>("/api/arena/league/active").catch(() => null),
          arenaFetch<TodayXpRes>("/api/arena/today-xp").catch(() => ({ xpToday: 0 })),
          arenaFetch<WeeklyStatsRes>("/api/arena/weekly-stats").catch(() => null),
          arenaFetch<UnlockedScenariosRes>("/api/arena/unlocked-scenarios").catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            return msg === "UNAUTHENTICATED" ? ({ error: "UNAUTHENTICATED" } as UnlockedScenariosRes) : null;
          }),
          arenaFetch<MembershipRequestRes>("/api/arena/membership-request").catch(() => ({ request: null })),
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
  }, []);

  const coreXp = core?.coreXpTotal ?? 0;
  const stage = stageFromCoreXp(coreXp);
  const { progressPct, nextCodeName, xpToNext } = progressToNextTier(coreXp);
  const codeIndex = codeIndexFromTier(tierFromCoreXp(coreXp));
  const lore = CODE_LORE[codeIndex];
  const localeTyped = (locale === "ko" ? "ko" : "en") as Locale;
  const tArenaLevels = getMessages(localeTyped).arenaLevels;
  const tAvatarOutfit = getMessages(localeTyped).avatarOutfit;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <BtyTopNav />
      <div style={{ marginTop: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UserAvatar
            avatarUrl={core?.avatarUrl}
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

      {loading && <div style={{ padding: 14, border: "1px solid #eee", borderRadius: 12 }}>Loading…</div>}

      {!loading && error && (
        <div style={{ padding: 14, border: "1px solid #f2c", borderRadius: 12 }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <div style={{ marginTop: 6 }}>{error}</div>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <Link
              href={`/${locale}/bty-arena`}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: "#111",
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
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid #111",
                color: "#111",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              View Weekly Ranking
            </Link>
          </div>

          <ProgressCard label="Arena 가입">
            {membershipRequest?.status === "approved" ? (
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>승인됨</div>
                <div>직군: {membershipRequest.job_function}</div>
                <div>입사일: {membershipRequest.joined_at}</div>
                {membershipRequest.leader_started_at && (
                  <div>리더시작일: {membershipRequest.leader_started_at}</div>
                )}
              </div>
            ) : membershipRequest?.status === "pending" ? (
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                승인 대기 중입니다. Admin 승인 후 레벨이 표시됩니다.
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                  직군·입사일·리더시작일을 입력하면 Admin 승인 후 Arena 레벨이 열립니다.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>직군</label>
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
                      Senior Doctor는 보통 3년 이상 경력 시 선택합니다.
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>입사일</label>
                    <input
                      type="date"
                      min="2007-01-01"
                      value={membershipForm.joined_at}
                      onChange={(e) => setMembershipForm((f) => ({ ...f, joined_at: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>리더시작일 (선택, 리더 직군인 경우)</label>
                    <input
                      type="date"
                      min="2007-01-01"
                      value={membershipForm.leader_started_at}
                      onChange={(e) => setMembershipForm((f) => ({ ...f, leader_started_at: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                    />
                  </div>
                  {membershipSubmitMsg && (
                    <div style={{ fontSize: 13, color: membershipSubmitMsg.includes("대기") ? "#0a0" : "#c00" }}>
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
                    {membershipSubmitting ? "제출 중…" : "제출"}
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

          <ProgressCard label="ARENA LEVELS">
            {unlockedScenarios?.error === "UNAUTHENTICATED" ? (
              <div style={{ fontSize: 14, opacity: 0.9 }}>{tArenaLevels.loginRequired}</div>
            ) : (
              <ArenaLevelsCard
                track={unlockedScenarios?.track ?? "staff"}
                maxUnlockedLevel={unlockedScenarios?.maxUnlockedLevel ?? null}
                levels={unlockedScenarios?.levels ?? []}
                l4Access={unlockedScenarios?.l4_access === true}
                membershipPending={
                  unlockedScenarios?.membershipPending === true ||
                  (unlockedScenarios?.ok === true && (unlockedScenarios?.levels?.length ?? 0) === 0)
                }
                locale={locale}
              />
            )}
          </ProgressCard>

          <ProgressCard label="Code Name">
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {core?.codeName ?? "FORGE"} · {core?.subName ?? "Spark"}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Your identity (Code · Sub Name). Shown as Code Name only on leaderboard.</div>
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
              {/* 왼쪽: 아바타 + 악세사리 아이콘 (캐릭터/테마 선택 옆에 항상 노출) */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <input
                  id="avatar-file-input"
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatarFile(f);
                  }}
                />
                <label
                  htmlFor="avatar-file-input"
                  style={{
                    cursor: avatarUploading ? "not-allowed" : "pointer",
                    display: "block",
                  }}
                  title="Click to upload image"
                >
                  <UserAvatar avatarUrl={core?.avatarUrl} initials={core?.codeName?.slice(0, 2)} alt="" size="md" />
                </label>
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
              {/* 오른쪽: 업로드/URL, 캐릭터 선택, Outfit theme */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
                  Click avatar or button to upload (JPEG/PNG/WebP/GIF, max 2MB), or paste an image URL below.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={avatarUploading}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      cursor: avatarUploading ? "not-allowed" : "pointer",
                    }}
                  >
                    {avatarUploading ? "Uploading…" : "Upload image"}
                  </button>
                </div>
                <input
                  value={avatarUrlDraft}
                  onChange={(e) => setAvatarUrlDraft(e.target.value)}
                  placeholder="Or paste image URL: https://..."
                  style={{
                    width: "100%",
                    maxWidth: 400,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    marginTop: 8,
                    marginRight: 8,
                    fontSize: 14,
                  }}
                />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => saveAvatarUrl()}
                    disabled={avatarSaving}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      cursor: avatarSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    {avatarSaving ? "Saving…" : "Save URL"}
                  </button>
                  {core?.avatarUrl && (
                    <button
                      type="button"
                      onClick={clearAvatarUrl}
                      disabled={avatarSaving}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #999",
                        background: "transparent",
                        cursor: avatarSaving ? "not-allowed" : "pointer",
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {core?.avatarUrl && (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                    직접 올린 이미지 사용 중. 아래 캐릭터 선택은 부가 옵션입니다.
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>캐릭터 선택</div>
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
                </div>
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
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{tAvatarOutfit.hint}</div>
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
}
