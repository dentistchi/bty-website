/**
 * BTY Arena domain types (pure, no DB/framework deps).
 * Single source of truth: docs/spec/arena-domain-rules.md
 */

export type { CodeIndex } from "./constants";
import type { CodeIndex } from "./constants";

/** ISO date only (YYYY-MM-DD). */
export type ISODateString = string;

/** Arena 시나리오·Dojo 연동용 공통 콘텐츠 식별자. 시나리오/연습 ID 동일 네임스페이스. */
export type ContentScenarioId = string;

/** Tier is internal; derived as floor(coreXp / 10). Not exposed. */
export type Tier = number;

/** Sub tier group 0..3 within a code. */
export type SubTierGroup = 0 | 1 | 2 | 3;

/** Full derived stage state from Core XP (for display). */
export interface StageState {
  tier: number;
  codeIndex: CodeIndex;
  subTierGroup: SubTierGroup;
  stageNumber: number;
  codeName: string;
  subName: string;
}

/** Identity shown on leaderboard: code name + sub name only (no real name). */
export interface LeaderboardIdentity {
  codeIndex: CodeIndex;
  codeName: string;
  subName: string;
}

/** Leaderboard entry: rank from weekly XP; identity from core (code + sub name). */
export interface LeaderboardEntryDomain {
  rank: number;
  weeklyXp: number;
  coreXp: number;
  codeName: string;
  subName: string;
}

/** Season/league window. */
export interface SeasonWindow {
  id: string;
  startDate: ISODateString;
  endDate: ISODateString;
  label?: string;
}

/** Result of Seasonal → Core conversion (for one award). */
export interface SeasonalToCoreResult {
  rate: number;
  coreGain: number;
  fractionalBuffer: number;
}
