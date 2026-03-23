/**
 * Memory Engine recall surfaced with GET /api/arena/session/next (not stored on Scenario).
 */
export type ArenaRecallPrompt = {
  message: string;
  triggerId: string;
  triggerType: "memory_pattern_threshold";
};
