/**
 * BTY Arena program: track (staff vs leader) by job function / role,
 * and new-joiner rule (first 1 month = staff training regardless of track).
 */

import type { MembershipRole } from "@/lib/authz";

export type ArenaTrack = "staff" | "leader";

/** Job functions that receive the staff (일반 스텝) program. Doctor 포함 — Doctor는 S3까지. */
export const STAFF_JOB_FUNCTIONS: string[] = [
  "assistant",
  "admin",
  "junior_doctor",
  "hygienist",
  "doctor",
];

/** Job functions that receive the leader (리더 스텝) program. Senior Doctor(L1까지), Partner(L4까지). */
export const LEADER_JOB_FUNCTIONS: string[] = [
  "senior_doctor",
  "partner",
  "office_manager",
  "regional_om",
  "director",
  "dso",
];

/** 직군별 최대 레벨 캡. tenure로 계산한 뒤 이 값으로 상한 적용. */
export const JOB_MAX_LEVEL_CAP: Record<string, string> = {
  doctor: "S3",
  senior_doctor: "L1",
  partner: "L4", // L4는 여전히 admin-granted(l4_access)일 때만 실제 오픈
};

/** New joiners get staff training for this many days, even if their role is leader. */
export const NEW_JOINER_STAFF_DAYS = 30;

/**
 * Normalize job_function for lookup (lowercase, trim, common aliases).
 */
function normalizeJobFunction(jobFunction: string | null | undefined): string {
  if (!jobFunction || typeof jobFunction !== "string") return "";
  const s = jobFunction.trim().toLowerCase();
  const aliases: Record<string, string> = {
    om: "office_manager",
    "office manager": "office_manager",
    regional_om: "regional_om",
    "regional om": "regional_om",
    "regional manager": "regional_om",
    "초보 의사": "junior_doctor",
    junior_doctor: "junior_doctor",
  };
  return aliases[s] ?? s;
}

const LEVEL_ORDER: string[] = ["S1", "S2", "S3", "L1", "L2", "L3", "L4"];

/** Returns the lower of two level ids (by progression order). */
export function minLevel(a: string, b: string): string {
  const i = LEVEL_ORDER.indexOf(a);
  const j = LEVEL_ORDER.indexOf(b);
  if (i < 0 || j < 0) return a;
  return LEVEL_ORDER[Math.min(i, j)];
}

/**
 * True if the user is within the new-joiner window (first N days).
 */
export function isNewJoiner(joinedAt: string | Date | null | undefined): boolean {
  if (!joinedAt) return false;
  const joined = typeof joinedAt === "string" ? new Date(joinedAt) : joinedAt;
  if (Number.isNaN(joined.getTime())) return false;
  const now = new Date();
  const days = (now.getTime() - joined.getTime()) / (24 * 60 * 60 * 1000);
  return days < NEW_JOINER_STAFF_DAYS;
}

/**
 * Compute tenure in calendar months from a reference date to now.
 * No part-time weighting; calendar months only.
 */
export function tenureMonthsSince(since: string | Date | null | undefined): number {
  if (!since) return 0;
  const start = typeof since === "string" ? new Date(since) : since;
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/**
 * Level unlock is tenure-only. Tier/XP never unlock levels.
 * Returns the highest level id (e.g. "S2", "L1") the user may access for the given track.
 * - Staff track: tenure = months since joinedAt.
 * - Leader track: tenure = months since leaderStartedAt, fallback to joinedAt if missing.
 * - If new joiner (< 30 days joinedAt), effective track is staff and only S1 is allowed (handled by caller).
 */
export function getMaxUnlockedLevel(params: {
  track: ArenaTrack;
  joinedAt?: string | Date | null;
  leaderStartedAt?: string | Date | null;
}): string {
  const { track, joinedAt, leaderStartedAt } = params;
  const config = loadProgramConfig();
  const trackConfig = config.tracks.find((t) => t.track === track);
  if (!trackConfig?.levels?.length) return track === "staff" ? "S1" : "L1";

  const tenureBasis = track === "leader" ? (leaderStartedAt ?? joinedAt) : joinedAt;
  const tenureMonths = tenureMonthsSince(tenureBasis);

  let maxLevel = trackConfig.levels[0].level;
  for (const lvl of trackConfig.levels) {
    const minMonths = (lvl as LevelWithTenure).min_tenure_months ?? 0;
    if (tenureMonths >= minMonths) maxLevel = lvl.level;
  }
  return maxLevel;
}

/**
 * Resolve effective Arena track for a user.
 * - If within new-joiner window (first 30 days): always "staff".
 * - Else: staff job_functions → "staff", leader job_functions / membership role → "leader".
 * - Fallback: membership role (office_manager, regional_manager → leader; staff, doctor → use job_function or default staff).
 */
export function getEffectiveTrack(params: {
  jobFunction?: string | null;
  membershipRole?: MembershipRole | null;
  joinedAt?: string | Date | null;
}): ArenaTrack {
  const { jobFunction, membershipRole, joinedAt } = params;

  if (isNewJoiner(joinedAt)) {
    return "staff";
  }

  const jf = normalizeJobFunction(jobFunction);
  if (LEADER_JOB_FUNCTIONS.includes(jf)) return "leader";
  if (STAFF_JOB_FUNCTIONS.includes(jf)) return "staff";

  if (membershipRole === "regional_manager" || membershipRole === "office_manager") {
    return "leader";
  }
  if (membershipRole === "doctor") {
    return "staff";
  }
  if (membershipRole === "staff") {
    return "staff";
  }

  return "staff";
}

import programJson from "./arena_program.json";
import legacyProgramJson from "./arena_legacy_program.json";

/**
 * Load program config (tracks, levels, structure).
 */
export function loadProgramConfig(): ArenaProgramConfig {
  return programJson as unknown as ArenaProgramConfig;
}

/** L4 (Partner) content: admin-granted only. Loaded from legacy program. */
export function loadL4Level(): LevelWithTenure {
  const raw = legacyProgramJson as { level?: string; structure?: string[]; items?: unknown[]; human_model?: ArenaHumanModel };
  return {
    level: "L4",
    title: "Partner (Board)",
    title_ko: "파트너 (보드)",
    structure: raw.structure ?? [],
    items: raw.items ?? [],
    human_model: raw.human_model,
  };
}

/**
 * Human formation philosophy metadata per level.
 * NOT for UI display. Server-only internal calibration for reflection prompts and scoring.
 * Do not expose via frontend APIs (e.g. strip from unlocked-scenarios response).
 */
export type ArenaHumanModel = {
  stage_name: string;
  core_training_focus: string;
  primary_shift: string;
  risk_pattern: string[];
  maturity_marker: string;
  power_posture: string;
};

export type LevelWithTenure = {
  level: string;
  title: string;
  title_ko?: string;
  structure: string[];
  min_tenure_months?: number;
  tenure_basis?: "joinedAt" | "leaderStartedAt";
  /** Internal formation layer; do not send to client. */
  human_model?: ArenaHumanModel;
  items: unknown[];
};

export type ArenaProgramConfig = {
  program: string;
  version: string;
  new_joiner_rule: {
    description: string;
    staff_training_days: number;
  };
  tracks: Array<{
    track: "staff" | "leader";
    title: string;
    job_functions: string[];
    job_function_labels?: Record<string, string>;
    levels: LevelWithTenure[];
  }>;
};
