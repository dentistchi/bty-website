import type { HiddenStat } from "@/domain/arena/scenarios";

/**
 * Single sealed Arena decision fingerprint — persisted under `bty-signals`.
 * Trait keys match domain `HiddenStat` (PascalCase).
 */
export type ArenaSignal = {
  scenarioId: string;
  primary: string;
  reinforcement: string;
  traits: Partial<Record<HiddenStat, number>>;
  meta: {
    relationalBias: number;
    operationalBias: number;
    emotionalRegulation: number;
  };
  timestamp: number;
};

export type LeadershipMetrics = {
  xp: number;
  AIR: number;
  TII: number;
  relationalBias: number;
  operationalBias: number;
  emotionalRegulation: number;
  /** Derived from `signals.length` — used for dormant copy & trace depth. */
  signalCount: number;
};

export type LeadershipState = {
  codeName: string;
  stage: string;
  headline: string;
  airLabel: string;
  tiiLabel: string;
  rhythmLabel: string;
  relationalLabel: string;
  operationalLabel: string;
  emotionalLabel: string;
  teamSignal: string;
  influencePattern: string;
  alignmentTrend: string;
  nextFocus: string;
  nextCue: string;
  /** Optional — when Growth reflections exist; state language, not scores. */
  reflectionDepthLabel?: string;
  reflectionIntegrationLabel?: string;
  recoveryAwarenessLabel?: string;
  /** Latest saved reflection focus channel (interpreted label). */
  recentFocusLabel?: string;
};
