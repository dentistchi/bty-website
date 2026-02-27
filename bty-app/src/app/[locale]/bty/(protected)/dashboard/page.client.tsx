"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BtyTopNav from "@/components/bty/BtyTopNav";
import { TierMilestoneModal } from "@/components/bty-arena";
import { arenaFetch } from "@/lib/http/arenaFetch";
import { getMilestoneToShow } from "@/lib/bty/arena/milestone";
import {
  progressToNextTier,
  CODE_LORE,
  codeIndexFromTier,
  tierFromCoreXp,
} from "@/lib/bty/arena/codes";

type WeeklyXpRes = { weekStartISO?: string | null; weekEndISO?: string | null; xpTotal: number; count?: number };
type CoreXpRes = {
  coreXpTotal: number;
  codeName: string;
  subName: string;
  seasonalXpTotal: number;
  codeHidden?: boolean;
  subNameRenameAvailable?: boolean;
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
  track?: string;
  maxUnlockedLevel?: string;
  previewLevel?: string | null;
  levels?: Array<{ level: string; title: string; title_ko?: string; items: unknown[] }>;
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

/** SPEC 9-3: level = floor(xpTotal/100)+1, tier Bronze|Silver|Gold|Platinum, progressPct = xpTotal % 100 */
function computeLevelTier(xpTotal: number) {
  const safe = Math.max(0, Math.floor(xpTotal || 0));
  const level = Math.floor(safe / 100) + 1;
  let tier: "Bronze" | "Silver" | "Gold" | "Platinum" = "Bronze";
  if (safe >= 300) tier = "Platinum";
  else if (safe >= 200) tier = "Gold";
  else if (safe >= 100) tier = "Silver";
  const progressPct = safe % 100;
  return { level, tier, progressPct };
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

  type MilestoneModalState = {
    milestone: 25 | 50 | 75;
    previousSubName?: string;
    subName: string;
    subNameRenameAvailable: boolean;
  };
  const [milestoneModal, setMilestoneModal] = React.useState<MilestoneModalState | null>(null);
  const [weeklyStats, setWeeklyStats] = React.useState<WeeklyStatsRes | null>(null);
  const [unlockedScenarios, setUnlockedScenarios] = React.useState<UnlockedScenariosRes | null>(null);

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
        const [c, leagueRes, todayRes, statsRes, unlockedRes] = await Promise.all([
          arenaFetch<CoreXpRes>("/api/arena/core-xp").catch(() => fallbackCore),
          arenaFetch<LeagueRes>("/api/arena/league/active").catch(() => null),
          arenaFetch<TodayXpRes>("/api/arena/today-xp").catch(() => ({ xpToday: 0 })),
          arenaFetch<WeeklyStatsRes>("/api/arena/weekly-stats").catch(() => null),
          arenaFetch<UnlockedScenariosRes>("/api/arena/unlocked-scenarios").catch(() => null),
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
        if (unlockedRes?.ok) setUnlockedScenarios(unlockedRes);
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

  const xpTotal = core?.seasonalXpTotal ?? weekly?.xpTotal ?? 0;
  const { level, tier, progressPct } = computeLevelTier(xpTotal);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <BtyTopNav />
      <div style={{ marginTop: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>bty</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Dashboard</h1>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>Your arena progress at a glance.</div>
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
              View Leaderboard
            </Link>
          </div>

          {league && (
            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>ACTIVE SEASON</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{league.name ?? "Arena"}</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                {league.start_at ? new Date(league.start_at).toLocaleDateString() : ""}
                {" → "}
                {league.end_at ? new Date(league.end_at).toLocaleDateString() : ""}
              </div>
            </div>
          )}

          {unlockedScenarios?.ok && (
            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>ARENA LEVELS</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                Track: {unlockedScenarios.track ?? "—"} · Unlocked up to: {unlockedScenarios.maxUnlockedLevel ?? "—"}
              </div>
              {unlockedScenarios.maxUnlockedLevel === "L4" && (
                <div style={{ marginTop: 6, padding: "8px 10px", background: "#f0f7ff", borderRadius: 8, fontSize: 13 }}>
                  ✓ L4 (Partner) — admin-granted access. You can play Partner scenarios.
                </div>
              )}
              {unlockedScenarios.levels && unlockedScenarios.levels.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {unlockedScenarios.levels.map((lvl) => (
                    <span
                      key={lvl.level}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: lvl.level === "L4" ? "#e8f0fe" : "#f5f5f5",
                        fontSize: 12,
                        fontWeight: lvl.level === "L4" ? 700 : 500,
                      }}
                    >
                      {lvl.level}: {locale === "ko" && lvl.title_ko ? lvl.title_ko : lvl.title}
                      {Array.isArray(lvl.items) && ` (${lvl.items.length})`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>SEASONAL XP</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{xpTotal}</div>
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <b>Level</b> {level}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <b>Tier</b> {tier}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <b>Progress</b> {progressPct}%
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 10,
                  borderRadius: 999,
                  border: "1px solid #eee",
                  overflow: "hidden",
                }}
              >
                <div style={{ height: "100%", width: `${progressPct}%`, background: "#111" }} />
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Events counted: {weekly?.count ?? 0}</div>
            {weekly?.weekStartISO != null && weekly?.weekEndISO != null && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                {String(weekly.weekStartISO).slice(0, 10)} → {String(weekly.weekEndISO).slice(0, 10)}
              </div>
            )}
          </div>

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>POINTS TODAY</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{xpToday}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>XP earned today (UTC date).</div>
          </div>

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>CORE XP</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{core?.coreXpTotal ?? 0}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>Permanent. Drives Code and Sub Name.</div>
            {typeof core?.coreXpTotal === "number" && (() => {
              const tier = tierFromCoreXp(core.coreXpTotal);
              const codeIndex = codeIndexFromTier(tier);
              const { xpToNext, progressPct, nextCodeName } = progressToNextTier(core.coreXpTotal);
              const lore = CODE_LORE[codeIndex];
              return (
                <>
                  <div style={{ marginTop: 10, height: 8, borderRadius: 999, border: "1px solid #eee", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, progressPct * 100)}%`, background: "#111" }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    {nextCodeName ? `${xpToNext} XP to ${nextCodeName}` : `${xpToNext} XP to next phase`}
                  </div>
                  {lore && <div style={{ marginTop: 4, fontSize: 12, fontStyle: "italic", opacity: 0.75 }}>{lore}</div>}
                </>
              );
            })()}
          </div>

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>IDENTITY</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {core?.codeName ?? "FORGE"} · {core?.subName ?? "Spark"}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Code · Sub Name
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
          </div>

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>STREAK</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{streak}</div>
          </div>

          {weeklyStats && (
            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>WEEKLY REFLECTION</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {weeklyStats.reflectionCount} / {weeklyStats.reflectionTarget} reflections this week
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                {weeklyStats.reflectionQuestClaimed
                  ? "Quest complete! +15 Seasonal XP claimed."
                  : "Complete 3 reflections in a week (Mon–Sun UTC) to earn +15 Seasonal XP once."}
              </div>
            </div>
          )}

          <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>PERSONAL RECORD</div>
            <div style={{ fontSize: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>
                <b>Best day this week</b> {typeof weeklyStats?.weekMaxDailyXp === "number" ? `${weeklyStats.weekMaxDailyXp} XP` : "—"}
              </span>
              <span>
                <b>Streak</b> {streak} day{streak !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Your growth, not compared to others.</div>
          </div>
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
