/**
 * Builds TenurePolicyConfig from arena_program.json and exposes unlocked content window.
 * Single source of truth: program config (tracks[].levels with min_tenure_months, tenure_basis).
 */

import type { LevelId, TenurePolicyConfig, Track, UserTenureProfile } from "@/lib/bty/arena/tenure";
import { getMaxUnlockedLevelTenure, getNextLockedLevel } from "@/lib/bty/arena/tenure";
import type { ArenaProgramConfig, LevelWithTenure } from "@/lib/bty/arena/program";
import { loadProgramConfig, JOB_MAX_LEVEL_CAP, minLevel } from "@/lib/bty/arena/program";

const LEVEL_IDS: LevelId[] = ["S1", "S2", "S3", "L1", "L2", "L3", "L4"];

function isLevelId(s: string): s is LevelId {
  return LEVEL_IDS.includes(s as LevelId);
}

/**
 * Builds TenurePolicyConfig from current arena program config.
 * L4 has no tenure (admin-granted only); we set high min so tenure never unlocks it.
 */
export function buildTenurePolicyConfig(program: ArenaProgramConfig): TenurePolicyConfig {
  const minTenureMonthsByLevel: Record<LevelId, number> = {
    S1: 0,
    S2: 3,
    S3: 12,
    L1: 24,
    L2: 60,
    L3: 120,
    L4: 9999, // Partner level: not unlockable by tenure; admin grants only.
  };
  const tenureBasisByLevel: Record<LevelId, "joinedAt" | "leaderStartedAt"> = {
    S1: "joinedAt",
    S2: "joinedAt",
    S3: "joinedAt",
    L1: "leaderStartedAt",
    L2: "leaderStartedAt",
    L3: "leaderStartedAt",
    L4: "leaderStartedAt",
  };

  for (const t of program.tracks) {
    const track = t.track as Track;
    for (const lvl of t.levels) {
      const level = lvl.level;
      if (isLevelId(level)) {
        const withTenure = lvl as LevelWithTenure;
        minTenureMonthsByLevel[level] = withTenure.min_tenure_months ?? minTenureMonthsByLevel[level];
        if (withTenure.tenure_basis) tenureBasisByLevel[level] = withTenure.tenure_basis;
      }
    }
  }

  const days = program.new_joiner_rule?.staff_training_days ?? 30;
  return {
    newJoinerRule: { enabled: true, days, forcedTrack: "staff" },
    minTenureMonthsByLevel,
    tenureBasisByLevel,
    leaderFallbackBasis: "joinedAt",
    applyWorkRatioWeighting: false,
  };
}

/**
 * Returns max unlocked level and optional next locked level (for preview) for the user's track.
 * For leader track: if l4Granted is true, maxUnlockedLevel is L4 (partner; admin-granted only).
 * 직군별 캡: doctor→S3, senior_doctor→L1, partner→L4(캡 없음, L4는 l4Granted 시).
 */
export function getUnlockedContentWindow(args: {
  track: Track;
  user: UserTenureProfile;
  program?: ArenaProgramConfig;
  now?: Date;
  /** When true (and track is leader), user has admin-granted L4 (partner) access. */
  l4Granted?: boolean;
  /** 직군별 최대 레벨 캡 적용용 (doctor→S3, senior_doctor→L1, partner→L4) */
  jobFunction?: string | null;
}): { maxUnlockedLevel: LevelId; previewLevel: LevelId | null } {
  const program = args.program ?? loadProgramConfig();
  const cfg = buildTenurePolicyConfig(program);
  const now = args.now ?? new Date();
  let maxUnlocked = getMaxUnlockedLevelTenure(args.track, args.user, cfg, now);
  if (args.track === "leader" && args.l4Granted === true) {
    maxUnlocked = "L4";
  }
  const cap = args.jobFunction != null ? JOB_MAX_LEVEL_CAP[args.jobFunction.trim().toLowerCase()] : undefined;
  if (cap && LEVEL_IDS.includes(cap)) {
    maxUnlocked = minLevel(maxUnlocked, cap) as LevelId;
  }
  const preview = getNextLockedLevel(args.track, maxUnlocked);
  return { maxUnlockedLevel: maxUnlocked, previewLevel: preview };
}
