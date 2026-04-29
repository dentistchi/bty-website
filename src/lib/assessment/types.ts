export type DimensionKey =
  | "core_self_esteem"
  | "self_compassion"
  | "self_esteem_stability"
  | "growth_mindset"
  | "social_self_esteem";

export type Likert = 1 | 2 | 3 | 4 | 5;

export type Question = {
  id: string;              // e.g. "q01"
  text_en: string;
  text_ko: string;
  dimension: DimensionKey; // 5 axes
  reverse: boolean;        // reverse scoring
};

export type AssessmentAnswers = Record<string, Likert>; // key: question.id

export type DimensionScores = Record<DimensionKey, number>; // 0..100

export type PatternKey =
  | "perfectionism"
  | "approval_seeking"
  | "fragile_stability"
  | "low_growth_fuel"
  | "self_criticism_loop"
  | "balanced";

export type BarrierKey =
  | "low_compassion"
  | "low_stability"
  | "low_core"
  | "low_social"
  | "low_growth";

export type AssessmentResult = {
  version: number; // for future migrations
  createdAtISO: string;

  scores: DimensionScores;

  // detected insights
  pattern: PatternKey;
  barriers: BarrierKey[];       // top 1~2
  recommendedTrack: string;     // e.g. "Compassion First", "Stability Reset", etc.

  // lightweight summary (one-page)
  summaryTitle_en: string;
  summaryTitle_ko: string;
  summaryBody_en: string;
  summaryBody_ko: string;
};
