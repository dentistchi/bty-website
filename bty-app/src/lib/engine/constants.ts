import type { StageCodeName, HiddenStats } from "./types";

export const STAGE_STEP_SIZE = 100; // 100 steps per codename
export const STAGE_VISIBLE_MAX = 699; // 0..699 visible, 700+ hidden

export const STAGE_CODES: StageCodeName[] = [
  "ARCHITECT",
  "FORGE",
  "ATLAS",
  "VAULT",
  "OBSIDIAN",
  "AURORA",
  "NOVA",
];

export const DEFAULT_HIDDEN: HiddenStats = {
  gratitude: 0,
  integrity: 0,
  insight: 0,
  communication: 0,
  resilience: 0,
};

// XP split: Core XP is long-term, League XP is seasonal competition.
// Keep simple in A1; tune later.
export const XP_SPLIT = {
  coreRatio: 0.7,
  leagueRatio: 0.3,
};

// Curve: compress extreme xp spikes, keep early growth snappy.
// A1 defaults; tune after MVP playtest.
export const XP_CURVE = {
  minAward: 1,
  maxAward: 120,
  // difficulty clamps
  minDifficulty: 0.5,
  maxDifficulty: 2.0,
};
