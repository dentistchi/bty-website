/**
 * A1 Engine Types
 * - No framework deps
 * - Safe to import from server/client
 */

export type ISODateString = string; // "2026-02-21"
export type ISODateTimeString = string; // "2026-02-21T12:34:56Z"

export type Locale = "en" | "ko";

export type SeasonId = string; // e.g. "2026Q1" or "2026-01-01__2026-03-31"

export type UserId = string;
export type OrgId = string;
export type TeamId = string;

export type EmploymentRole =
  | "staff"
  | "lead"
  | "manager"
  | "regional_manager"
  | "director"
  | "partner"
  | "doctor"
  | "hygienist";

/**
 * Hidden stats are internal levers.
 * We show a radar/shape later, but do NOT disclose formulas.
 */
export type HiddenStat =
  | "gratitude"
  | "integrity"
  | "insight"
  | "communication"
  | "resilience";

export type HiddenStats = Record<HiddenStat, number>;

export type XPSource =
  | "simulation"
  | "assessment_5"
  | "assessment_50"
  | "journal"
  | "checkin"
  | "real_world"; // benefit day, volunteer, mentorship, etc.

/**
 * XP event = atomic log entry used for both Core XP and League XP.
 * We keep it generic; later we can store it in DB.
 */
export interface XPEvent {
  id: string; // uuid
  userId: UserId;

  source: XPSource;
  sourceId?: string; // scenarioId, assessmentId, etc.

  createdAt: ISODateTimeString;

  /**
   * Base XP is a "reward suggestion" BEFORE curve/difficulty modifiers.
   * The engine will apply curve + caps.
   */
  xpBase: number; // recommended 5~120 in MVP

  /**
   * Difficulty is a normalized hint. 1.0 = baseline.
   * Higher role may see higher difficulty tasks.
   */
  difficulty?: number; // 0.5 ~ 2.0 recommended

  /**
   * Optional tags to steer hidden stats (ex: gratitude cue).
   */
  tags?: string[];

  /**
   * Hidden stats deltas are applied internally.
   * They can be negative as "tension" signals.
   */
  hiddenDelta?: Partial<Record<HiddenStat, number>>;
}

/**
 * Progress snapshot (what we persist).
 */
export interface UserProgress {
  userId: UserId;
  orgId?: OrgId;
  teamId?: TeamId;
  role?: EmploymentRole;

  // long-term
  coreXp: number;

  // in-season
  leagueXp: number;
  seasonId?: SeasonId;

  // stage derived from coreXp (not stored as truth, but cached is ok)
  stage?: StageState;

  // hidden stats
  hidden: HiddenStats;

  // streak / activity (MVP placeholder)
  streakDays: number;
  lastActiveDate?: ISODateString;
}

/**
 * Stage: 7 code names, each 100 internal steps (0..699)
 * 700+ => "beyond" (hide code + numbers)
 */
export type StageCodeName =
  | "ARCHITECT"
  | "FORGE"
  | "ATLAS"
  | "VAULT"
  | "OBSIDIAN"
  | "AURORA"
  | "NOVA";

export interface StageState {
  stageIndex: number; // 0..infinity (derived from coreXp)
  codenameVisible: boolean;
  codeName?: StageCodeName; // when visible
  stepInStage?: number; // 0..99 when visible
  stageNumber?: number; // 1..7 when visible
}

/**
 * Season definition for leaderboard windows.
 */
export interface SeasonWindow {
  id: SeasonId;
  startDate: ISODateString; // inclusive
  endDate: ISODateString; // inclusive
  label?: string; // "2026 Q1"
}

export interface LeaderboardEntry {
  userId: UserId;
  leagueXp: number;
  // later: role/team, etc.
}

export interface EliteResult {
  seasonId: SeasonId;
  cutoffRank: number; // top N
  eliteUserIds: UserId[];
}
