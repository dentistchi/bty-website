import type { PatternSignatureAggregateState } from "@/domain/arena/patternSignatureAggregation";
import type { PatternShiftBand } from "@/domain/leadership-engine/patternShift";

/** Wire shape for My Page / API — persisted `user_pattern_signatures` (read-only to clients). */
export type UserPatternSignaturePublic = {
  pattern_family: string;
  axis: string;
  current_state: PatternSignatureAggregateState;
  repeat_count: number;
  last_validation_result: PatternShiftBand;
  confidence_score: number;
  next_watchpoint: string | null;
  last_seen_at: string;
  first_seen_at: string;
};
